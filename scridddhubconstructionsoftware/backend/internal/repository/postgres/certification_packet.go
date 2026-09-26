package postgres

import (
	"context"
	"encoding/json"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/scridddhub/backend/internal/domain"
)

type CertificationPacketRepository struct {
	pool *pgxpool.Pool
}

func NewCertificationPacketRepository(pool *pgxpool.Pool) *CertificationPacketRepository {
	return &CertificationPacketRepository{pool: pool}
}

const packetSelectCols = `id, project_id, period_year, period_quarter, sent_to_professionals_at, created_at, updated_at`

// CreatePacket also creates the three empty sub-draft rows in the same transaction — Screen 8.4
// always shows all three (even "site visit needed" is a real state, not an absent row), and every
// insert gets its own audit_log row.
func (r *CertificationPacketRepository) CreatePacket(ctx context.Context, actor string, packet *domain.CertificationPacket) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	row := tx.QueryRow(ctx, `
		INSERT INTO certification_packets (project_id, period_year, period_quarter)
		VALUES ($1, $2, $3)
		RETURNING `+packetSelectCols, packet.ProjectID, packet.PeriodYear, packet.PeriodQuarter)
	if err := scanPacketInto(row, packet); err != nil {
		return err
	}
	if err := writeAudit(ctx, tx, "certification_packets", packet.ID, "insert", actor, nil, packet); err != nil {
		return err
	}

	engineerDraft := &domain.EngineerDraft{CertificationPacketID: packet.ID, Status: domain.DraftStatusDraft}
	engRow := tx.QueryRow(ctx, `
		INSERT INTO engineer_drafts (certification_packet_id) VALUES ($1)
		RETURNING `+engineerDraftSelectCols, packet.ID)
	if err := scanEngineerDraftInto(engRow, engineerDraft); err != nil {
		return err
	}
	if err := writeAudit(ctx, tx, "engineer_drafts", engineerDraft.ID, "insert", actor, nil, engineerDraft); err != nil {
		return err
	}

	archCert := &domain.ArchitectCertificate{CertificationPacketID: packet.ID, Status: domain.ArchitectCertificateStatusAwaitingSiteVisit}
	archRow := tx.QueryRow(ctx, `
		INSERT INTO architect_certificates (certification_packet_id) VALUES ($1)
		RETURNING `+architectCertSelectCols, packet.ID)
	if err := scanArchitectCertInto(archRow, archCert); err != nil {
		return err
	}
	if err := writeAudit(ctx, tx, "architect_certificates", archCert.ID, "insert", actor, nil, archCert); err != nil {
		return err
	}

	caDraft := &domain.CADraft{CertificationPacketID: packet.ID, RequiredEscrowPct: 70, Status: domain.DraftStatusDraft}
	caRow := tx.QueryRow(ctx, `
		INSERT INTO ca_drafts (certification_packet_id) VALUES ($1)
		RETURNING `+caDraftSelectCols, packet.ID)
	if err := scanCADraftInto(caRow, caDraft); err != nil {
		return err
	}
	if err := writeAudit(ctx, tx, "ca_drafts", caDraft.ID, "insert", actor, nil, caDraft); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

func (r *CertificationPacketRepository) GetPacket(ctx context.Context, projectID uuid.UUID, year, quarter int16) (*domain.CertificationPacket, error) {
	row := r.pool.QueryRow(ctx, `
		SELECT `+packetSelectCols+`
		FROM certification_packets
		WHERE project_id = $1 AND period_year = $2 AND period_quarter = $3
	`, projectID, year, quarter)
	var p domain.CertificationPacket
	if err := scanPacketInto(row, &p); err != nil {
		return nil, err
	}
	return &p, nil
}

func (r *CertificationPacketRepository) GetPacketByID(ctx context.Context, packetID uuid.UUID) (*domain.CertificationPacket, error) {
	row := r.pool.QueryRow(ctx, `SELECT `+packetSelectCols+` FROM certification_packets WHERE id = $1`, packetID)
	var p domain.CertificationPacket
	if err := scanPacketInto(row, &p); err != nil {
		return nil, err
	}
	return &p, nil
}

func (r *CertificationPacketRepository) SendToProfessionals(ctx context.Context, actor string, packetID uuid.UUID) (*domain.CertificationPacket, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var before domain.CertificationPacket
	if err := scanPacketInto(tx.QueryRow(ctx, `SELECT `+packetSelectCols+` FROM certification_packets WHERE id = $1 FOR UPDATE`, packetID), &before); err != nil {
		return nil, err
	}

	after := before
	now := time.Now()
	if err := scanPacketInto(tx.QueryRow(ctx, `
		UPDATE certification_packets SET sent_to_professionals_at = $1, updated_at = now()
		WHERE id = $2
		RETURNING `+packetSelectCols, now, packetID), &after); err != nil {
		return nil, err
	}

	if err := writeAudit(ctx, tx, "certification_packets", packetID, "update", actor, &before, &after); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return &after, nil
}

func scanPacketInto(row rowScanner, p *domain.CertificationPacket) error {
	err := row.Scan(&p.ID, &p.ProjectID, &p.PeriodYear, &p.PeriodQuarter, &p.SentToProfessionalsAt, &p.CreatedAt, &p.UpdatedAt)
	if err == pgx.ErrNoRows {
		return domain.ErrNotFound
	}
	return err
}

// --- Engineer draft ---

const engineerDraftSelectCols = `
	id, certification_packet_id, cost_by_tower, committed_not_reflected_rupees,
	COALESCE(source_note, ''), status, COALESCE(signed_by, ''), signed_at, created_at, updated_at
`

func (r *CertificationPacketRepository) GetEngineerDraft(ctx context.Context, packetID uuid.UUID) (*domain.EngineerDraft, error) {
	var d domain.EngineerDraft
	err := scanEngineerDraftInto(r.pool.QueryRow(ctx, `SELECT `+engineerDraftSelectCols+` FROM engineer_drafts WHERE certification_packet_id = $1`, packetID), &d)
	if err != nil {
		return nil, err
	}
	return &d, nil
}

func (r *CertificationPacketRepository) UpsertEngineerDraft(ctx context.Context, actor string, draft *domain.EngineerDraft) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var before domain.EngineerDraft
	if err := scanEngineerDraftInto(tx.QueryRow(ctx, `SELECT `+engineerDraftSelectCols+` FROM engineer_drafts WHERE certification_packet_id = $1 FOR UPDATE`, draft.CertificationPacketID), &before); err != nil {
		return err
	}

	costJSON, err := json.Marshal(draft.CostByTower)
	if err != nil {
		return err
	}

	if err := scanEngineerDraftInto(tx.QueryRow(ctx, `
		UPDATE engineer_drafts SET
			cost_by_tower = $1::jsonb, committed_not_reflected_rupees = $2, source_note = $3, updated_at = now()
		WHERE certification_packet_id = $4
		RETURNING `+engineerDraftSelectCols,
		string(costJSON), draft.CommittedNotReflectedRupees, draft.SourceNote, draft.CertificationPacketID), draft); err != nil {
		return err
	}

	if err := writeAudit(ctx, tx, "engineer_drafts", draft.ID, "update", actor, &before, draft); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (r *CertificationPacketRepository) SignEngineerDraft(ctx context.Context, actor string, packetID uuid.UUID, signedBy string) (*domain.EngineerDraft, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var before domain.EngineerDraft
	if err := scanEngineerDraftInto(tx.QueryRow(ctx, `SELECT `+engineerDraftSelectCols+` FROM engineer_drafts WHERE certification_packet_id = $1 FOR UPDATE`, packetID), &before); err != nil {
		return nil, err
	}

	var after domain.EngineerDraft
	now := time.Now()
	if err := scanEngineerDraftInto(tx.QueryRow(ctx, `
		UPDATE engineer_drafts SET status = 'signed', signed_by = $1, signed_at = $2, updated_at = now()
		WHERE certification_packet_id = $3
		RETURNING `+engineerDraftSelectCols, signedBy, now, packetID), &after); err != nil {
		return nil, err
	}

	if err := writeAudit(ctx, tx, "engineer_drafts", after.ID, "update", actor, &before, &after); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return &after, nil
}

func scanEngineerDraftInto(row rowScanner, d *domain.EngineerDraft) error {
	var costJSON []byte
	err := row.Scan(&d.ID, &d.CertificationPacketID, &costJSON, &d.CommittedNotReflectedRupees,
		&d.SourceNote, &d.Status, &d.SignedBy, &d.SignedAt, &d.CreatedAt, &d.UpdatedAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return domain.ErrNotFound
		}
		return err
	}
	return json.Unmarshal(costJSON, &d.CostByTower)
}

// --- Architect certificate ---

const architectCertSelectCols = `
	id, certification_packet_id, completion_pct, site_visit_scheduled_at, site_visit_completed_at,
	status, COALESCE(signed_by, ''), signed_at, created_at, updated_at
`

func (r *CertificationPacketRepository) GetArchitectCertificate(ctx context.Context, packetID uuid.UUID) (*domain.ArchitectCertificate, error) {
	var c domain.ArchitectCertificate
	err := scanArchitectCertInto(r.pool.QueryRow(ctx, `SELECT `+architectCertSelectCols+` FROM architect_certificates WHERE certification_packet_id = $1`, packetID), &c)
	if err != nil {
		return nil, err
	}
	return &c, nil
}

func (r *CertificationPacketRepository) ScheduleSiteVisit(ctx context.Context, actor string, packetID uuid.UUID, scheduledAt time.Time) (*domain.ArchitectCertificate, error) {
	return r.updateArchitectCert(ctx, actor, packetID, `
		UPDATE architect_certificates SET site_visit_scheduled_at = $1, updated_at = now()
		WHERE certification_packet_id = $2
		RETURNING `+architectCertSelectCols, scheduledAt)
}

func (r *CertificationPacketRepository) CompleteSiteVisit(ctx context.Context, actor string, packetID uuid.UUID, completedAt time.Time) (*domain.ArchitectCertificate, error) {
	return r.updateArchitectCert(ctx, actor, packetID, `
		UPDATE architect_certificates SET site_visit_completed_at = $1, updated_at = now()
		WHERE certification_packet_id = $2
		RETURNING `+architectCertSelectCols, completedAt)
}

func (r *CertificationPacketRepository) CertifyArchitect(ctx context.Context, actor string, packetID uuid.UUID, completionPct float64, signedBy string) (*domain.ArchitectCertificate, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var before domain.ArchitectCertificate
	if err := scanArchitectCertInto(tx.QueryRow(ctx, `SELECT `+architectCertSelectCols+` FROM architect_certificates WHERE certification_packet_id = $1 FOR UPDATE`, packetID), &before); err != nil {
		return nil, err
	}

	var after domain.ArchitectCertificate
	now := time.Now()
	if err := scanArchitectCertInto(tx.QueryRow(ctx, `
		UPDATE architect_certificates SET
			completion_pct = $1, status = 'certified', signed_by = $2, signed_at = $3, updated_at = now()
		WHERE certification_packet_id = $4
		RETURNING `+architectCertSelectCols, completionPct, signedBy, now, packetID), &after); err != nil {
		return nil, err
	}

	if err := writeAudit(ctx, tx, "architect_certificates", after.ID, "update", actor, &before, &after); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return &after, nil
}

func (r *CertificationPacketRepository) updateArchitectCert(ctx context.Context, actor string, packetID uuid.UUID, query string, arg any) (*domain.ArchitectCertificate, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var before domain.ArchitectCertificate
	if err := scanArchitectCertInto(tx.QueryRow(ctx, `SELECT `+architectCertSelectCols+` FROM architect_certificates WHERE certification_packet_id = $1 FOR UPDATE`, packetID), &before); err != nil {
		return nil, err
	}

	var after domain.ArchitectCertificate
	if err := scanArchitectCertInto(tx.QueryRow(ctx, query, arg, packetID), &after); err != nil {
		return nil, err
	}

	if err := writeAudit(ctx, tx, "architect_certificates", after.ID, "update", actor, &before, &after); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return &after, nil
}

func scanArchitectCertInto(row rowScanner, c *domain.ArchitectCertificate) error {
	err := row.Scan(&c.ID, &c.CertificationPacketID, &c.CompletionPct, &c.SiteVisitScheduledAt,
		&c.SiteVisitCompletedAt, &c.Status, &c.SignedBy, &c.SignedAt, &c.CreatedAt, &c.UpdatedAt)
	if err == pgx.ErrNoRows {
		return domain.ErrNotFound
	}
	return err
}

// --- CA draft ---

const caDraftSelectCols = `
	id, certification_packet_id, collected_from_buyers_rupees, required_escrow_pct,
	actually_routed_to_escrow_rupees, COALESCE(source_note, ''), status, COALESCE(signed_by, ''),
	signed_at, created_at, updated_at
`

func (r *CertificationPacketRepository) GetCADraft(ctx context.Context, packetID uuid.UUID) (*domain.CADraft, error) {
	var d domain.CADraft
	err := scanCADraftInto(r.pool.QueryRow(ctx, `SELECT `+caDraftSelectCols+` FROM ca_drafts WHERE certification_packet_id = $1`, packetID), &d)
	if err != nil {
		return nil, err
	}
	return &d, nil
}

func (r *CertificationPacketRepository) UpsertCADraft(ctx context.Context, actor string, draft *domain.CADraft) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var before domain.CADraft
	if err := scanCADraftInto(tx.QueryRow(ctx, `SELECT `+caDraftSelectCols+` FROM ca_drafts WHERE certification_packet_id = $1 FOR UPDATE`, draft.CertificationPacketID), &before); err != nil {
		return err
	}

	if err := scanCADraftInto(tx.QueryRow(ctx, `
		UPDATE ca_drafts SET
			collected_from_buyers_rupees = $1, required_escrow_pct = $2,
			actually_routed_to_escrow_rupees = $3, source_note = $4, updated_at = now()
		WHERE certification_packet_id = $5
		RETURNING `+caDraftSelectCols,
		draft.CollectedFromBuyersRupees, draft.RequiredEscrowPct,
		draft.ActuallyRoutedToEscrowRupees, draft.SourceNote, draft.CertificationPacketID), draft); err != nil {
		return err
	}

	if err := writeAudit(ctx, tx, "ca_drafts", draft.ID, "update", actor, &before, draft); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (r *CertificationPacketRepository) SignCADraft(ctx context.Context, actor string, packetID uuid.UUID, signedBy string) (*domain.CADraft, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var before domain.CADraft
	if err := scanCADraftInto(tx.QueryRow(ctx, `SELECT `+caDraftSelectCols+` FROM ca_drafts WHERE certification_packet_id = $1 FOR UPDATE`, packetID), &before); err != nil {
		return nil, err
	}

	var after domain.CADraft
	now := time.Now()
	if err := scanCADraftInto(tx.QueryRow(ctx, `
		UPDATE ca_drafts SET status = 'signed', signed_by = $1, signed_at = $2, updated_at = now()
		WHERE certification_packet_id = $3
		RETURNING `+caDraftSelectCols, signedBy, now, packetID), &after); err != nil {
		return nil, err
	}

	if err := writeAudit(ctx, tx, "ca_drafts", after.ID, "update", actor, &before, &after); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return &after, nil
}

func scanCADraftInto(row rowScanner, d *domain.CADraft) error {
	err := row.Scan(&d.ID, &d.CertificationPacketID, &d.CollectedFromBuyersRupees, &d.RequiredEscrowPct,
		&d.ActuallyRoutedToEscrowRupees, &d.SourceNote, &d.Status, &d.SignedBy, &d.SignedAt,
		&d.CreatedAt, &d.UpdatedAt)
	if err == pgx.ErrNoRows {
		return domain.ErrNotFound
	}
	return err
}
