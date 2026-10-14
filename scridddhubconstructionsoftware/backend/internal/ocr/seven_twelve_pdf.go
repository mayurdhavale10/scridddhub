package ocr

import (
	"context"
	"errors"
	"fmt"
	"image"
	"image/png"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
)

// SevenTwelvePDF reads the signed 7/12 that Digital Satbara (digitalsatbara.mahabhumi.gov.in)
// sells. The PDF's own text layer is useless: it's set in a legacy (non-Unicode) Marathi font, so
// copying it out gives gibberish. The printed page is clean, though, so page 1 is rendered and
// read with Tesseract as printed. Tested on Varap 42/3 (2026-10-14): at 200 dpi the survey number,
// holders' names, area, tenure and every mutation number came out exact.
type SevenTwelvePDF struct {
	Tesseract Tesseract
	PdfToPPM  string // poppler's pdftoppm binary
	DPI       int    // render resolution; 0 means defaultDPI
}

// defaultDPI: at 150 and 250–300 dpi Tesseract misread the survey number, digits or a surname on
// Varap 42/3; at 200 dpi it read the page exactly.
const defaultDPI = 200

// ErrRendererMissing: pdftoppm isn't installed.
var ErrRendererMissing = errors.New("pdftoppm (poppler) is not installed")

// Available reports whether both pdftoppm and Tesseract are installed.
func (r SevenTwelvePDF) Available() bool {
	if _, err := os.Stat(r.PdfToPPM); err != nil {
		return false
	}
	return r.Tesseract.Available()
}

// Text returns the text of page 1 (form 7; page 2 is the crop register, form 12).
func (r SevenTwelvePDF) Text(ctx context.Context, pdf []byte) (string, error) {
	if _, err := os.Stat(r.PdfToPPM); err != nil {
		return "", ErrRendererMissing
	}
	page, err := r.renderFirstPage(ctx, pdf)
	if err != nil {
		return "", err
	}
	// Read as rendered: black-and-white thresholding (which strips Bhulekh's watermarks) breaks
	// the thin strokes of Marathi letters on this clean print.
	return r.Tesseract.Read(ctx, page)
}

func (r SevenTwelvePDF) renderFirstPage(ctx context.Context, pdf []byte) (image.Image, error) {
	dpi := r.DPI
	if dpi == 0 {
		dpi = defaultDPI
	}
	dir, err := os.MkdirTemp("", "satbara-*")
	if err != nil {
		return nil, err
	}
	defer os.RemoveAll(dir)
	in := filepath.Join(dir, "in.pdf")
	if err := os.WriteFile(in, pdf, 0o600); err != nil {
		return nil, err
	}
	outBase := filepath.Join(dir, "page")
	cmd := exec.CommandContext(ctx, r.PdfToPPM, "-r", strconv.Itoa(dpi), "-f", "1", "-l", "1", "-singlefile", "-png", in, outBase)
	if msg, err := cmd.CombinedOutput(); err != nil {
		return nil, fmt.Errorf("rendering the PDF: %w: %s", err, msg)
	}
	f, err := os.Open(outBase + ".png")
	if err != nil {
		return nil, err
	}
	defer f.Close()
	return png.Decode(f)
}
