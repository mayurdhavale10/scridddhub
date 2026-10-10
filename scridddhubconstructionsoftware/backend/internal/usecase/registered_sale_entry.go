package usecase

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/scridddhub/backend/internal/domain"
	"github.com/scridddhub/backend/internal/transactionpipeline"
)

// Entering a registered sale by hand, from an Index-II copy (the registration office's record of a
// deed). This is how the Due-Diligence Report's valuation gets real evidence while no automatic
// collector exists: our team searches Index-II for the village (a person types the captcha) and
// enters each land sale. The raw entry is archived as the sale's evidence record, like an import.

type SaleRecorder interface {
	ResolveVillage(ctx context.Context, district, taluka, village string) (districtCode, talukaCode, villageCode string, err error)
	SaveTransactionSource(ctx context.Context, s transactionpipeline.SourceRecord) (string, error)
	SaveRegisteredTransaction(ctx context.Context, t domain.RegisteredTransaction) error
}

type ManualSale struct {
	District, Taluka, Village string
	SurveyNo                  string
	RegistrationDate          time.Time
	DocumentNo                string // Index-II document (dast) number
	OfficeName                string // Sub-Registrar office, e.g. "Karjat"
	PropertyType              string // land | plot
	AreaAcres                 float64
	SalePriceRupees           int64
	GovernmentValueRupees     *int64 // market value per the registration (ready-reckoner based), if shown
	Comparable                bool   // a plain arm's-length sale of land like this parcel
	ExclusionReason           string // why not comparable (family transfer, part share, bundle…)
	Notes                     string
}

func (m ManualSale) validate(now time.Time) error {
	switch {
	case strings.TrimSpace(m.District) == "" || strings.TrimSpace(m.Taluka) == "" || strings.TrimSpace(m.Village) == "":
		return fmt.Errorf("district, taluka and village are required")
	case strings.TrimSpace(m.DocumentNo) == "" || strings.TrimSpace(m.OfficeName) == "":
		return fmt.Errorf("document number and Sub-Registrar office are required (from Index-II)")
	case m.PropertyType != "land" && m.PropertyType != "plot":
		return fmt.Errorf("property type must be land or plot")
	case m.AreaAcres <= 0:
		return fmt.Errorf("area must be positive")
	case m.SalePriceRupees <= 0:
		return fmt.Errorf("sale price must be positive")
	case m.RegistrationDate.IsZero() || m.RegistrationDate.After(now):
		return fmt.Errorf("registration date is required and can't be in the future")
	case !m.Comparable && strings.TrimSpace(m.ExclusionReason) == "":
		return fmt.Errorf("say why the sale isn't comparable")
	}
	return nil
}

type RegisteredSaleEntryUsecase struct {
	store SaleRecorder
	now   func() time.Time
}

func NewRegisteredSaleEntryUsecase(s SaleRecorder) *RegisteredSaleEntryUsecase {
	return &RegisteredSaleEntryUsecase{store: s, now: time.Now}
}

// Record saves one reviewed sale. The person entering it is its reviewer.
func (u *RegisteredSaleEntryUsecase) Record(ctx context.Context, actor string, m ManualSale) error {
	if err := m.validate(u.now()); err != nil {
		return err
	}
	dc, tc, vc, err := u.store.ResolveVillage(ctx, m.District, m.Taluka, m.Village)
	if err != nil {
		return fmt.Errorf("village not found in the Maharashtra village list: %w", err)
	}
	raw, err := json.Marshal(struct {
		ManualSale
		EnteredBy string `json:"entered_by"`
	}{m, actor})
	if err != nil {
		return err
	}
	text := string(raw)
	sourceID, err := u.store.SaveTransactionSource(ctx, transactionpipeline.SourceRecord{
		Source:    "index_ii_manual",
		Reference: m.OfficeName + "/" + m.DocumentNo + "/" + m.RegistrationDate.Format("2006"),
		URL:       "",
		FetchedAt: u.now(),
		Hash:      fmt.Sprintf("%x", sha256.Sum256(raw)),
		RawText:   &text,
	})
	if err != nil {
		return err
	}
	exclusion := ""
	if !m.Comparable {
		exclusion = m.ExclusionReason
	}
	return u.store.SaveRegisteredTransaction(ctx, domain.RegisteredTransaction{
		RegistrationDate: m.RegistrationDate, DocumentNo: strings.TrimSpace(m.DocumentNo),
		OfficeCode: strings.ToLower(strings.TrimSpace(m.OfficeName)), OfficeName: strings.TrimSpace(m.OfficeName),
		DistrictCode: dc, TalukaCode: tc, VillageCode: vc, SurveyNo: strings.TrimSpace(m.SurveyNo),
		PropertyType: m.PropertyType, DeedType: "sale", AreaAcres: m.AreaAcres,
		SalePriceRupees: m.SalePriceRupees, GovernmentValueRupees: m.GovernmentValueRupees,
		LocationMethod: "unknown", Comparable: m.Comparable, ExclusionReason: exclusion,
		ReviewedBy: actor, Source: "index_ii_manual", SourceRecordID: sourceID,
	})
}
