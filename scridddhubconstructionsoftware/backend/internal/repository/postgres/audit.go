package postgres

import (
	"context"
	"encoding/json"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// writeAudit inserts one audit_log row in the same transaction as the mutation it describes.
// ADR-0002: every repository write must go through this — a write that skips it is a bug in the
// repository, not a missing call site. oldData/newData may be nil (e.g. nil old_data on insert).
func writeAudit(ctx context.Context, tx pgx.Tx, tableName string, rowID uuid.UUID, action, actor string, oldData, newData any) error {
	oldJSON, err := marshalNullable(oldData)
	if err != nil {
		return err
	}
	newJSON, err := marshalNullable(newData)
	if err != nil {
		return err
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO audit_log (table_name, row_id, action, actor, old_data, new_data)
		VALUES ($1, $2, $3, $4, $5, $6)
	`, tableName, rowID, action, actor, oldJSON, newJSON)
	return err
}

func marshalNullable(v any) ([]byte, error) {
	if v == nil {
		return nil, nil
	}
	return json.Marshal(v)
}
