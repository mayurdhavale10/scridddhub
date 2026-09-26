package postgres

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/scridddhub/backend/internal/domain"
)

type GovernmentApprovalRepository struct {
	pool *pgxpool.Pool
}

func NewGovernmentApprovalRepository(pool *pgxpool.Pool) *GovernmentApprovalRepository {
	return &GovernmentApprovalRepository{pool: pool}
}

func (r *GovernmentApprovalRepository) GetPlaybook(ctx context.Context, state string) ([]domain.ApprovalPlaybookEntry, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, state, sequence_order, approval_name, COALESCE(description, ''), applicability_condition
		FROM approval_playbooks
		WHERE state = $1
		ORDER BY sequence_order
	`, state)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var entries []domain.ApprovalPlaybookEntry
	for rows.Next() {
		var e domain.ApprovalPlaybookEntry
		if err := rows.Scan(&e.ID, &e.State, &e.SequenceOrder, &e.ApprovalName, &e.Description, &e.ApplicabilityCondition); err != nil {
			return nil, err
		}
		entries = append(entries, e)
	}
	return entries, rows.Err()
}

const siteSummarySelectCols = `
	id, land_parcel_id, state, free_text,
	near_airport, coastal_site, significant_tree_cover, uses_groundwater, unit_count,
	created_at, updated_at
`

func (r *GovernmentApprovalRepository) UpsertSiteSummary(ctx context.Context, actor string, summary *domain.LandParcelSiteSummary) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	before, err := scanSiteSummary(tx.QueryRow(ctx, `
		SELECT `+siteSummarySelectCols+`
		FROM land_parcel_site_summaries
		WHERE land_parcel_id = $1
		FOR UPDATE
	`, summary.LandParcelID))
	action := "update"
	if err == domain.ErrNotFound {
		before = nil
		action = "insert"
	} else if err != nil {
		return err
	}

	c := summary.Characteristics
	row := tx.QueryRow(ctx, `
		INSERT INTO land_parcel_site_summaries (
			land_parcel_id, state, free_text,
			near_airport, coastal_site, significant_tree_cover, uses_groundwater, unit_count
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		ON CONFLICT (land_parcel_id) DO UPDATE SET
			state = EXCLUDED.state,
			free_text = EXCLUDED.free_text,
			near_airport = EXCLUDED.near_airport,
			coastal_site = EXCLUDED.coastal_site,
			significant_tree_cover = EXCLUDED.significant_tree_cover,
			uses_groundwater = EXCLUDED.uses_groundwater,
			unit_count = EXCLUDED.unit_count,
			updated_at = now()
		RETURNING id, created_at, updated_at
	`, summary.LandParcelID, summary.State, summary.FreeText,
		c.NearAirport, c.CoastalSite, c.SignificantTreeCover, c.UsesGroundwater, c.UnitCount)
	if err := row.Scan(&summary.ID, &summary.CreatedAt, &summary.UpdatedAt); err != nil {
		return err
	}

	if err := writeAudit(ctx, tx, "land_parcel_site_summaries", summary.ID, action, actor, before, summary); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

func (r *GovernmentApprovalRepository) GetSiteSummary(ctx context.Context, landParcelID uuid.UUID) (*domain.LandParcelSiteSummary, error) {
	row := r.pool.QueryRow(ctx, `
		SELECT `+siteSummarySelectCols+`
		FROM land_parcel_site_summaries
		WHERE land_parcel_id = $1
	`, landParcelID)
	return scanSiteSummary(row)
}

func scanSiteSummary(row rowScanner) (*domain.LandParcelSiteSummary, error) {
	var s domain.LandParcelSiteSummary
	c := &s.Characteristics
	err := row.Scan(&s.ID, &s.LandParcelID, &s.State, &s.FreeText,
		&c.NearAirport, &c.CoastalSite, &c.SignificantTreeCover, &c.UsesGroundwater, &c.UnitCount,
		&s.CreatedAt, &s.UpdatedAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}
	return &s, nil
}

const approvalSelectCols = `
	a.id, a.land_parcel_id, a.approval_playbook_id, a.status, a.submitted_at,
	p.sequence_order, p.approval_name, COALESCE(p.description, ''), p.applicability_condition,
	a.created_at, a.updated_at
`

func (r *GovernmentApprovalRepository) ListApprovals(ctx context.Context, landParcelID uuid.UUID) ([]*domain.LandParcelApproval, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT `+approvalSelectCols+`
		FROM land_parcel_approvals a
		JOIN approval_playbooks p ON p.id = a.approval_playbook_id
		WHERE a.land_parcel_id = $1
		ORDER BY p.sequence_order
	`, landParcelID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var approvals []*domain.LandParcelApproval
	for rows.Next() {
		a, err := scanApproval(rows)
		if err != nil {
			return nil, err
		}
		approvals = append(approvals, a)
	}
	return approvals, rows.Err()
}

func (r *GovernmentApprovalRepository) GetApprovalByPlaybookEntry(ctx context.Context, landParcelID, playbookID uuid.UUID) (*domain.LandParcelApproval, error) {
	row := r.pool.QueryRow(ctx, `
		SELECT `+approvalSelectCols+`
		FROM land_parcel_approvals a
		JOIN approval_playbooks p ON p.id = a.approval_playbook_id
		WHERE a.land_parcel_id = $1 AND a.approval_playbook_id = $2
	`, landParcelID, playbookID)
	return scanApproval(row)
}

func (r *GovernmentApprovalRepository) UpsertApproval(ctx context.Context, actor string, approval *domain.LandParcelApproval) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	action := "insert"
	var before *domain.LandParcelApproval
	if approval.ID != uuid.Nil {
		action = "update"
		before, err = scanApproval(tx.QueryRow(ctx, `
			SELECT `+approvalSelectCols+`
			FROM land_parcel_approvals a
			JOIN approval_playbooks p ON p.id = a.approval_playbook_id
			WHERE a.id = $1
			FOR UPDATE
		`, approval.ID))
		if err != nil {
			return err
		}
	}

	row := tx.QueryRow(ctx, `
		INSERT INTO land_parcel_approvals (land_parcel_id, approval_playbook_id, status, submitted_at)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (land_parcel_id, approval_playbook_id) DO UPDATE SET
			status = EXCLUDED.status,
			submitted_at = EXCLUDED.submitted_at,
			updated_at = now()
		RETURNING id, created_at, updated_at
	`, approval.LandParcelID, approval.ApprovalPlaybookID, approval.Status, approval.SubmittedAt)
	if err := row.Scan(&approval.ID, &approval.CreatedAt, &approval.UpdatedAt); err != nil {
		return err
	}

	if err := writeAudit(ctx, tx, "land_parcel_approvals", approval.ID, action, actor, before, approval); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

func (r *GovernmentApprovalRepository) UpdateApprovalStatus(ctx context.Context, actor string, approvalID uuid.UUID, status domain.ApprovalStatus, submittedAt *time.Time) (*domain.LandParcelApproval, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	before, err := scanApproval(tx.QueryRow(ctx, `
		SELECT `+approvalSelectCols+`
		FROM land_parcel_approvals a
		JOIN approval_playbooks p ON p.id = a.approval_playbook_id
		WHERE a.id = $1
		FOR UPDATE
	`, approvalID))
	if err != nil {
		return nil, err
	}

	after := *before
	after.Status = status
	after.SubmittedAt = submittedAt

	row := tx.QueryRow(ctx, `
		UPDATE land_parcel_approvals
		SET status = $1, submitted_at = $2, updated_at = now()
		WHERE id = $3
		RETURNING updated_at
	`, status, submittedAt, approvalID)
	if err := row.Scan(&after.UpdatedAt); err != nil {
		return nil, err
	}

	if err := writeAudit(ctx, tx, "land_parcel_approvals", approvalID, "update", actor, before, &after); err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return &after, nil
}

func scanApproval(row rowScanner) (*domain.LandParcelApproval, error) {
	var a domain.LandParcelApproval
	err := row.Scan(&a.ID, &a.LandParcelID, &a.ApprovalPlaybookID, &a.Status, &a.SubmittedAt,
		&a.SequenceOrder, &a.ApprovalName, &a.Description, &a.ApplicabilityCondition,
		&a.CreatedAt, &a.UpdatedAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}
	return &a, nil
}
