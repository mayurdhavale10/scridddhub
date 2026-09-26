package usecase

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/scridddhub/backend/internal/domain"
)

type CertificationPacketRepository interface {
	CreatePacket(ctx context.Context, actor string, packet *domain.CertificationPacket) error
	GetPacket(ctx context.Context, projectID uuid.UUID, year, quarter int16) (*domain.CertificationPacket, error)
	GetPacketByID(ctx context.Context, packetID uuid.UUID) (*domain.CertificationPacket, error)
	SendToProfessionals(ctx context.Context, actor string, packetID uuid.UUID) (*domain.CertificationPacket, error)

	GetEngineerDraft(ctx context.Context, packetID uuid.UUID) (*domain.EngineerDraft, error)
	UpsertEngineerDraft(ctx context.Context, actor string, draft *domain.EngineerDraft) error
	SignEngineerDraft(ctx context.Context, actor string, packetID uuid.UUID, signedBy string) (*domain.EngineerDraft, error)

	GetArchitectCertificate(ctx context.Context, packetID uuid.UUID) (*domain.ArchitectCertificate, error)
	ScheduleSiteVisit(ctx context.Context, actor string, packetID uuid.UUID, scheduledAt time.Time) (*domain.ArchitectCertificate, error)
	CompleteSiteVisit(ctx context.Context, actor string, packetID uuid.UUID, completedAt time.Time) (*domain.ArchitectCertificate, error)
	CertifyArchitect(ctx context.Context, actor string, packetID uuid.UUID, completionPct float64, signedBy string) (*domain.ArchitectCertificate, error)

	GetCADraft(ctx context.Context, packetID uuid.UUID) (*domain.CADraft, error)
	UpsertCADraft(ctx context.Context, actor string, draft *domain.CADraft) error
	SignCADraft(ctx context.Context, actor string, packetID uuid.UUID, signedBy string) (*domain.CADraft, error)
}

type CertificationPacketUsecase struct {
	repo CertificationPacketRepository
}

func NewCertificationPacketUsecase(repo CertificationPacketRepository) *CertificationPacketUsecase {
	return &CertificationPacketUsecase{repo: repo}
}

func (u *CertificationPacketUsecase) CreatePacket(ctx context.Context, actor string, packet *domain.CertificationPacket) error {
	if err := packet.Validate(); err != nil {
		return err
	}
	return u.repo.CreatePacket(ctx, actor, packet)
}

func (u *CertificationPacketUsecase) GetPacket(ctx context.Context, projectID uuid.UUID, year, quarter int16) (*domain.CertificationPacket, error) {
	return u.repo.GetPacket(ctx, projectID, year, quarter)
}

func (u *CertificationPacketUsecase) GetPacketByID(ctx context.Context, packetID uuid.UUID) (*domain.CertificationPacket, error) {
	return u.repo.GetPacketByID(ctx, packetID)
}

func (u *CertificationPacketUsecase) SendToProfessionals(ctx context.Context, actor string, packetID uuid.UUID) (*domain.CertificationPacket, error) {
	return u.repo.SendToProfessionals(ctx, actor, packetID)
}

func (u *CertificationPacketUsecase) GetEngineerDraft(ctx context.Context, packetID uuid.UUID) (*domain.EngineerDraft, error) {
	return u.repo.GetEngineerDraft(ctx, packetID)
}

func (u *CertificationPacketUsecase) UpsertEngineerDraft(ctx context.Context, actor string, draft *domain.EngineerDraft) error {
	return u.repo.UpsertEngineerDraft(ctx, actor, draft)
}

// SignEngineerDraft is the engineer's legal certification (Screen 8.4.1: "signing here is the
// engineer's legal certification, not a formality") — signedBy is required, not defaulted from
// the stubbed dev-user, since real RBAC will need to know exactly which engineer signed.
func (u *CertificationPacketUsecase) SignEngineerDraft(ctx context.Context, actor string, packetID uuid.UUID, signedBy string) (*domain.EngineerDraft, error) {
	if signedBy == "" {
		return nil, fmt.Errorf("signed_by is required")
	}
	return u.repo.SignEngineerDraft(ctx, actor, packetID, signedBy)
}

func (u *CertificationPacketUsecase) GetArchitectCertificate(ctx context.Context, packetID uuid.UUID) (*domain.ArchitectCertificate, error) {
	return u.repo.GetArchitectCertificate(ctx, packetID)
}

func (u *CertificationPacketUsecase) ScheduleSiteVisit(ctx context.Context, actor string, packetID uuid.UUID, scheduledAt time.Time) (*domain.ArchitectCertificate, error) {
	return u.repo.ScheduleSiteVisit(ctx, actor, packetID, scheduledAt)
}

func (u *CertificationPacketUsecase) CompleteSiteVisit(ctx context.Context, actor string, packetID uuid.UUID, completedAt time.Time) (*domain.ArchitectCertificate, error) {
	return u.repo.CompleteSiteVisit(ctx, actor, packetID, completedAt)
}

// CertifyArchitect is the one place the "no AI-draft path" constraint is actually enforced in
// code, not just in a comment: it refuses to certify unless a site visit has already been
// recorded as completed. There is no other way to reach ArchitectCertificateStatusCertified.
func (u *CertificationPacketUsecase) CertifyArchitect(ctx context.Context, actor string, packetID uuid.UUID, completionPct float64, signedBy string) (*domain.ArchitectCertificate, error) {
	if signedBy == "" {
		return nil, fmt.Errorf("signed_by is required")
	}
	cert, err := u.repo.GetArchitectCertificate(ctx, packetID)
	if err != nil {
		return nil, err
	}
	if cert.SiteVisitCompletedAt == nil {
		return nil, fmt.Errorf("cannot certify: no recorded site visit yet — completion %% requires a physical site inspection")
	}
	return u.repo.CertifyArchitect(ctx, actor, packetID, completionPct, signedBy)
}

func (u *CertificationPacketUsecase) GetCADraft(ctx context.Context, packetID uuid.UUID) (*domain.CADraft, error) {
	return u.repo.GetCADraft(ctx, packetID)
}

func (u *CertificationPacketUsecase) UpsertCADraft(ctx context.Context, actor string, draft *domain.CADraft) error {
	return u.repo.UpsertCADraft(ctx, actor, draft)
}

func (u *CertificationPacketUsecase) SignCADraft(ctx context.Context, actor string, packetID uuid.UUID, signedBy string) (*domain.CADraft, error) {
	if signedBy == "" {
		return nil, fmt.Errorf("signed_by is required")
	}
	return u.repo.SignCADraft(ctx, actor, packetID, signedBy)
}

// WithdrawalEligible mirrors Screen 8.4.2's honest limit: routing compliance alone never makes
// funds eligible — that's capped by the architect's certified completion %, which may not exist
// yet. Cross-entity derived, computed here (not stored anywhere).
func WithdrawalEligible(cert *domain.ArchitectCertificate) bool {
	return cert != nil && cert.Status == domain.ArchitectCertificateStatusCertified
}
