package llm

import (
	"strings"
	"testing"
	"time"

	"github.com/scridddhub/backend/internal/domain"
	"github.com/scridddhub/backend/internal/usecase"
)

func TestValuationUserMessage_GivesInputsButNeverTheAskingPrice(t *testing.T) {
	d := 7.1
	msg := valuationUserMessage(usecase.ParcelValuationRequest{
		Location: "Nilaje, Kalyan", AreaAcres: 3.5, HorizonYears: 5,
		AsOf: time.Date(2026, 10, 1, 0, 0, 0, 0, time.UTC),
		Infrastructure: []domain.ValuationInfra{
			{Name: "Metro Line 12", Kind: "metro", Category: "connectivity", Status: "under_construction", DistanceKm: &d, Planned: true},
		},
	})
	for _, want := range []string{"Nilaje, Kalyan", "3.50 acres", "estimate value in 2031", "PLANNED Metro Line 12", "7.1 km",
		"Ready Reckoner rate: not on file", "Registered sales nearby: none on record"} {
		if !strings.Contains(msg, want) {
			t.Errorf("message missing %q:\n%s", want, msg)
		}
	}
	if strings.Contains(strings.ToLower(msg), "asking") {
		t.Error("the asking price must never be sent to the model (it would anchor the estimate)")
	}
}
