package postgres

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/scridddhub/backend/internal/domain"
)

// --- Tender ---

type TenderRepository struct {
	pool *pgxpool.Pool
}

func NewTenderRepository(pool *pgxpool.Pool) *TenderRepository {
	return &TenderRepository{pool: pool}
}

const tenderSelectCols = `id, project_id, trade_package, created_at, updated_at`

func (r *TenderRepository) Create(ctx context.Context, actor string, t *domain.Tender) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if err := scanTender(tx.QueryRow(ctx, `
		INSERT INTO tenders (project_id, trade_package)
		VALUES ($1, $2)
		RETURNING `+tenderSelectCols,
		t.ProjectID, t.TradePackage), t); err != nil {
		return err
	}

	if err := writeAudit(ctx, tx, "tenders", t.ID, "insert", actor, nil, t); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (r *TenderRepository) ListByProject(ctx context.Context, projectID uuid.UUID) ([]*domain.Tender, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT `+tenderSelectCols+`
		FROM tenders
		WHERE project_id = $1
		ORDER BY created_at DESC
	`, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tenders []*domain.Tender
	for rows.Next() {
		var t domain.Tender
		if err := scanTender(rows, &t); err != nil {
			return nil, err
		}
		tenders = append(tenders, &t)
	}
	return tenders, rows.Err()
}

func scanTender(row rowScanner, t *domain.Tender) error {
	err := row.Scan(&t.ID, &t.ProjectID, &t.TradePackage, &t.CreatedAt, &t.UpdatedAt)
	if err == pgx.ErrNoRows {
		return domain.ErrNotFound
	}
	return err
}

// --- TenderBid ---

type TenderBidRepository struct {
	pool *pgxpool.Pool
}

func NewTenderBidRepository(pool *pgxpool.Pool) *TenderBidRepository {
	return &TenderBidRepository{pool: pool}
}

const tenderBidSelectCols = `
	id, tender_id, contractor_name, past_jobs_with_developer, past_performance_note,
	technical_bid_status, financial_bid_rupees, recommended, created_at, updated_at
`

func (r *TenderBidRepository) Create(ctx context.Context, actor string, b *domain.TenderBid) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if err := scanTenderBid(tx.QueryRow(ctx, `
		INSERT INTO tender_bids (
			tender_id, contractor_name, past_jobs_with_developer, past_performance_note,
			technical_bid_status, financial_bid_rupees, recommended
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING `+tenderBidSelectCols,
		b.TenderID, b.ContractorName, b.PastJobsWithDeveloper, b.PastPerformanceNote,
		b.TechnicalBidStatus, b.FinancialBidRupees, b.Recommended), b); err != nil {
		return err
	}

	if err := writeAudit(ctx, tx, "tender_bids", b.ID, "insert", actor, nil, b); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (r *TenderBidRepository) ListByTender(ctx context.Context, tenderID uuid.UUID) ([]*domain.TenderBid, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT `+tenderBidSelectCols+`
		FROM tender_bids
		WHERE tender_id = $1
		ORDER BY created_at
	`, tenderID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var bids []*domain.TenderBid
	for rows.Next() {
		var b domain.TenderBid
		if err := scanTenderBid(rows, &b); err != nil {
			return nil, err
		}
		bids = append(bids, &b)
	}
	return bids, rows.Err()
}

func (r *TenderBidRepository) Update(ctx context.Context, actor string, id uuid.UUID, status domain.TenderBidTechnicalStatus, financialBidRupees *int64, recommended bool) (*domain.TenderBid, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var before domain.TenderBid
	if err := scanTenderBid(tx.QueryRow(ctx, `
		SELECT `+tenderBidSelectCols+`
		FROM tender_bids
		WHERE id = $1
		FOR UPDATE
	`, id), &before); err != nil {
		return nil, err
	}

	var after domain.TenderBid
	if err := scanTenderBid(tx.QueryRow(ctx, `
		UPDATE tender_bids
		SET technical_bid_status = $1, financial_bid_rupees = $2, recommended = $3, updated_at = now()
		WHERE id = $4
		RETURNING `+tenderBidSelectCols, status, financialBidRupees, recommended, id), &after); err != nil {
		return nil, err
	}

	if err := writeAudit(ctx, tx, "tender_bids", id, "update", actor, &before, &after); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return &after, nil
}

func scanTenderBid(row rowScanner, b *domain.TenderBid) error {
	err := row.Scan(&b.ID, &b.TenderID, &b.ContractorName, &b.PastJobsWithDeveloper, &b.PastPerformanceNote,
		&b.TechnicalBidStatus, &b.FinancialBidRupees, &b.Recommended, &b.CreatedAt, &b.UpdatedAt)
	if err == pgx.ErrNoRows {
		return domain.ErrNotFound
	}
	return err
}
