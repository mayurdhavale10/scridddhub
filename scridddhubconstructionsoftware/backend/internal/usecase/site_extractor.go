package usecase

import "context"

// SiteCharacteristics is the structured result of reading a developer's free-text project
// description (Screen 7 "Tell Us About Your Project"). It's deliberately narrow — just the
// facts that change which government approvals apply, not general project data.
type SiteCharacteristics struct {
	NearAirport          bool
	CoastalSite          bool
	SignificantTreeCover bool
	UsesGroundwater      bool
	UnitCount            int
}

// SiteTextExtractor turns free text into SiteCharacteristics. Defined here (the consumer),
// implemented by internal/llm — swap the implementation without touching usecase logic if the
// LLM provider ever changes (see the ADR: cheap/fast model for narrow extraction, not a reason
// to hand-roll a business-logic dependency on one vendor's SDK).
type SiteTextExtractor interface {
	Extract(ctx context.Context, freeText string) (SiteCharacteristics, error)
}
