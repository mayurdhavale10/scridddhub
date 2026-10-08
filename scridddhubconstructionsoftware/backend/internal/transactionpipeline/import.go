// Package transactionpipeline archives source bytes before normalizing reviewed registration data.
// It deliberately does not infer unknown sale prices, units, coordinates or deed classifications.
package transactionpipeline

import (
	"bytes"
	"context"
	"crypto/sha256"
	"fmt"
	"math"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/scridddhub/backend/internal/domain"
)

type SourceRecord struct {
	Source    string
	Reference string
	URL       string
	FetchedAt time.Time
	Hash      string
	RawText   *string
	FilePath  *string
}
type Store interface {
	SaveTransactionSource(context.Context, SourceRecord) (string, error)
	SaveRegisteredTransaction(context.Context, domain.RegisteredTransaction) error
}

type ReviewedRecord struct {
	Transaction     domain.RegisteredTransaction `json:"transaction"`
	Area            float64                      `json:"area"`
	AreaUnit        string                       `json:"area_unit"`
	SourceReference string                       `json:"source_reference"`
	FetchedAt       time.Time                    `json:"fetched_at"`
	// False for bundles of multiple properties or partial interests unless the consideration
	// and area have been unambiguously allocated to this one parcel by a reviewer.
	SinglePropertyFullInterest bool `json:"single_property_full_interest"`
}

func Acres(area float64, unit string) (float64, error) {
	if area <= 0 || math.IsNaN(area) || math.IsInf(area, 0) {
		return 0, fmt.Errorf("area must be finite and positive")
	}
	factor := 0.0
	switch strings.ToLower(strings.TrimSpace(unit)) {
	case "acre":
		factor = 1
	case "hectare":
		factor = 2.471053814671653
	case "sqm":
		factor = 1 / 4046.8564224
	case "sqft":
		factor = 1.0 / 43560
	case "guntha":
		factor = 1.0 / 40
	default:
		return 0, fmt.Errorf("unsupported area unit %q; resolve it from the document", unit)
	}
	acres := area * factor
	if acres <= 0 || acres >= 10000000 {
		return 0, fmt.Errorf("area outside supported bounds")
	}
	return acres, nil
}

func Import(ctx context.Context, s Store, raw []byte, m ReviewedRecord, filesDir string) error {
	if len(raw) == 0 {
		return fmt.Errorf("raw source is empty")
	}
	t := m.Transaction
	if strings.TrimSpace(t.Source) == "" || strings.TrimSpace(m.SourceReference) == "" || m.FetchedAt.IsZero() || m.FetchedAt.After(time.Now().Add(5*time.Minute)) {
		return fmt.Errorf("source, source_reference and valid fetched_at are required")
	}
	u, err := url.Parse(t.SourceURL)
	if err != nil || u.Scheme != "https" || u.User != nil || !(u.Hostname() == "igrmaharashtra.gov.in" || strings.HasSuffix(u.Hostname(), ".igrmaharashtra.gov.in") || u.Hostname() == "freesearchigrservice.maharashtra.gov.in" || u.Hostname() == "esearchigr.maharashtra.gov.in") {
		return fmt.Errorf("source_url must identify an official Maharashtra IGR HTTPS page")
	}
	// Archive even if normalization fails; reparsing must not require recollecting evidence.
	hash := fmt.Sprintf("%x", sha256.Sum256(raw))
	source := SourceRecord{Source: t.Source, Reference: m.SourceReference, URL: t.SourceURL, FetchedAt: m.FetchedAt, Hash: hash}
	if len(raw) <= 1024*1024 && utf8.Valid(raw) && !bytes.Contains(raw, []byte{0}) && !bytes.HasPrefix(raw, []byte("%PDF-")) {
		text := string(raw)
		source.RawText = &text
	} else {
		if filesDir == "" {
			return fmt.Errorf("file store directory is required for binary/large evidence")
		}
		if err = os.MkdirAll(filesDir, 0700); err != nil {
			return err
		}
		path, err := filepath.Abs(filepath.Join(filesDir, hash+".bin"))
		if err != nil {
			return err
		}
		// Content-addressed immutable files: existing evidence is never rewritten.
		f, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0600)
		if err != nil && !os.IsExist(err) {
			return err
		}
		if err == nil {
			_, writeErr := f.Write(raw)
			closeErr := f.Close()
			if writeErr != nil {
				return writeErr
			}
			if closeErr != nil {
				return closeErr
			}
		} else {
			existing, readErr := os.ReadFile(path)
			if readErr != nil {
				return readErr
			}
			if fmt.Sprintf("%x", sha256.Sum256(existing)) != hash {
				return fmt.Errorf("existing evidence file failed hash verification")
			}
		}
		source.FilePath = &path
	}
	rawID, err := s.SaveTransactionSource(ctx, source)
	if err != nil {
		return err
	}
	t.SourceRecordID = rawID
	t.DocumentNo = strings.ToUpper(strings.TrimSpace(t.DocumentNo))
	t.OfficeCode = strings.ToUpper(strings.TrimSpace(t.OfficeCode))
	if t.DocumentNo == "" || t.OfficeCode == "" || strings.TrimSpace(t.OfficeName) == "" || strings.TrimSpace(t.ReviewedBy) == "" || t.RegistrationDate.IsZero() || t.RegistrationDate.After(m.FetchedAt) {
		return fmt.Errorf("reviewer, document, office and valid registration date required (raw evidence saved)")
	}
	t.AreaAcres, err = Acres(m.Area, m.AreaUnit)
	if err != nil {
		return err
	}
	if t.SalePriceRupees <= 0 {
		return fmt.Errorf("recorded consideration must be positive; government value is not a substitute")
	}
	if !m.SinglePropertyFullInterest {
		t.Comparable = false
		t.ExclusionReason = "Multiple properties or partial interest; rate cannot be allocated reliably"
	}
	if t.DeedType != "sale" {
		t.Comparable = false
		t.ExclusionReason = "Not a sale deed"
	}
	return s.SaveRegisteredTransaction(ctx, t)
}
