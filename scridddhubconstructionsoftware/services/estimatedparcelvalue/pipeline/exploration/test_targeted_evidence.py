import unittest
from review_targeted_evidence import extract, consistent_rate, OUTPUT, EXPECTED, read, sha

class TargetedEvidenceTests(unittest.TestCase):
    def test_footer_time_is_not_listing_date(self):
        p=extract('<div>Listing ID : 1 ₹ 18 Lac ₹ 885/Sq.ft. Area 2034 Sq.ft. Location & Connectivity</div><span id="2026-09-2313:37:06"></span>')
        self.assertIsNone(p['explicit_listing_date'])
        self.assertEqual(p['source_rate'],885)

    def test_guntha_rate_keeps_its_unit(self):
        p=extract('<div>Listing ID : 1 ₹ 50 Cr. ₹ 5.56 Cr/Guntha Area 9 Guntha</div>')
        self.assertEqual(p['source_rate_unit'],'Guntha')
        self.assertTrue(consistent_rate(500000000,9,p['source_rate']))

    def test_total_mislabelled_as_rate_is_rejected(self):
        p=extract('<div>Listing ID : 1 ₹ 7.25 Lac ₹ 7.25 Lac/Sq.ft. Area 1744 Sq.ft.</div>')
        self.assertFalse(consistent_rate(725000,1744,p['source_rate']))

    def test_all_four_resolved_to_explicit_reasons_and_benchmarks_preserved(self):
        rows=read(OUTPUT/'detail_decisions.jsonl')
        self.assertEqual(len(rows),4)
        self.assertEqual(sum(r['rate_consistent'] for r in rows),3)
        self.assertTrue(all(r['reasons'] and not r['admitted_to_benchmark'] for r in rows))
        for p,h in EXPECTED.items():self.assertEqual(sha(p),h)

if __name__=='__main__':unittest.main()
