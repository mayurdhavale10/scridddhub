import unittest
from review_growth_batch import propertywala_reviews


class GrowthReviewTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.rows=propertywala_reviews()
        cls.index={r['listing_id']:r for r in cls.rows}

    def test_all_saved_ids_have_one_review(self):
        self.assertEqual(len(self.rows),65)
        self.assertEqual(len(self.index),65)
        self.assertFalse(any(r['review_status']=='detail_not_captured' for r in self.rows))
        self.assertFalse(any(r['admitted_to_benchmark'] for r in self.rows))

    def test_shared_project_is_not_independent_parcels(self):
        ids=['P5181885','P8838681','P4478182','P4128136','P6802823','P7028968','P6851288','P4138513','P7447738','P5084478']
        group=[self.index[i] for i in ids]
        self.assertEqual(len({r['detail_sha256'] for r in group}),1)
        self.assertTrue(all(r['review_status']=='hold_project_configuration' for r in group))

    def test_agricultural_description_overrides_search_label(self):
        for ident in ['P582129462','P829463013','P28937340']:
            self.assertEqual(self.index[ident]['review_status'],'exclude_agricultural_description')
        self.assertEqual(self.index['P243109329']['review_status'],'candidate_pending_locality_and_duplicates')


if __name__=='__main__':unittest.main()
