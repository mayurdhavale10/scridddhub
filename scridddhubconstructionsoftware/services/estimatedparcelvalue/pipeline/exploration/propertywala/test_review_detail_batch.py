import unittest
from review_detail_batch import extract, SOURCE


class DetailReviewTests(unittest.TestCase):
    def saved(self, ident):
        return extract((SOURCE / 'detail_batch_20260922' / ident / 'body.bin').read_bytes())

    def test_listing_date_excludes_locality_reviews(self):
        row = self.saved('P243109329')
        self.assertEqual(row['page_kind'], 'listing')
        self.assertEqual(row['listing_or_project_dates'], [{'label':'3 days ago', 'datetime':'2026-09-19 18:48:00Z'}])
        self.assertEqual(row['detail_fields']['Area'], '1050 SqFeet')
        self.assertIn('Near kalyan station', row['sections']['Location'])

    def test_project_is_not_individual_parcel(self):
        row = self.saved('P556329459')
        self.assertEqual(row['page_kind'], 'project')
        self.assertIn('250 SqYards', row['sections']['Configurations'])
        self.assertIn('600 SqYards', row['sections']['Configurations'])

    def test_conflicting_evidence_preserved(self):
        row = self.saved('P194298862')
        self.assertEqual(row['detail_fields']['Area'], '1050 SqFeet')
        self.assertIn('3 guntha', row['sections']['Description'])
        self.assertIn('Vasind', row['sections']['Description'])
        self.assertIn('Titwala', row['detail_title'])


if __name__ == '__main__': unittest.main()
