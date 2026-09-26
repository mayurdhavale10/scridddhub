package postgres

import (
	"context"
	"encoding/json"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/scridddhub/backend/internal/domain"
)

type LegalCheckRepository struct {
	pool *pgxpool.Pool
}

func NewLegalCheckRepository(pool *pgxpool.Pool) *LegalCheckRepository {
	return &LegalCheckRepository{pool: pool}
}

const legalCheckSelectCols = `
	id, land_parcel_id,
	ownership_risk, COALESCE(ownership_risk_note, ''),
	litigation_risk, COALESCE(litigation_risk_note, ''),
	encumbrance_risk, COALESCE(encumbrance_risk_note, ''),
	regulatory_risk, COALESCE(regulatory_risk_note, ''),
	ownership_chain, encumbrance_searches, COALESCE(search_summary_note, ''),
	rera_history, COALESCE(rera_history_summary_note, ''), documents,
	status, created_at, updated_at
`

func (r *LegalCheckRepository) Upsert(ctx context.Context, actor string, check *domain.LegalCheck) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	before, err := scanLegalCheck(tx.QueryRow(ctx, `
		SELECT `+legalCheckSelectCols+`
		FROM legal_checks
		WHERE land_parcel_id = $1
		FOR UPDATE
	`, check.LandParcelID))
	action := "update"
	if err == domain.ErrNotFound {
		before = nil
		action = "insert"
	} else if err != nil {
		return err
	}

	ownershipChainJSON, err := json.Marshal(check.OwnershipChain)
	if err != nil {
		return err
	}
	encumbranceSearchesJSON, err := json.Marshal(check.EncumbranceSearches)
	if err != nil {
		return err
	}
	reraHistoryJSON, err := json.Marshal(check.RERAHistory)
	if err != nil {
		return err
	}
	documentsJSON, err := json.Marshal(check.Documents)
	if err != nil {
		return err
	}

	row := tx.QueryRow(ctx, `
		INSERT INTO legal_checks (
			land_parcel_id,
			ownership_risk, ownership_risk_note,
			litigation_risk, litigation_risk_note,
			encumbrance_risk, encumbrance_risk_note,
			regulatory_risk, regulatory_risk_note,
			ownership_chain, encumbrance_searches, search_summary_note,
			rera_history, rera_history_summary_note, documents,
			status
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb, $12, $13::jsonb, $14, $15::jsonb, $16)
		ON CONFLICT (land_parcel_id) DO UPDATE SET
			ownership_risk = EXCLUDED.ownership_risk,
			ownership_risk_note = EXCLUDED.ownership_risk_note,
			litigation_risk = EXCLUDED.litigation_risk,
			litigation_risk_note = EXCLUDED.litigation_risk_note,
			encumbrance_risk = EXCLUDED.encumbrance_risk,
			encumbrance_risk_note = EXCLUDED.encumbrance_risk_note,
			regulatory_risk = EXCLUDED.regulatory_risk,
			regulatory_risk_note = EXCLUDED.regulatory_risk_note,
			ownership_chain = EXCLUDED.ownership_chain,
			encumbrance_searches = EXCLUDED.encumbrance_searches,
			search_summary_note = EXCLUDED.search_summary_note,
			rera_history = EXCLUDED.rera_history,
			rera_history_summary_note = EXCLUDED.rera_history_summary_note,
			documents = EXCLUDED.documents,
			status = EXCLUDED.status,
			updated_at = now()
		RETURNING id, created_at, updated_at
	`, check.LandParcelID,
		check.OwnershipRisk, check.OwnershipRiskNote,
		check.LitigationRisk, check.LitigationRiskNote,
		check.EncumbranceRisk, check.EncumbranceRiskNote,
		check.RegulatoryRisk, check.RegulatoryRiskNote,
		string(ownershipChainJSON), string(encumbranceSearchesJSON), check.SearchSummaryNote,
		string(reraHistoryJSON), check.RERAHistorySummaryNote, string(documentsJSON),
		check.Status)
	if err := row.Scan(&check.ID, &check.CreatedAt, &check.UpdatedAt); err != nil {
		return err
	}

	if err := writeAudit(ctx, tx, "legal_checks", check.ID, action, actor, before, check); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

func (r *LegalCheckRepository) GetByLandParcel(ctx context.Context, landParcelID uuid.UUID) (*domain.LegalCheck, error) {
	row := r.pool.QueryRow(ctx, `
		SELECT `+legalCheckSelectCols+`
		FROM legal_checks
		WHERE land_parcel_id = $1
	`, landParcelID)
	return scanLegalCheck(row)
}

func scanLegalCheck(row rowScanner) (*domain.LegalCheck, error) {
	var c domain.LegalCheck
	var ownershipChainJSON, encumbranceSearchesJSON, reraHistoryJSON, documentsJSON []byte

	err := row.Scan(
		&c.ID, &c.LandParcelID,
		&c.OwnershipRisk, &c.OwnershipRiskNote,
		&c.LitigationRisk, &c.LitigationRiskNote,
		&c.EncumbranceRisk, &c.EncumbranceRiskNote,
		&c.RegulatoryRisk, &c.RegulatoryRiskNote,
		&ownershipChainJSON, &encumbranceSearchesJSON, &c.SearchSummaryNote,
		&reraHistoryJSON, &c.RERAHistorySummaryNote, &documentsJSON,
		&c.Status, &c.CreatedAt, &c.UpdatedAt,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}

	if err := json.Unmarshal(ownershipChainJSON, &c.OwnershipChain); err != nil {
		return nil, err
	}
	if err := json.Unmarshal(encumbranceSearchesJSON, &c.EncumbranceSearches); err != nil {
		return nil, err
	}
	if err := json.Unmarshal(reraHistoryJSON, &c.RERAHistory); err != nil {
		return nil, err
	}
	if err := json.Unmarshal(documentsJSON, &c.Documents); err != nil {
		return nil, err
	}

	return &c, nil
}
