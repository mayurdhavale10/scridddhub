package postgres

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/scridddhub/backend/internal/domain"
)

type PricingPoolRepository struct {
	pool *pgxpool.Pool
}

func NewPricingPoolRepository(pool *pgxpool.Pool) *PricingPoolRepository {
	return &PricingPoolRepository{pool: pool}
}

// ListClosedTransactions pools real closed deals across every project/org in the database —
// deliberately no project_id filter anywhere in this query (see docs/adr/0005). Selects only
// area/price/date; never selects name, project_id, or anything else that could re-identify a
// specific parcel or org.
func (r *PricingPoolRepository) ListClosedTransactions(ctx context.Context, district, taluka, village string) ([]domain.ClosedTransaction, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT area_acres, closed_price_rupees, closed_at
		FROM land_parcels
		WHERE district = $1 AND taluka = $2 AND village = $3
		  AND closed_price_rupees IS NOT NULL AND area_acres IS NOT NULL
		ORDER BY closed_at DESC
	`, district, taluka, village)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	transactions := make([]domain.ClosedTransaction, 0)
	for rows.Next() {
		var t domain.ClosedTransaction
		if err := rows.Scan(&t.AreaAcres, &t.ClosedPriceRupees, &t.ClosedAt); err != nil {
			return nil, err
		}
		transactions = append(transactions, t)
	}
	return transactions, rows.Err()
}
