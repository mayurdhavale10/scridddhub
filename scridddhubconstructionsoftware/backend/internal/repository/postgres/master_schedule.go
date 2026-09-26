package postgres

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/scridddhub/backend/internal/domain"
)

type MasterScheduleRepository struct {
	pool *pgxpool.Pool
}

func NewMasterScheduleRepository(pool *pgxpool.Pool) *MasterScheduleRepository {
	return &MasterScheduleRepository{pool: pool}
}

const masterScheduleSelectCols = `id, project_id, confirmed_at, created_at, updated_at`

const masterScheduleMilestoneSelectCols = `
	id, master_schedule_id, milestone_type, status, target_date, created_at, updated_at
`

func (r *MasterScheduleRepository) Create(ctx context.Context, actor string, schedule *domain.MasterSchedule, milestones []*domain.MasterScheduleMilestone) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if err := scanMasterSchedule(tx.QueryRow(ctx, `
		INSERT INTO master_schedules (project_id)
		VALUES ($1)
		RETURNING `+masterScheduleSelectCols, schedule.ProjectID), schedule); err != nil {
		return err
	}
	if err := writeAudit(ctx, tx, "master_schedules", schedule.ID, "insert", actor, nil, schedule); err != nil {
		return err
	}

	for _, m := range milestones {
		m.MasterScheduleID = schedule.ID
		if err := scanMasterScheduleMilestone(tx.QueryRow(ctx, `
			INSERT INTO master_schedule_milestones (master_schedule_id, milestone_type, status, target_date)
			VALUES ($1, $2, $3, $4)
			RETURNING `+masterScheduleMilestoneSelectCols,
			m.MasterScheduleID, m.MilestoneType, m.Status, m.TargetDate), m); err != nil {
			return err
		}
		if err := writeAudit(ctx, tx, "master_schedule_milestones", m.ID, "insert", actor, nil, m); err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}

func (r *MasterScheduleRepository) GetByProject(ctx context.Context, projectID uuid.UUID) (*domain.MasterSchedule, error) {
	var s domain.MasterSchedule
	err := scanMasterSchedule(r.pool.QueryRow(ctx, `
		SELECT `+masterScheduleSelectCols+`
		FROM master_schedules
		WHERE project_id = $1
	`, projectID), &s)
	if err != nil {
		return nil, err
	}
	return &s, nil
}

func (r *MasterScheduleRepository) ListMilestones(ctx context.Context, scheduleID uuid.UUID) ([]*domain.MasterScheduleMilestone, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT `+masterScheduleMilestoneSelectCols+`
		FROM master_schedule_milestones
		WHERE master_schedule_id = $1
		ORDER BY target_date
	`, scheduleID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var milestones []*domain.MasterScheduleMilestone
	for rows.Next() {
		var m domain.MasterScheduleMilestone
		if err := scanMasterScheduleMilestone(rows, &m); err != nil {
			return nil, err
		}
		milestones = append(milestones, &m)
	}
	return milestones, rows.Err()
}

func (r *MasterScheduleRepository) UpdateMilestone(ctx context.Context, actor string, milestoneID uuid.UUID, status domain.MasterScheduleMilestoneStatus, targetDate time.Time) (*domain.MasterScheduleMilestone, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var before domain.MasterScheduleMilestone
	if err := scanMasterScheduleMilestone(tx.QueryRow(ctx, `
		SELECT `+masterScheduleMilestoneSelectCols+`
		FROM master_schedule_milestones
		WHERE id = $1
		FOR UPDATE
	`, milestoneID), &before); err != nil {
		return nil, err
	}

	var after domain.MasterScheduleMilestone
	if err := scanMasterScheduleMilestone(tx.QueryRow(ctx, `
		UPDATE master_schedule_milestones
		SET status = $1, target_date = $2, updated_at = now()
		WHERE id = $3
		RETURNING `+masterScheduleMilestoneSelectCols, status, targetDate, milestoneID), &after); err != nil {
		return nil, err
	}

	if err := writeAudit(ctx, tx, "master_schedule_milestones", milestoneID, "update", actor, &before, &after); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return &after, nil
}

func (r *MasterScheduleRepository) ConfirmSchedule(ctx context.Context, actor string, scheduleID uuid.UUID) (*domain.MasterSchedule, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var before domain.MasterSchedule
	if err := scanMasterSchedule(tx.QueryRow(ctx, `
		SELECT `+masterScheduleSelectCols+`
		FROM master_schedules
		WHERE id = $1
		FOR UPDATE
	`, scheduleID), &before); err != nil {
		return nil, err
	}

	var after domain.MasterSchedule
	if err := scanMasterSchedule(tx.QueryRow(ctx, `
		UPDATE master_schedules
		SET confirmed_at = now(), updated_at = now()
		WHERE id = $1
		RETURNING `+masterScheduleSelectCols, scheduleID), &after); err != nil {
		return nil, err
	}

	if err := writeAudit(ctx, tx, "master_schedules", scheduleID, "update", actor, &before, &after); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return &after, nil
}

func scanMasterSchedule(row rowScanner, s *domain.MasterSchedule) error {
	err := row.Scan(&s.ID, &s.ProjectID, &s.ConfirmedAt, &s.CreatedAt, &s.UpdatedAt)
	if err == pgx.ErrNoRows {
		return domain.ErrNotFound
	}
	return err
}

func scanMasterScheduleMilestone(row rowScanner, m *domain.MasterScheduleMilestone) error {
	err := row.Scan(&m.ID, &m.MasterScheduleID, &m.MilestoneType, &m.Status, &m.TargetDate, &m.CreatedAt, &m.UpdatedAt)
	if err == pgx.ErrNoRows {
		return domain.ErrNotFound
	}
	return err
}
