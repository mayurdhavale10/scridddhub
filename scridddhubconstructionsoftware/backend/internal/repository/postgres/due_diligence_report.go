package postgres

import (
	"context"
	"encoding/json"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/scridddhub/backend/internal/domain"
)

// DueDiligenceReportRepository stores report orders (migration 046). Every change is audited.
type DueDiligenceReportRepository struct {
	pool *pgxpool.Pool
}

func NewDueDiligenceReportRepository(pool *pgxpool.Pool) *DueDiligenceReportRepository {
	return &DueDiligenceReportRepository{pool: pool}
}

const reportSelectCols = `
	id, land_parcel_id, tier, status,
	occupancy_class, na_status, COALESCE(tenancy_remarks, ''), COALESCE(crz_forest_esz, ''),
	COALESCE(dp_zone, ''), COALESCE(dp_reservation, ''),
	base_fsi, max_fsi, COALESCE(development_note, ''),
	COALESCE(verdict, ''), COALESCE(verdict_summary, ''), fix_list,
	COALESCE(verdict_source, ''), COALESCE(verdict_model, ''),
	COALESCE(advocate_name, ''), COALESCE(advocate_enrolment, ''), finalised_at, frozen_report,
	created_at, updated_at, COALESCE(planning_authority, ''), road_width_m, builder_calc, COALESCE(issued_by, '')
`

func nullable(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func (r *DueDiligenceReportRepository) Create(ctx context.Context, actor string, rep *domain.DueDiligenceReport) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	row := tx.QueryRow(ctx, `
		INSERT INTO due_diligence_reports (land_parcel_id, tier, status, occupancy_class, na_status)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, created_at, updated_at
	`, rep.LandParcelID, rep.Tier, rep.Status, rep.OccupancyClass, rep.NAStatus)
	if err := row.Scan(&rep.ID, &rep.CreatedAt, &rep.UpdatedAt); err != nil {
		return err
	}
	if err := writeAudit(ctx, tx, "due_diligence_reports", rep.ID, "insert", actor, nil, rep); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (r *DueDiligenceReportRepository) Get(ctx context.Context, id uuid.UUID) (*domain.DueDiligenceReport, error) {
	return scanReport(r.pool.QueryRow(ctx, `SELECT `+reportSelectCols+` FROM due_diligence_reports WHERE id = $1`, id))
}

func (r *DueDiligenceReportRepository) ListByParcel(ctx context.Context, parcelID uuid.UUID) ([]*domain.DueDiligenceReport, error) {
	rows, err := r.pool.Query(ctx, `SELECT `+reportSelectCols+` FROM due_diligence_reports
		WHERE land_parcel_id = $1 ORDER BY created_at DESC`, parcelID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []*domain.DueDiligenceReport{}
	for rows.Next() {
		rep, err := scanReport(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, rep)
	}
	return out, rows.Err()
}

func (r *DueDiligenceReportRepository) Update(ctx context.Context, actor string, rep *domain.DueDiligenceReport) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	before, err := scanReport(tx.QueryRow(ctx, `SELECT `+reportSelectCols+` FROM due_diligence_reports WHERE id = $1 FOR UPDATE`, rep.ID))
	if err != nil {
		return err
	}
	fix, err := json.Marshal(rep.FixList)
	if err != nil {
		return err
	}
	var frozen *string
	if len(rep.FrozenReport) > 0 {
		f := string(rep.FrozenReport)
		frozen = &f
	}
	row := tx.QueryRow(ctx, `
		UPDATE due_diligence_reports SET
			status = $2, occupancy_class = $3, na_status = $4, tenancy_remarks = $5, crz_forest_esz = $6,
			dp_zone = $7, dp_reservation = $8, base_fsi = $9, max_fsi = $10, development_note = $11,
			verdict = $12, verdict_summary = $13, fix_list = $14::jsonb, verdict_source = $15, verdict_model = $16,
			advocate_name = $17, advocate_enrolment = $18, finalised_at = $19, frozen_report = $20::jsonb,
			planning_authority = $21, road_width_m = $22, issued_by = $23,
			updated_at = now()
		WHERE id = $1
		RETURNING updated_at
	`, rep.ID, rep.Status, rep.OccupancyClass, rep.NAStatus, nullable(rep.TenancyRemarks), nullable(rep.CRZForestESZ),
		nullable(rep.DPZone), nullable(rep.DPReservation), rep.BaseFSI, rep.MaxFSI, nullable(rep.DevelopmentNote),
		nullable(rep.Verdict), nullable(rep.VerdictSummary), string(fix), nullable(rep.VerdictSource), nullable(rep.VerdictModel),
		nullable(rep.AdvocateName), nullable(rep.AdvocateEnrolment), rep.FinalisedAt, frozen,
		nullable(rep.PlanningAuthority), rep.RoadWidthM, nullable(rep.IssuedBy))
	if err := row.Scan(&rep.UpdatedAt); err != nil {
		return err
	}
	if err := writeAudit(ctx, tx, "due_diligence_reports", rep.ID, "update", actor, before, rep); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func scanReport(row rowScanner) (*domain.DueDiligenceReport, error) {
	var rep domain.DueDiligenceReport
	var fix, frozen, calc []byte
	err := row.Scan(&rep.ID, &rep.LandParcelID, &rep.Tier, &rep.Status,
		&rep.OccupancyClass, &rep.NAStatus, &rep.TenancyRemarks, &rep.CRZForestESZ,
		&rep.DPZone, &rep.DPReservation,
		&rep.BaseFSI, &rep.MaxFSI, &rep.DevelopmentNote,
		&rep.Verdict, &rep.VerdictSummary, &fix,
		&rep.VerdictSource, &rep.VerdictModel,
		&rep.AdvocateName, &rep.AdvocateEnrolment, &rep.FinalisedAt, &frozen,
		&rep.CreatedAt, &rep.UpdatedAt, &rep.PlanningAuthority, &rep.RoadWidthM, &calc, &rep.IssuedBy)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}
	if err := json.Unmarshal(fix, &rep.FixList); err != nil {
		return nil, err
	}
	if len(frozen) > 0 {
		rep.FrozenReport = frozen
	}
	if len(calc) > 0 {
		rep.BuilderCalc = &domain.BuilderCalcInputs{}
		if err := json.Unmarshal(calc, rep.BuilderCalc); err != nil {
			return nil, err
		}
	}
	return &rep, nil
}

// SetBuilderCalc saves (or, with nil, clears) the report's builder calculation inputs. Audited.
func (r *DueDiligenceReportRepository) SetBuilderCalc(ctx context.Context, actor string, id uuid.UUID, calc *domain.BuilderCalcInputs) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	before, err := scanReport(tx.QueryRow(ctx, `SELECT `+reportSelectCols+` FROM due_diligence_reports WHERE id = $1 FOR UPDATE`, id))
	if err != nil {
		return err
	}
	var data *string
	if calc != nil {
		b, err := json.Marshal(calc)
		if err != nil {
			return err
		}
		s := string(b)
		data = &s
	}
	if _, err := tx.Exec(ctx, `UPDATE due_diligence_reports SET builder_calc = $2::jsonb, updated_at = now() WHERE id = $1`, id, data); err != nil {
		return err
	}
	after := *before
	after.BuilderCalc = calc
	if err := writeAudit(ctx, tx, "due_diligence_reports", id, "update", actor, before, &after); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
