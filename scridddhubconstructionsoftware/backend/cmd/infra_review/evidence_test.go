package main

import "testing"

// Text as it appears on MMRDA's Metro Line 7 page (2026-09-29).
const ml7Page = "Mumbai Metro Line 7 (ANDHERI EAST - DAHISAR EAST)\n" +
	"10.7 km with 9 stations (Aarey, Dindoshi, Kurar, Akurli, Poisar, Magathane, Devipada, Rashtriya Udyan, Ovaripada) is operational from 2nd April, 2022.\n" +
	"5.8 km with 4 stations (Gundavali, Mogra, Jogeshwari(East), Goregaon(East)) is operational from 19th January, 2023."

func TestQuoteOnPage(t *testing.T) {
	if !quoteOnPage(ml7Page, "is  operational from 19th January,\n2023") {
		t.Error("whitespace and case differences must not matter")
	}
	if !quoteOnPage("SEWRI – NHAVASHEVA ATAL SETU", "Sewri - Nhavasheva Atal Setu") {
		t.Error("dash styles must not matter")
	}
	if quoteOnPage(ml7Page, "is operational from 2024") {
		t.Error("a quote not on the page must fail")
	}
	if quoteOnPage(ml7Page, "operational") {
		t.Error("a quote too short to mean anything must fail")
	}
}

func TestSentenceWith(t *testing.T) {
	line, ok := sentenceWith("for up gradation of highway form Pen Khopoli KM 00+000 to KM 33+328 section of NH 166D", "Pen")
	if !ok || line == "" {
		t.Fatal("Pen is named on the page")
	}
	if _, ok := sentenceWith("upgradation of the penal compensatory scheme", "Pen"); ok {
		t.Error("must match whole words only (not 'penal')")
	}
}
