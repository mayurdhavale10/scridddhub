package postgres

import (
	"context"
	"encoding/json"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/scridddhub/backend/internal/domain"
)

// RecordQueueRepository stores the lookup queue and the land record cache (migration 052).
type RecordQueueRepository struct {
	pool *pgxpool.Pool
}

func NewRecordQueueRepository(pool *pgxpool.Pool) *RecordQueueRepository {
	return &RecordQueueRepository{pool: pool}
}

// Enqueue adds lookups; one already queued or done for the same land is left as it is.
func (r *RecordQueueRepository) Enqueue(ctx context.Context, reqs []domain.RecordRequest) (int, error) {
	added := 0
	for _, q := range reqs {
		tag, err := r.pool.Exec(ctx, `
			INSERT INTO record_requests (kind, district, taluka, village, survey_number, survey_key, land_parcel_id, requested_by)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
			ON CONFLICT (kind, lower(district), lower(taluka), lower(village), survey_key) DO NOTHING`,
			q.Kind, q.District, q.Taluka, q.Village, q.SurveyNumber, q.SurveyKey, q.LandParcelID, q.RequestedBy)
		if err != nil {
			return added, err
		}
		added += int(tag.RowsAffected())
	}
	return added, nil
}

const recordRequestCols = `
	q.id, q.kind, q.district, q.taluka, q.village, q.survey_number, q.survey_key, q.status, q.note,
	q.land_parcel_id, q.requested_by, q.created_at, q.updated_at,
	COALESCE(d.name_local, ''), COALESCE(t.name_local, ''), COALESCE(v.name_local, '')`

const recordRequestFrom = `
	FROM record_requests q
	LEFT JOIN mh_districts d ON lower(d.name) = lower(q.district)
	LEFT JOIN mh_talukas t ON t.district_code = d.code AND lower(t.name) = lower(q.taluka)
	LEFT JOIN mh_villages v ON v.district_code = d.code AND v.taluka_code = t.code AND lower(v.name) = lower(q.village)`

// List returns lookups by status, optionally in one district and taluka, oldest first.
func (r *RecordQueueRepository) List(ctx context.Context, status, district, taluka string, limit int) ([]domain.RecordRequest, error) {
	rows, err := r.pool.Query(ctx, `SELECT `+recordRequestCols+recordRequestFrom+`
		WHERE q.status = $1 AND ($2 = '' OR lower(q.district) = lower($2)) AND ($3 = '' OR lower(q.taluka) = lower($3))
		ORDER BY q.created_at LIMIT $4`, status, district, taluka, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.RecordRequest{}
	for rows.Next() {
		q, err := scanRecordRequest(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *q)
	}
	return out, rows.Err()
}

func (r *RecordQueueRepository) Get(ctx context.Context, id uuid.UUID) (*domain.RecordRequest, error) {
	return scanRecordRequest(r.pool.QueryRow(ctx, `SELECT `+recordRequestCols+recordRequestFrom+` WHERE q.id = $1`, id))
}

func (r *RecordQueueRepository) SetStatus(ctx context.Context, id uuid.UUID, status, note string) error {
	tag, err := r.pool.Exec(ctx, `UPDATE record_requests SET status = $2, note = $3, updated_at = now() WHERE id = $1`, id, status, note)
	if err == nil && tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return err
}

// Counts returns the number of lookups per status.
func (r *RecordQueueRepository) Counts(ctx context.Context, district, taluka string) (map[string]int, error) {
	rows, err := r.pool.Query(ctx, `SELECT status, count(*) FROM record_requests
		WHERE ($1 = '' OR lower(district) = lower($1)) AND ($2 = '' OR lower(taluka) = lower($2)) GROUP BY status`, district, taluka)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[string]int{}
	for rows.Next() {
		var s string
		var n int
		if err := rows.Scan(&s, &n); err != nil {
			return nil, err
		}
		out[s] = n
	}
	return out, rows.Err()
}

func (r *RecordQueueRepository) SaveCache(ctx context.Context, c *domain.CachedRecord) error {
	parsed, err := json.Marshal(c.Parsed)
	if err != nil {
		return err
	}
	_, err = r.pool.Exec(ctx, `
		INSERT INTO record_cache (kind, district, taluka, village, survey_number, survey_key, raw_text, parsed, read_by, source_url, fetched_by, fetched_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, $12)
		ON CONFLICT (kind, lower(district), lower(taluka), lower(village), survey_key) DO UPDATE SET
			survey_number = EXCLUDED.survey_number, raw_text = EXCLUDED.raw_text, parsed = EXCLUDED.parsed,
			read_by = EXCLUDED.read_by, source_url = EXCLUDED.source_url, fetched_by = EXCLUDED.fetched_by,
			fetched_at = EXCLUDED.fetched_at`,
		c.Kind, c.District, c.Taluka, c.Village, c.SurveyNumber, c.SurveyKey, c.RawText, string(parsed),
		c.ReadBy, c.SourceURL, c.FetchedBy, c.FetchedAt)
	return err
}

func (r *RecordQueueRepository) CacheFor(ctx context.Context, kind, district, taluka, village, surveyKey string) (*domain.CachedRecord, error) {
	var c domain.CachedRecord
	var parsed []byte
	err := r.pool.QueryRow(ctx, `
		SELECT kind, district, taluka, village, survey_number, survey_key, raw_text, parsed, read_by, source_url, fetched_by, fetched_at
		FROM record_cache WHERE kind = $1 AND lower(district) = lower($2) AND lower(taluka) = lower($3)
		AND lower(village) = lower($4) AND survey_key = $5`, kind, district, taluka, village, surveyKey).
		Scan(&c.Kind, &c.District, &c.Taluka, &c.Village, &c.SurveyNumber, &c.SurveyKey, &c.RawText, &parsed,
			&c.ReadBy, &c.SourceURL, &c.FetchedBy, &c.FetchedAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}
	if err := json.Unmarshal(parsed, &c.Parsed); err != nil {
		return nil, err
	}
	return &c, nil
}

func scanRecordRequest(row rowScanner) (*domain.RecordRequest, error) {
	var q domain.RecordRequest
	err := row.Scan(&q.ID, &q.Kind, &q.District, &q.Taluka, &q.Village, &q.SurveyNumber, &q.SurveyKey, &q.Status, &q.Note,
		&q.LandParcelID, &q.RequestedBy, &q.CreatedAt, &q.UpdatedAt, &q.DistrictMR, &q.TalukaMR, &q.VillageMR)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}
	return &q, nil
}
