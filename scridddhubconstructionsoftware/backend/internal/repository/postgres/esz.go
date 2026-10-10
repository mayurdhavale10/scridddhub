package postgres

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/scridddhub/backend/internal/domain"
)

// ESZRepository reads the eco-sensitive zone notifications and their village lists
// (migration 050). Reference data typed from the gazette; the app never edits it.
type ESZRepository struct {
	pool *pgxpool.Pool
}

func NewESZRepository(pool *pgxpool.Pool) *ESZRepository {
	return &ESZRepository{pool: pool}
}

// ForDistrict returns every notification and the villages they list in one district.
func (r *ESZRepository) ForDistrict(ctx context.Context, district string) ([]domain.ESZNotification, []domain.ESZVillage, error) {
	rows, err := r.pool.Query(ctx, `SELECT id, name, so_number, notified_on, status, source_url, summary FROM esz_notifications ORDER BY id`)
	if err != nil {
		return nil, nil, err
	}
	var ns []domain.ESZNotification
	for rows.Next() {
		var n domain.ESZNotification
		if err := rows.Scan(&n.ID, &n.Name, &n.SONumber, &n.NotifiedOn, &n.Status, &n.SourceURL, &n.Summary); err != nil {
			rows.Close()
			return nil, nil, err
		}
		ns = append(ns, n)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, nil, err
	}

	vrows, err := r.pool.Query(ctx, `SELECT notification_id, district, taluka, village, coverage FROM esz_villages WHERE lower(district) = lower($1)`, district)
	if err != nil {
		return nil, nil, err
	}
	defer vrows.Close()
	var vs []domain.ESZVillage
	for vrows.Next() {
		var v domain.ESZVillage
		if err := vrows.Scan(&v.NotificationID, &v.District, &v.Taluka, &v.Village, &v.Coverage); err != nil {
			return nil, nil, err
		}
		vs = append(vs, v)
	}
	return ns, vs, vrows.Err()
}
