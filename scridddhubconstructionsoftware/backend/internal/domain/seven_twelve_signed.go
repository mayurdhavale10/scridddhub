package domain

import (
	"regexp"
	"strings"
)

// The facts below are read from the OCR text of a signed 7/12 (Digital Satbara) by rules, not by
// the AI, and override what the AI drafted: the AI was seen taking the assessment (आकार) for the
// area, and Tesseract reads "वर्ग-१" as "वर्ग -9" (Varap 42/3, 2026-10-14).

var (
	reTenure = regexp.MustCompile(`भोगवटादार\s*वर्ग\s*[-–]?\s*(\S)`)
	// "हा गाव नमूना क्रमांक ७ दिनांक २०/०६/२०२२:११:२९:५४ AM रोजी डिजिटल स्वाक्षरीत केला आहे"
	reSignedOn = regexp.MustCompile(`([०-९0-9]{2}/[०-९0-9]{2}/[०-९0-9]{4})[^र]{0,20}रोजी\s*डिजिटल`)
	// "... जाऊन 2112100001134296 हा क्रमांक वापरावा"
	reVerification = regexp.MustCompile(`([0-9०-९]{16})\s*हा\s*क्रमांक`)
	// OCR prints the separators as dots or commas: "११.६०.००" or "११,६०,००".
	areaToken = `([०-९0-9]+[.,][०-९0-9]{2}(?:[.,][०-९0-9]{2})?)`
	// The holders' common-area line: "------सामाईक क्षेत्र------ ११.६०.०० ३७६.००" (area, then assessment).
	reCommonArea = regexp.MustCompile(`सामाईक\s*क्षेत्र[-\s]*` + areaToken)
	// Column 1 totals, for land without a common-area line.
	reTotalArea = regexp.MustCompile(`एकूण\s*क्षेत्र\s*(?:\([^)]*\))?\s*` + areaToken)
	// OCR reads बिन शेती as "बिन शोती" or "बिन होती".
	reNAArea = regexp.MustCompile(`बिन\s*[शह][ेो]ती\s*` + areaToken)
	// "तुकडा ( ९९ )": the land was recorded as a fragment (Fragmentation Act), in mutation 99.
	// OCR also reads the तु as छ or पु.
	reTukda = regexp.MustCompile(`[तछप]ु?कडा\s*\(\s*([०-९0-9]+)\s*\)`)
	// The NA order in the other-rights column, from its number to "परवानगी (mutation)".
	reNAOrder = regexp.MustCompile(`(?s)(क्र\.?\s*महसुल.*?परवानगी\s*\(\s*[०-९0-9]+\s*\))`)
	// Text from the area column that OCR runs into the other-rights column's lines.
	// Also a stray mark of up to 3 characters before the column's border ("पिं [ची रहिवास"), and
	// "पिं", which the border itself is read as.
	reLeftColumn = regexp.MustCompile(`^(बिन\s*[शह][ेो]ती\s*[०-९0-9.,]*|आकारणी|[A-Za-z]{1,3}\s*[—-]+|\S{1,3}\s+[\[|]|पिं\s+)\s*`)
)

// NAPermissionPrefix starts the other-rights entry that records an NA order. It's a permission,
// not a burden on the land, so Flags doesn't list it as a concern.
const NAPermissionPrefix = "अकृषिक वापर परवानगी: "

// naOrder returns the NA order's text, joined from its lines, or "".
func naOrder(raw string) string {
	m := reNAOrder.FindString(raw)
	if m == "" {
		return ""
	}
	var parts []string
	for _, line := range strings.Split(m, "\n") {
		line = strings.TrimLeft(strings.TrimSpace(line), "[|] ") // the column's border, read as [ or |
		line = strings.TrimSpace(reLeftColumn.ReplaceAllString(line, ""))
		line = strings.TrimLeft(line, "[|] ")
		if line != "" {
			parts = append(parts, line)
		}
	}
	return strings.Join(parts, " ")
}

// ApplySignedCopyText sets, from the OCR text of a signed 7/12, the fields rules can read
// reliably. It returns what it changed, for the notes.
func (s *SevenTwelve) ApplySignedCopyText(raw string) []string {
	var changed []string
	set := func(field, from, to string) {
		if from != to {
			changed = append(changed, field+": "+to)
		}
	}

	switch {
	case strings.Contains(raw, "हे.आर") || strings.Contains(raw, "हे. आर"):
		set("area unit", s.AreaUnit, AreaUnitHectare)
		s.AreaUnit = AreaUnitHectare
	case strings.Contains(raw, "आर.चौ.मी") || strings.Contains(raw, "आर. चौ. मी"):
		set("area unit", s.AreaUnit, AreaUnitAre)
		s.AreaUnit = AreaUnitAre
	}

	if m := reTenure.FindStringSubmatch(raw); m != nil {
		switch m[1] {
		case "१", "1", "9", "I", "l": // OCR reads १ as 9 or I
			set("tenure", s.Tenure, "class_1")
			s.Tenure = "class_1"
		case "२", "2", "R":
			set("tenure", s.Tenure, "class_2")
			s.Tenure = "class_2"
		}
	}

	var area string
	if m := reCommonArea.FindStringSubmatch(raw); m != nil {
		area = m[1]
	} else if m := reTotalArea.FindStringSubmatch(raw); m != nil {
		area = m[1]
	} else if m := reNAArea.FindStringSubmatch(raw); m != nil {
		area = m[1]
	}
	if area != "" {
		area = strings.ReplaceAll(devanagariDigits.Replace(area), ",", ".")
		set("total area", devanagariDigits.Replace(s.TotalAreaHR), area)
		s.TotalAreaHR = area
	}

	if strings.Contains(raw, "अकृषिक वापर") || reNAArea.MatchString(raw) || strings.Contains(raw, "बिनशेती") {
		if !s.IsNA {
			changed = append(changed, "non-agricultural (NA)")
		}
		s.IsNA = true
	}

	// A holder's name on the same OCR line as the "कुळाचे नाव व खंड" heading was taken for a tenant
	// (Varap 42/3). A holder can't be their own tenant.
	if t := strings.TrimSpace(s.Tenants); t != "" {
		for _, o := range s.Owners {
			if strings.Contains(t, strings.TrimSpace(o.Name)) || strings.Contains(o.Name, t) {
				changed = append(changed, "tenant cleared (it was a holder's name)")
				s.Tenants = ""
				break
			}
		}
	}

	// Other rights, read by rules: the AI listed them differently on every run.
	var rights []string
	if m := reTukda.FindStringSubmatch(raw); m != nil {
		rights = append(rights, "तुकडा ("+m[1]+")")
	}
	if na := naOrder(raw); na != "" {
		rights = append(rights, NAPermissionPrefix+na)
	}
	if len(rights) > 0 {
		s.OtherRights = rights
	}

	if m := reVerification.FindStringSubmatch(raw); m != nil && strings.Contains(raw, "डिजिटल") {
		s.DigitallySigned = true
		s.VerificationNo = devanagariDigits.Replace(m[1])
		if d := reSignedOn.FindStringSubmatch(raw); d != nil {
			s.SignedOn = devanagariDigits.Replace(d[1])
		}
	}
	return changed
}
