import copy
import json
import unittest
from review_numeric_backlog import ROOT, BASE, BASE_HASH, INPUT, PINNED_INPUTS, read, sha, triage, can_admit

OUTPUT=ROOT/'residential_land_pilots/benchmark_review_20260923T073144576096Z'

class NumericReviewTests(unittest.TestCase):
    def test_every_numeric_candidate_has_a_decision_and_verified_evidence(self):
        rows=[r for r in read(INPUT/'realestateindia_unique_listings.jsonl') if r.get('price_rupees') and r.get('area_sqft')]
        self.assertEqual(len(rows),78)
        self.assertEqual(len({r['listing_id'] for r in rows}),78)
        self.assertTrue(all(triage(r)['review_reason'] for r in rows))
        for path, expected in json.loads((OUTPUT/'raw_evidence_manifest.json').read_text()).items():
            self.assertEqual(sha(ROOT/path),expected)
        for name, expected in PINNED_INPUTS.items():
            self.assertEqual(sha(INPUT/name),expected)

    def test_legacy_snapshot_preserved_and_actual_addition(self):
        self.assertEqual(sha(BASE),BASE_HASH)
        old=read(BASE); new=read(OUTPUT/'benchmark_snapshot.jsonl')
        self.assertEqual(new[:364],old)
        self.assertEqual(len(new),365)
        self.assertEqual(new[-1]['listing_id'],'propertywala:P243109329')
        self.assertTrue(can_admit(new[-1]))
        self.assertFalse(new[-1]['khadakpada_verified'])

    def test_block_inconsistent_stale_oversized_and_unresolved(self):
        valid=read(OUTPUT/'approved_additions.jsonl')[0]
        for change in [dict(source_rate_inr_sqft=1),dict(area_sqft=10001),dict(price_inr=0),
                       dict(listing_date_parsed=None),dict(listing_date_parsed='2020-01-01T00:00:00+00:00'),
                       dict(blocking_reasons=['locality_conflict']),dict(decision='not_admitted')]:
            row=copy.deepcopy(valid);row.update(change)
            self.assertFalse(can_admit(row),change)

    def test_group_caps_and_no_split_leakage(self):
        rows=read(OUTPUT/'benchmark_snapshot.jsonl')
        groups=json.loads((OUTPUT/'cross_source_counting_resolutions.json').read_text())
        for g in groups:
            members={(r['source'],r['listing_id']) for r in g['members']}
            present=[r for r in rows if (r['source'],r.get('source_listing_id',r['listing_id'])) in members]
            self.assertEqual(len(present),g['admitted_count'])
            self.assertLessEqual(len(present),1)
        clusters={}
        for r in rows:
            clusters.setdefault(r['evidence_cluster_id'],set()).add(r['fold'])
        self.assertTrue(all(len(folds)==1 for folds in clusters.values()))

    def test_tara_angan_conflict_is_not_lost_at_overview(self):
        row=next(r for r in read(OUTPUT/'realestateindia_78_decisions.jsonl') if r['listing_id']=='1490680')
        self.assertEqual(row['primary_reason'],'project_locality_conflict')
        self.assertFalse(row['admitted_to_benchmark'])
        self.assertIn('Sector 13 Kharghar',(OUTPUT/'tara_angan_full_saved_text.txt').read_text(encoding='utf-8'))

if __name__=='__main__':unittest.main()
