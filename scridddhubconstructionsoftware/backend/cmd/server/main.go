package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/joho/godotenv"
	"github.com/scridddhub/backend/internal/geo"
	"github.com/scridddhub/backend/internal/handler"
	"github.com/scridddhub/backend/internal/infrapipeline"
	infrasetup "github.com/scridddhub/backend/internal/infrapipeline/setup"
	"github.com/scridddhub/backend/internal/llm"
	"github.com/scridddhub/backend/internal/middleware"
	"github.com/scridddhub/backend/internal/osm"
	"github.com/scridddhub/backend/internal/repository/postgres"
	"github.com/scridddhub/backend/internal/usecase"
)

func main() {
	// Missing .env is fine (e.g. in prod, real env vars are set directly) — only a malformed
	// file that exists is worth failing loudly on, so we just log and continue either way.
	if err := godotenv.Load(); err != nil {
		log.Printf("no .env file loaded (%v) — using process environment as-is", err)
	}

	ctx := context.Background()

	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		databaseURL = "postgres://scridddhub:scridddhub_dev@localhost:5434/scridddhub?sslmode=disable"
	}

	pool, err := postgres.NewPool(ctx, databaseURL)
	if err != nil {
		log.Fatalf("connecting to database: %v", err)
	}
	defer pool.Close()

	groqAPIKey := os.Getenv("GROQ_API_KEY")
	if groqAPIKey == "" {
		log.Fatal("GROQ_API_KEY is required (used for Screen 7's site-text extraction)")
	}
	siteExtractor := llm.NewGroqSiteExtractor(groqAPIKey)
	landValueEstimator := llm.NewGroqLandEstimator(groqAPIKey)

	projectRepo := postgres.NewProjectRepository(pool)
	landParcelRepo := postgres.NewLandParcelRepository(pool)
	feasibilityAssessmentRepo := postgres.NewFeasibilityAssessmentRepository(pool)
	legalCheckRepo := postgres.NewLegalCheckRepository(pool)
	governmentApprovalRepo := postgres.NewGovernmentApprovalRepository(pool)
	landTenureRepo := postgres.NewLandTenureRepository(pool)
	financialStructureRepo := postgres.NewFinancialStructureRepository(pool)
	escrowAccountRepo := postgres.NewEscrowAccountRepository(pool)
	certificationPacketRepo := postgres.NewCertificationPacketRepository(pool)
	lenderCovenantRepo := postgres.NewLenderCovenantRepository(pool)
	accountingSyncRepo := postgres.NewAccountingSyncRepository(pool)
	gstFilingRepo := postgres.NewGSTFilingRepository(pool)
	tdsFilingRepo := postgres.NewTDSFilingRepository(pool)
	tpaReportRepo := postgres.NewTPAReportRepository(pool)
	litigationCaseRepo := postgres.NewLitigationCaseRepository(pool)
	riskRegisterEntryRepo := postgres.NewRiskRegisterEntryRepository(pool)
	tenderRepo := postgres.NewTenderRepository(pool)
	tenderBidRepo := postgres.NewTenderBidRepository(pool)
	masterScheduleRepo := postgres.NewMasterScheduleRepository(pool)
	auditLogRepo := postgres.NewAuditLogRepository(pool)
	readyReckonerRateRepo := postgres.NewReadyReckonerRateRepository(pool)
	pricingPoolRepo := postgres.NewPricingPoolRepository(pool)
	geographyRepo := postgres.NewGeographyRepository(pool)
	infrastructureProjectRepo := postgres.NewInfrastructureProjectRepository(pool)

	projectHandler := handler.NewProjectHandler(usecase.NewProjectUsecase(projectRepo))
	landParcelHandler := handler.NewLandParcelHandler(usecase.NewLandParcelUsecase(landParcelRepo))
	feasibilityAssessmentHandler := handler.NewFeasibilityAssessmentHandler(usecase.NewFeasibilityAssessmentUsecase(feasibilityAssessmentRepo))
	legalCheckHandler := handler.NewLegalCheckHandler(usecase.NewLegalCheckUsecase(legalCheckRepo))
	governmentApprovalHandler := handler.NewGovernmentApprovalHandler(usecase.NewGovernmentApprovalUsecase(governmentApprovalRepo, siteExtractor))
	landTenureHandler := handler.NewLandTenureHandler(usecase.NewLandTenureUsecase(landTenureRepo))
	financialStructureHandler := handler.NewFinancialStructureHandler(usecase.NewFinancialStructureUsecase(financialStructureRepo))
	escrowAccountHandler := handler.NewEscrowAccountHandler(usecase.NewEscrowAccountUsecase(escrowAccountRepo))
	certificationPacketHandler := handler.NewCertificationPacketHandler(usecase.NewCertificationPacketUsecase(certificationPacketRepo))
	lenderCovenantHandler := handler.NewLenderCovenantHandler(usecase.NewLenderCovenantUsecase(lenderCovenantRepo))
	accountingSyncHandler := handler.NewAccountingSyncHandler(usecase.NewAccountingSyncUsecase(accountingSyncRepo))
	gstFilingHandler := handler.NewGSTFilingHandler(usecase.NewGSTFilingUsecase(gstFilingRepo))
	tdsFilingHandler := handler.NewTDSFilingHandler(usecase.NewTDSFilingUsecase(tdsFilingRepo))
	tpaReportHandler := handler.NewTPAReportHandler(usecase.NewTPAReportUsecase(tpaReportRepo))
	litigationCaseHandler := handler.NewLitigationCaseHandler(usecase.NewLitigationCaseUsecase(litigationCaseRepo))
	riskRegisterEntryHandler := handler.NewRiskRegisterEntryHandler(usecase.NewRiskRegisterEntryUsecase(riskRegisterEntryRepo))
	tenderHandler := handler.NewTenderHandler(usecase.NewTenderUsecase(tenderRepo))
	tenderBidHandler := handler.NewTenderBidHandler(usecase.NewTenderBidUsecase(tenderBidRepo))
	masterScheduleHandler := handler.NewMasterScheduleHandler(usecase.NewMasterScheduleUsecase(masterScheduleRepo))
	auditLogHandler := handler.NewAuditLogHandler(usecase.NewAuditLogUsecase(auditLogRepo))
	readyReckonerRateHandler := handler.NewReadyReckonerRateHandler(usecase.NewEstimateParcelValueUsecase(readyReckonerRateRepo))
	pricingPoolHandler := handler.NewPricingPoolHandler(usecase.NewPricingPoolUsecase(pricingPoolRepo))
	geographyHandler := handler.NewGeographyHandler(usecase.NewGeographyUsecase(geographyRepo))
	aiLandEstimateHandler := handler.NewAILandEstimateHandler(usecase.NewAILandEstimateUsecase(landValueEstimator, readyReckonerRateRepo))
	// Step C: a lookup of an area with nothing nearby on file queues it and wakes a single
	// background worker that searches official sources for it (results land as pending/approved
	// per INFRA_PUBLISH_POLICY). Set INFRA_ONDEMAND=off to only queue (the scheduled job still
	// searches the queue) — e.g. to keep the LLM's daily quota for scheduled runs.
	plannedInfrastructureUC := usecase.NewPlannedInfrastructureUsecase(landParcelRepo, infrastructureProjectRepo, geo.NewNominatimGeocoder(), postgres.NewGeocodeCacheRepository(pool))
	infraBuilt, err := infrasetup.New(pool, groqAPIKey, "", log.Printf)
	if err != nil {
		log.Fatalf("setting up infrastructure pipeline: %v", err)
	}
	var wakeAreaWorker func(string)
	if os.Getenv("INFRA_ONDEMAND") != "off" {
		areaWorker := infrapipeline.NewAreaWorker(infraBuilt.Pipeline, infraBuilt.Store, infraBuilt.Discoverer)
		go areaWorker.Run(ctx)
		wakeAreaWorker = func(cell string) {
			log.Printf("area %s queued for an on-demand infrastructure search", cell)
			areaWorker.Wake()
		}
	}
	plannedInfrastructureUC.WithCoverage(infraBuilt.Store, wakeAreaWorker)
	// Existing schools, hospitals, landfills, power lines... from OpenStreetMap (Overpass), cached
	// per ~1 km cell. A cold area waits up to 12 s, then fills in on the next lookup.
	// OVERPASS_URLS (comma-separated) adds or replaces endpoints; OSM_NEARBY=off disables it.
	if os.Getenv("OSM_NEARBY") != "off" {
		var endpoints []string
		for _, u := range strings.Split(os.Getenv("OVERPASS_URLS"), ",") {
			if u = strings.TrimSpace(u); u != "" {
				endpoints = append(endpoints, u)
			}
		}
		plannedInfrastructureUC.WithNearbyPlaces(osm.NewFinder(osm.NewOverpass(endpoints), postgres.NewOSMPlaceCache(pool), 12*time.Second))
	}
	plannedInfrastructureHandler := handler.NewPlannedInfrastructureHandler(plannedInfrastructureUC)

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ok"))
	})

	mux.HandleFunc("POST /projects", projectHandler.Create)
	mux.HandleFunc("GET /projects/{id}", projectHandler.Get)
	mux.HandleFunc("GET /projects/{projectID}/land-parcels", landParcelHandler.ListByProject)

	// Real, complete Maharashtra geography (docs/adr/0006) — 36 districts/358 talukas/44,918
	// villages from the government's own Common Village Master API, decoupled from which villages
	// happen to have a Ready Reckoner rate on file. This is the picker's real source now.
	mux.HandleFunc("GET /reference/geography/districts", geographyHandler.ListDistricts)
	mux.HandleFunc("GET /reference/geography/talukas", geographyHandler.ListTalukas)
	mux.HandleFunc("GET /reference/geography/villages", geographyHandler.ListVillages)
	// Free-text village search — powers a single search field on Screen 4.2 instead of three
	// cascading district/taluka/village pickers.
	mux.HandleFunc("GET /reference/geography/villages/search", geographyHandler.SearchVillages)

	// Estimate Value (services/estimatedparcelvalue): standalone, location-based valuation from
	// Maharashtra Ready Reckoner Rate reference data — never a comparison against other parcels
	// (docs/adr/0004). Not project-scoped: the estimate depends only on the location entered, not
	// on which project it's for.
	mux.HandleFunc("GET /land-parcels/estimate-value", readyReckonerRateHandler.Estimate)
	// Fallback for a location that isn't in the real geography/Ready Reckoner data yet — an
	// UNVERIFIED LLM guess (Groq), used to keep the product moving while real market data is
	// gathered separately. Never present this as equivalent to the government-data-backed
	// estimate above (see internal/usecase/ai_land_estimator.go doc comment).
	mux.HandleFunc("GET /land-parcels/estimate-value/ai", aiLandEstimateHandler.Estimate)

	// Pooled closed-transaction data (docs/adr/0005): real infrastructure for a future pricing
	// model, not wired to any mobile UI yet — same "built for a future consumer" pattern as
	// EscrowAccount's bank-feed endpoint. Deliberately no project/org scoping on this route.
	mux.HandleFunc("GET /reference/pricing-pool/closed-transactions", pricingPoolHandler.ListClosedTransactions)

	mux.HandleFunc("POST /land-parcels", landParcelHandler.Create)
	mux.HandleFunc("GET /land-parcels/{id}", landParcelHandler.Get)
	mux.HandleFunc("PATCH /land-parcels/{id}/stage", landParcelHandler.UpdateStage)
	mux.HandleFunc("POST /land-parcels/{id}/verify-source", landParcelHandler.VerifySource)
	mux.HandleFunc("POST /land-parcels/{id}/close", landParcelHandler.RecordClosedPrice)

	mux.HandleFunc("PUT /land-parcels/{parcelID}/feasibility-assessment", feasibilityAssessmentHandler.Upsert)
	mux.HandleFunc("GET /land-parcels/{parcelID}/feasibility-assessment", feasibilityAssessmentHandler.Get)

	// Screen 5 "Planned Infrastructure": projects from the shared, manually verified reference list
	// (migration 000028) that serve this parcel's taluka. Read-only.
	mux.HandleFunc("GET /land-parcels/{parcelID}/planned-infrastructure", plannedInfrastructureHandler.ForParcel)
	// Same lookup for any typed location, before a parcel exists (see services/plannedinfrastructure).
	mux.HandleFunc("GET /reference/planned-infrastructure", plannedInfrastructureHandler.ForLocation)

	mux.HandleFunc("PUT /land-parcels/{parcelID}/legal-check", legalCheckHandler.Upsert)
	mux.HandleFunc("GET /land-parcels/{parcelID}/legal-check", legalCheckHandler.Get)

	mux.HandleFunc("POST /land-parcels/{parcelID}/approvals/analyze", governmentApprovalHandler.Analyze)
	mux.HandleFunc("GET /land-parcels/{parcelID}/approvals", governmentApprovalHandler.List)
	mux.HandleFunc("GET /land-parcels/{parcelID}/site-summary", governmentApprovalHandler.GetSiteSummary)

	mux.HandleFunc("PUT /projects/{projectID}/land-tenure", landTenureHandler.Upsert)
	mux.HandleFunc("GET /projects/{projectID}/land-tenure", landTenureHandler.Get)

	mux.HandleFunc("PUT /projects/{projectID}/financial-structure", financialStructureHandler.Upsert)
	mux.HandleFunc("GET /projects/{projectID}/financial-structure", financialStructureHandler.Get)

	mux.HandleFunc("GET /projects/{projectID}/escrow-account", escrowAccountHandler.Get)
	mux.HandleFunc("PUT /projects/{projectID}/escrow-account/developer-ledger", escrowAccountHandler.UpdateDeveloperLedger)
	// Bank feed: for a real bank statement-fetch integration to call, not the mobile app — see
	// migration 000011's comment.
	mux.HandleFunc("PUT /projects/{projectID}/escrow-account/bank-feed", escrowAccountHandler.UpdateBankFeed)

	mux.HandleFunc("POST /projects/{projectID}/certification-packets", certificationPacketHandler.Create)
	mux.HandleFunc("GET /projects/{projectID}/certification-packets/{year}/{quarter}", certificationPacketHandler.Get)
	mux.HandleFunc("POST /certification-packets/{packetID}/send-to-professionals", certificationPacketHandler.SendToProfessionals)
	mux.HandleFunc("PUT /certification-packets/{packetID}/engineer-draft", certificationPacketHandler.UpsertEngineerDraft)
	mux.HandleFunc("POST /certification-packets/{packetID}/engineer-draft/sign", certificationPacketHandler.SignEngineerDraft)
	mux.HandleFunc("POST /certification-packets/{packetID}/architect-certificate/schedule-site-visit", certificationPacketHandler.ScheduleSiteVisit)
	mux.HandleFunc("POST /certification-packets/{packetID}/architect-certificate/complete-site-visit", certificationPacketHandler.CompleteSiteVisit)
	mux.HandleFunc("POST /certification-packets/{packetID}/architect-certificate/certify", certificationPacketHandler.CertifyArchitect)
	mux.HandleFunc("PUT /certification-packets/{packetID}/ca-draft", certificationPacketHandler.UpsertCADraft)
	mux.HandleFunc("POST /certification-packets/{packetID}/ca-draft/sign", certificationPacketHandler.SignCADraft)

	mux.HandleFunc("PUT /projects/{projectID}/lender-covenant", lenderCovenantHandler.Upsert)
	mux.HandleFunc("GET /projects/{projectID}/lender-covenant", lenderCovenantHandler.Get)

	mux.HandleFunc("PUT /projects/{projectID}/accounting-sync", accountingSyncHandler.Upsert)
	mux.HandleFunc("GET /projects/{projectID}/accounting-sync", accountingSyncHandler.Get)

	mux.HandleFunc("PUT /projects/{projectID}/gst-filings", gstFilingHandler.Upsert)
	mux.HandleFunc("GET /projects/{projectID}/gst-filings/{year}/{quarter}", gstFilingHandler.Get)

	mux.HandleFunc("PUT /projects/{projectID}/tds-filings", tdsFilingHandler.Upsert)
	mux.HandleFunc("GET /projects/{projectID}/tds-filings/{year}/{quarter}", tdsFilingHandler.Get)

	mux.HandleFunc("PUT /projects/{projectID}/tpa-reports", tpaReportHandler.Upsert)
	mux.HandleFunc("GET /projects/{projectID}/tpa-reports/{lenderName}/{year}/{quarter}", tpaReportHandler.Get)
	mux.HandleFunc("POST /tpa-reports/{reportID}/submit", tpaReportHandler.MarkSubmitted)

	mux.HandleFunc("POST /orgs/{orgID}/litigation-cases", litigationCaseHandler.Create)
	mux.HandleFunc("GET /orgs/{orgID}/litigation-cases", litigationCaseHandler.ListByOrg)
	mux.HandleFunc("PATCH /litigation-cases/{caseID}/status", litigationCaseHandler.UpdateStatus)

	mux.HandleFunc("PUT /projects/{projectID}/risk-register", riskRegisterEntryHandler.Upsert)
	mux.HandleFunc("GET /projects/{projectID}/risk-register", riskRegisterEntryHandler.ListByProject)

	mux.HandleFunc("POST /projects/{projectID}/tenders", tenderHandler.Create)
	mux.HandleFunc("GET /projects/{projectID}/tenders", tenderHandler.ListByProject)
	mux.HandleFunc("POST /tenders/{tenderID}/bids", tenderBidHandler.Create)
	mux.HandleFunc("GET /tenders/{tenderID}/bids", tenderBidHandler.ListByTender)
	mux.HandleFunc("PATCH /tender-bids/{bidID}", tenderBidHandler.Update)

	mux.HandleFunc("POST /projects/{projectID}/master-schedule", masterScheduleHandler.Create)
	mux.HandleFunc("GET /projects/{projectID}/master-schedule", masterScheduleHandler.GetByProject)
	mux.HandleFunc("PATCH /master-schedule-milestones/{milestoneID}", masterScheduleHandler.UpdateMilestone)
	mux.HandleFunc("POST /master-schedules/{scheduleID}/confirm", masterScheduleHandler.Confirm)

	mux.HandleFunc("GET /audit-log", auditLogHandler.ListRecent)

	mux.HandleFunc("PATCH /approvals/{approvalID}/status", governmentApprovalHandler.UpdateStatus)

	addr := ":8080"
	if port := os.Getenv("PORT"); port != "" {
		addr = ":" + port
	}

	log.Printf("scridddhub backend listening on %s", addr)
	if err := http.ListenAndServe(addr, middleware.RequestLog(middleware.StubAuth(mux))); err != nil {
		log.Fatal(err)
	}
}
