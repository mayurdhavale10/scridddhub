package domain

import "testing"

// OCR text of the signed 7/12 for Varap 42/3 (Kalyan), as Tesseract read it on 2026-10-14,
// slips included ("वर्ग -9", "बिन शोती").
const varapOCR = `गाव :- वरप (५५२९७९) तालुका :- कल्याण जिल्हा :- ठाणे
PU-ID : 30315628348 AIG क्रमांक व उपविभाग 8/3 30315628348
भुधारणा पद्धती भोगवटादार वर्ग -9 AAT स्थानीक नाव :
क्षेत्राचेएकक आर.चौ.मी | ९० कमलाकर परशराम कोंगरे (१०९०) [कुळाचे नाव व खंड
अकृषिक क्षेत्र ------सामाईक क्षेत्र------ ११.६०.०० ३७६.०० [इतर अधिकार
बिन शोती ११.६०.०० त्रतचा
बिन होती २.५० क्र.महसुल/कक्ष-१/टे-७/बां.प./वरप- कल्याण
प्रलंबित फेरफार : नाही.
हा गाव नमूना क्रमांक ७ दिनांक २०/०६/२०२२:११:२९:५४ AM रोजी डिजिटल स्वाक्षरीत केला आहे
या संकेत स्थळावर जाऊन 2112100001134296 हा क्रमांक वापरावा.`

func TestApplySignedCopyText(t *testing.T) {
	s := SevenTwelve{TotalAreaHR: "३७६.००"} // the AI took the assessment for the area
	s.ApplySignedCopyText(varapOCR)
	if s.AreaUnit != AreaUnitAre || s.TotalAreaHR != "11.60.00" {
		t.Fatalf("area = %q %q, want are 11.60.00", s.AreaUnit, s.TotalAreaHR)
	}
	if sqm, err := s.AreaSqm(); err != nil || sqm != 1160 {
		t.Fatalf("AreaSqm = %v, %v; want 1160", sqm, err)
	}
	if s.Tenure != "class_1" {
		t.Errorf("tenure = %q, want class_1", s.Tenure)
	}
	if !s.IsNA {
		t.Error("want NA")
	}
	if !s.DigitallySigned || s.VerificationNo != "2112100001134296" || s.SignedOn != "20/06/2022" {
		t.Errorf("signature = %v %q %q", s.DigitallySigned, s.VerificationNo, s.SignedOn)
	}
}

// Varap 42/3 as read at 200 dpi: the second holder's line runs into the tenant heading, and the
// NA order's lines carry text from the area column.
const varapOCR200 = `क्षेत्राचेएकक आर.चौ.मी | ९० कमलाकर परशराम कोंगरे (१०९०) कुळाचे नाव व खंड
RN ——— दिलीप परशराम कोंगरे (१०९०) त
अकृषिक क्षेत्र ------सामाईक क्षेत्र------ ११.६०.०० ३७६.०० [इतर अधिकार
बिन शोती ११.६०.०० foro ooo FERRY) छुकडा (९९)
बिन होती २.५० क्र.महसुल/कक्ष-१/टे-७/बां.प./वरप- कल्याण
आकारणी /एसआर-१०/२०१९ नुसार क्षेत्र ११६०.०० चौ. मी
पिं [ची रहिवास या प्रयोजनासाठी अकृषिक वापर
करणेस व बांधकाम करणेस मंजुर नकाश प्रमाणे
आदेशातील अट क्र. १ ते ६५ यांस अधिन राहुन
परवानगी (१०९०)
प्रलंबित फेरफार : नाही.`

func TestApplySignedCopyTextRights(t *testing.T) {
	s := SevenTwelve{
		Owners:      []SevenTwelveOwner{{Name: "कमलाकर परशराम कोंगरे"}, {Name: "दिलीप परशराम कोंगरे"}},
		Tenants:     "दिलीप परशराम कोंगरे",
		OtherRights: []string{"बिन होती २.५० क्र.महसुल/कक्ष-१"},
	}
	s.ApplySignedCopyText(varapOCR200)
	if s.Tenants != "" {
		t.Errorf("tenant = %q, want cleared", s.Tenants)
	}
	want := []string{
		"तुकडा (९९)",
		NAPermissionPrefix + "क्र.महसुल/कक्ष-१/टे-७/बां.प./वरप- कल्याण /एसआर-१०/२०१९ नुसार क्षेत्र ११६०.०० चौ. मी ची रहिवास या प्रयोजनासाठी अकृषिक वापर करणेस व बांधकाम करणेस मंजुर नकाश प्रमाणे आदेशातील अट क्र. १ ते ६५ यांस अधिन राहुन परवानगी (१०९०)",
	}
	if len(s.OtherRights) != len(want) {
		t.Fatalf("other rights = %q", s.OtherRights)
	}
	for i := range want {
		if s.OtherRights[i] != want[i] {
			t.Errorf("other right %d = %q\nwant %q", i, s.OtherRights[i], want[i])
		}
	}
	for _, f := range s.Flags(nil) {
		if f.Level == "high" {
			t.Errorf("unexpected high flag: %s", f.Text)
		}
	}
}

func TestApplySignedCopyTextCommas(t *testing.T) {
	// The same page OCR'd at 300 dpi printed the separators as commas.
	s := SevenTwelve{TotalAreaHR: "११६०.००"}
	s.ApplySignedCopyText("क्षेत्राचेएकक आर.चौ.मी\nअकृषिक क्षेत्र ------सामाईक क्षेत्र------ ११,६०,०० ३७६,०० इतर अधिकार")
	if s.TotalAreaHR != "11.60.00" {
		t.Fatalf("area = %q, want 11.60.00", s.TotalAreaHR)
	}
}

func TestParseAreSqm(t *testing.T) {
	for in, want := range map[string]float64{"11.60.00": 1160, "५.०७": 507, "3.20.50": 320.5} {
		got, err := ParseAreSqm(in)
		if err != nil || got != want {
			t.Errorf("ParseAreSqm(%q) = %v, %v; want %v", in, got, err, want)
		}
	}
}
