package domain

import "time"

// ClosedTransaction is one anonymized real closed deal, pooled across every org/project in the
// system — future training data for a real pricing model (see docs/adr/0005). Deliberately
// carries no org/project/parcel identity, no name, no notes — only what a model would ever need
// to see. Never returned or used until real statistical volume exists; see
// services/estimatedparcelvalue/README.md for the volume gate this must clear before any model is
// trained on it.
type ClosedTransaction struct {
	AreaAcres         float64
	ClosedPriceRupees int64
	ClosedAt          time.Time
}
