package postgres

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/scridddhub/backend/internal/domain"
)

type transactionDB interface {
	Query(context.Context, string, ...any) (pgx.Rows, error)
	QueryRow(context.Context, string, ...any) pgx.Row
	Exec(context.Context, string, ...any) (pgconn.CommandTag, error)
}
type RegisteredTransactionRepository struct{ pool transactionDB }

func NewRegisteredTransactionRepository(p *pgxpool.Pool) *RegisteredTransactionRepository {
	return &RegisteredTransactionRepository{pool: p}
}

func (r *RegisteredTransactionRepository) FindNearby(ctx context.Context, q domain.TransactionQuery) ([]domain.RegisteredTransaction, error) {
	rows, err := r.pool.Query(ctx, `
 SELECT t.id,t.registration_date,t.document_no,t.office_code,t.office_name,
 t.district_code,t.taluka_code,t.village_code,t.survey_no,t.property_type,t.deed_type,
 t.area_acres::float8,t.sale_price_rupees,t.government_value_rupees,t.latitude,t.longitude,
 t.location_method,t.comparable,t.exclusion_reason,t.reviewed_by,t.source,s.source_url,t.source_record_id
 FROM registered_transactions t JOIN transaction_source_records s ON s.id=t.source_record_id
 JOIN mh_villages v ON (v.district_code,v.taluka_code,v.code)=(t.district_code,t.taluka_code,t.village_code)
 JOIN mh_talukas a ON (a.district_code,a.code)=(t.district_code,t.taluka_code)
 JOIN mh_districts d ON d.code=t.district_code
 WHERE t.registration_date BETWEEN $1::date AND $2::date
 AND t.comparable AND t.deed_type='sale' AND t.property_type IN ('land','plot')
 AND ( ($3::float8 IS NOT NULL AND t.location_method IN ('pin','survey_centre')
        AND t.latitude BETWEEN $3-0.028 AND $3+0.028
        AND t.longitude BETWEEN $4::float8-0.05 AND $4+0.05)
 OR ($3::float8 IS NULL AND (d.code=$5 OR lower(d.name)=lower($5))
     AND (a.code=$6 OR lower(a.name)=lower($6)) AND (v.code=$7 OR lower(v.name)=lower($7))))
 ORDER BY t.registration_date DESC,t.id`, q.From.Format("2006-01-02"), q.To.Format("2006-01-02"), q.Latitude, q.Longitude, q.District, q.Taluka, q.Village)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.RegisteredTransaction{}
	for rows.Next() {
		var t domain.RegisteredTransaction
		if err = rows.Scan(&t.ID, &t.RegistrationDate, &t.DocumentNo, &t.OfficeCode, &t.OfficeName, &t.DistrictCode, &t.TalukaCode, &t.VillageCode, &t.SurveyNo, &t.PropertyType, &t.DeedType, &t.AreaAcres, &t.SalePriceRupees, &t.GovernmentValueRupees, &t.Latitude, &t.Longitude, &t.LocationMethod, &t.Comparable, &t.ExclusionReason, &t.ReviewedBy, &t.Source, &t.SourceURL, &t.SourceRecordID); err != nil {
			return nil, err
		}
		if q.Latitude != nil {
			distance := domain.HaversineKm(domain.GeoPoint{Latitude: *q.Latitude, Longitude: *q.Longitude}, domain.GeoPoint{Latitude: *t.Latitude, Longitude: *t.Longitude})
			if distance > domain.TransactionRadiusKm {
				continue
			}
			t.DistanceKm = &distance
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

func (r *RegisteredTransactionRepository) ClaimTransactionSearch(ctx context.Context, key string, q domain.TransactionQuery) (domain.TransactionCoverage, bool, error) {
	payload, err := json.Marshal(q)
	if err != nil {
		return domain.TransactionCoverage{}, false, err
	}
	var c domain.TransactionCoverage
	err = r.pool.QueryRow(ctx, `
 INSERT INTO transaction_search_coverage(search_key,query,status,lease_until)
 VALUES($1,$2,'searching',now()+interval '60 seconds')
 ON CONFLICT(search_key) DO UPDATE SET status='searching',message='',lease_until=now()+interval '60 seconds',updated_at=now()
 WHERE (transaction_search_coverage.status='searching' AND transaction_search_coverage.lease_until<now())
 OR (transaction_search_coverage.status<>'searching' AND transaction_search_coverage.retry_after<=now())
 RETURNING status,message,searched_at`, key, payload).Scan(&c.Status, &c.Message, &c.SearchedAt)
	if err == nil {
		return c, true, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return c, false, err
	}
	err = r.pool.QueryRow(ctx, `SELECT status,message,searched_at FROM transaction_search_coverage WHERE search_key=$1`, key).Scan(&c.Status, &c.Message, &c.SearchedAt)
	return c, false, err
}

func (r *RegisteredTransactionRepository) FinishTransactionSearch(ctx context.Context, key string, c domain.TransactionCoverage) error {
	_, err := r.pool.Exec(ctx, `UPDATE transaction_search_coverage SET status=$2,message=$3,
 searched_at=CASE WHEN $2 IN ('searched','partial') THEN now() ELSE searched_at END,
 lease_until=NULL,retry_after=now()+CASE WHEN $2='failed' THEN interval '5 minutes' ELSE interval '24 hours' END,updated_at=now()
 WHERE search_key=$1`, key, c.Status, c.Message)
	return err
}
