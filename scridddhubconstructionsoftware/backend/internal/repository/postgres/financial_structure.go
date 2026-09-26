package postgres

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/scridddhub/backend/internal/domain"
)

type FinancialStructureRepository struct {
	pool *pgxpool.Pool
}

func NewFinancialStructureRepository(pool *pgxpool.Pool) *FinancialStructureRepository {
	return &FinancialStructureRepository{pool: pool}
}

const financialStructureSelectCols = `
	id, project_id,
	buyer_collections_rupees, promoter_equity_rupees, construction_finance_rupees,
	construction_use_rupees, land_use_rupees, approvals_use_rupees,
	marketing_use_rupees, working_capital_use_rupees,
	created_at, updated_at
`

func (r *FinancialStructureRepository) Upsert(ctx context.Context, actor string, structure *domain.FinancialStructure) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	before, err := scanFinancialStructure(tx.QueryRow(ctx, `
		SELECT `+financialStructureSelectCols+`
		FROM financial_structures
		WHERE project_id = $1
		FOR UPDATE
	`, structure.ProjectID))
	action := "update"
	if err == domain.ErrNotFound {
		before = nil
		action = "insert"
	} else if err != nil {
		return err
	}

	row := tx.QueryRow(ctx, `
		INSERT INTO financial_structures (
			project_id,
			buyer_collections_rupees, promoter_equity_rupees, construction_finance_rupees,
			construction_use_rupees, land_use_rupees, approvals_use_rupees,
			marketing_use_rupees, working_capital_use_rupees
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		ON CONFLICT (project_id) DO UPDATE SET
			buyer_collections_rupees = EXCLUDED.buyer_collections_rupees,
			promoter_equity_rupees = EXCLUDED.promoter_equity_rupees,
			construction_finance_rupees = EXCLUDED.construction_finance_rupees,
			construction_use_rupees = EXCLUDED.construction_use_rupees,
			land_use_rupees = EXCLUDED.land_use_rupees,
			approvals_use_rupees = EXCLUDED.approvals_use_rupees,
			marketing_use_rupees = EXCLUDED.marketing_use_rupees,
			working_capital_use_rupees = EXCLUDED.working_capital_use_rupees,
			updated_at = now()
		RETURNING id, created_at, updated_at
	`, structure.ProjectID,
		structure.BuyerCollectionsRupees, structure.PromoterEquityRupees, structure.ConstructionFinanceRupees,
		structure.ConstructionUseRupees, structure.LandUseRupees, structure.ApprovalsUseRupees,
		structure.MarketingUseRupees, structure.WorkingCapitalUseRupees)
	if err := row.Scan(&structure.ID, &structure.CreatedAt, &structure.UpdatedAt); err != nil {
		return err
	}

	if err := writeAudit(ctx, tx, "financial_structures", structure.ID, action, actor, before, structure); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

func (r *FinancialStructureRepository) GetByProject(ctx context.Context, projectID uuid.UUID) (*domain.FinancialStructure, error) {
	row := r.pool.QueryRow(ctx, `
		SELECT `+financialStructureSelectCols+`
		FROM financial_structures
		WHERE project_id = $1
	`, projectID)
	return scanFinancialStructure(row)
}

func scanFinancialStructure(row rowScanner) (*domain.FinancialStructure, error) {
	var f domain.FinancialStructure
	err := row.Scan(&f.ID, &f.ProjectID,
		&f.BuyerCollectionsRupees, &f.PromoterEquityRupees, &f.ConstructionFinanceRupees,
		&f.ConstructionUseRupees, &f.LandUseRupees, &f.ApprovalsUseRupees,
		&f.MarketingUseRupees, &f.WorkingCapitalUseRupees,
		&f.CreatedAt, &f.UpdatedAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}
	return &f, nil
}
