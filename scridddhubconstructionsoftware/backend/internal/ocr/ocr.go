// Package ocr reads text from land records with Tesseract, run locally.
//
// Used for the signed 7/12 PDF from Digital Satbara, which is clean print (seven_twelve_pdf.go).
// The free Bhulekh view isn't read this way: it's a small JPEG under grey "VIEW ONLY - NOT FOR
// LEGAL PURPOSE" watermarks, and neither Tesseract nor the vision model got its Marathi names
// right reliably (Nilaje 1/1/अ, 2026-10-11).
package ocr

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"image"
	"image/png"
	"os"
	"os/exec"
	"path/filepath"
)

// Tesseract runs the tesseract binary. DataDir holds mar.traineddata (tessdata_best).
type Tesseract struct {
	Bin     string
	DataDir string
	Langs   string // e.g. "mar+eng"
}

var ErrNotInstalled = errors.New("tesseract is not installed")

// Available reports whether the binary and the language data are there.
func (t Tesseract) Available() bool {
	if _, err := os.Stat(t.Bin); err != nil {
		return false
	}
	_, err := os.Stat(filepath.Join(t.DataDir, "mar.traineddata"))
	return err == nil
}

// Read returns the text Tesseract reads from img, laid out as one block of text (psm 6).
func (t Tesseract) Read(ctx context.Context, img image.Image) (string, error) {
	if !t.Available() {
		return "", ErrNotInstalled
	}
	f, err := os.CreateTemp("", "ocr-*.png")
	if err != nil {
		return "", err
	}
	defer os.Remove(f.Name())
	if err := png.Encode(f, img); err != nil {
		f.Close()
		return "", err
	}
	f.Close()
	var out, stderr bytes.Buffer
	cmd := exec.CommandContext(ctx, t.Bin, f.Name(), "-", "--tessdata-dir", t.DataDir, "-l", t.Langs, "--psm", "6")
	cmd.Stdout, cmd.Stderr = &out, &stderr
	if err := cmd.Run(); err != nil {
		return "", fmt.Errorf("tesseract: %w: %s", err, stderr.String())
	}
	return out.String(), nil
}
