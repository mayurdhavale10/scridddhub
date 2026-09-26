package postgres

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/scridddhub/backend/internal/domain"
)

type AuditLogRepository struct {
	pool *pgxpool.Pool
}

func NewAuditLogRepository(pool *pgxpool.Pool) *AuditLogRepository {
	return &AuditLogRepository{pool: pool}
}

func (r *AuditLogRepository) ListRecent(ctx context.Context, limit int) ([]*domain.AuditLogEntry, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, table_name, row_id, action, actor, old_data, new_data, changed_at
		FROM audit_log
		ORDER BY changed_at DESC, id DESC
		LIMIT $1
	`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var entries []*domain.AuditLogEntry
	for rows.Next() {
		var e domain.AuditLogEntry
		if err := rows.Scan(&e.ID, &e.TableName, &e.RowID, &e.Action, &e.Actor, &e.OldData, &e.NewData, &e.ChangedAt); err != nil {
			return nil, err
		}
		entries = append(entries, &e)
	}
	return entries, rows.Err()
}
