package domain

import (
	"errors"
	"testing"

	"github.com/google/uuid"
)

func TestNewLegalCheckChecklist_StartsUncheckedAndValid(t *testing.T) {
	c := NewLegalCheckChecklist(uuid.New())
	if err := c.Validate(); err != nil {
		t.Fatalf("new checklist should be valid in progress: %v", err)
	}
	if c.OwnershipRisk != RiskLevelNotChecked || c.RegulatoryRisk != RiskLevelNotChecked {
		t.Fatalf("risks should start not_checked, got %q / %q", c.OwnershipRisk, c.RegulatoryRisk)
	}
	if len(c.EncumbranceSearches) != 3 || len(c.Documents) != 5 {
		t.Fatalf("want 3 searches and 5 documents, got %d and %d", len(c.EncumbranceSearches), len(c.Documents))
	}
	// 4 unjudged risks + 3 searches not done.
	if got := len(c.OpenItems()); got != 7 {
		t.Fatalf("want 7 open items, got %d", got)
	}
}

func TestLegalCheckValidate_ClearingNeedsRisksAndSearches(t *testing.T) {
	c := NewLegalCheckChecklist(uuid.New())
	c.Status = LegalCheckStatusCleared
	if err := c.Validate(); !errors.Is(err, ErrLegalCheckNotReady) {
		t.Fatalf("clearing an untouched checklist: want ErrLegalCheckNotReady, got %v", err)
	}

	c.OwnershipRisk, c.LitigationRisk, c.EncumbranceRisk, c.RegulatoryRisk =
		RiskLevelLow, RiskLevelLow, RiskLevelLow, RiskLevelMedium
	c.EncumbranceSearches[0].Completed = true
	c.EncumbranceSearches[1].Completed = true
	if err := c.Validate(); !errors.Is(err, ErrLegalCheckNotReady) {
		t.Fatalf("one search still pending: want ErrLegalCheckNotReady, got %v", err)
	}

	// Pending documents don't block clearing.
	c.EncumbranceSearches[2].Completed = true
	if err := c.Validate(); err != nil {
		t.Fatalf("all risks judged and searches done should clear: %v", err)
	}
}
