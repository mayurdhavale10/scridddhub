package domain

import (
	"time"

	"github.com/google/uuid"
)

type Project struct {
	ID        uuid.UUID
	OrgID     uuid.UUID
	Name      string
	City      string
	CreatedAt time.Time
	UpdatedAt time.Time
}
