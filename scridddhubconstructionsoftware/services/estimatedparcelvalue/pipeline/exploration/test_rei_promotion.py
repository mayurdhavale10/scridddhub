import unittest
from promote_rei_review import OUTPUT, PRIOR, EXPECTED, read, sha, signals, assert_admission

class ReiPromotionTests(unittest.TestCase):
    def test_prior_versions_preserved_and_one_addition(self):
        for p,h in EXPECTED.items():self.assertEqual(sha(p),h)
        new=read(OUTPUT/'benchmark_snapshot.jsonl')
        self.assertEqual(new[:365],read(PRIOR/'benchmark_snapshot.jsonl'))
        self.assertEqual(len(new),366)
        self.assertEqual(len({(r['source'],r['listing_id']) for r in new}),366)
        assert_admission(new[-1])

    def test_price_alone_is_not_project_or_parcel_match(self):
        match,_=signals(dict(locality='Virar',price_rupees=5000000,plot_area='2500',plot_area_unit='Sq-ft'))
        self.assertEqual(match,['same_broad_locality_price_only'])
        match,_=signals(dict(project_name='Garden K Avenue',locality='Virar West',area_sqft=595))
        self.assertIn('same_project_name',match)
        self.assertIn('same_locality_area_within_10_percent',match)

    def test_invalid_admission_fields_fail(self):
        valid=read(OUTPUT/'approved_additions.jsonl')[0]
        for changes in [dict(listing_date_parsed=None),dict(listing_age_days_at_capture=181),dict(area_sqft=10001),
                        dict(source_rate_inr_sqft=5000000),dict(blocking_reasons=['locality_conflict']),dict(duplicate_screen_complete=False)]:
            row=dict(valid,**changes)
            with self.assertRaises(AssertionError):assert_admission(row)

    def test_cluster_folds_do_not_split_and_no_khadakpada_claim(self):
        rows=read(OUTPUT/'benchmark_snapshot.jsonl');groups={}
        for r in rows:groups.setdefault(r['evidence_cluster_id'],set()).add(r['fold'])
        self.assertTrue(all(len(v)==1 for v in groups.values()))
        self.assertFalse(rows[-1]['khadakpada_verified'])

if __name__=='__main__':unittest.main()
