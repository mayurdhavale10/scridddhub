import unittest
from review_alternate_batch import ROOT, price_value, realestateindia, reeltor


class AlternateTests(unittest.TestCase):
    def test_missing_and_non_total_prices_stay_null(self):
        self.assertIsNone(price_value('Call for Price'))
        self.assertIsNone(price_value('50,000 booking amount'))
        self.assertIsNone(price_value('₹ 5 Lac / guntha'))
        self.assertEqual(price_value('₹ 1.90 Cr.'),19000000)

    def test_reeltor_page_label_does_not_override_locality(self):
        rows = reeltor(ROOT/'residential_land_pilots/reeltor/20260923_priority_authorized/khadakpada')
        self.assertEqual(len(rows),20)
        self.assertEqual(len({r['listing_id'] for r in rows}),20)
        self.assertFalse(any('khadakpada' in r['source_locality_label'].lower() for r in rows))
        self.assertEqual(sum(r['title_area_conflict'] for r in rows),9)

    def test_url_price_and_built_area_are_not_plot_values(self):
        rows=realestateindia(ROOT/'residential_land_pilots/realestateindia/20260923_priority/khadakpada')
        by_id={r['listing_id']:r for r in rows}
        self.assertEqual(len(rows),len(by_id))
        self.assertIsNone(by_id['1202164']['area_sqft'])
        self.assertIsNone(by_id['1202164']['price_rupees'])
        self.assertIsNone(by_id['1202160']['price_rupees'])
        self.assertEqual(sum(r['nearby_recommendation'] for r in rows),19)
        self.assertEqual(by_id['1175286']['price_rupees'],982000)


if __name__=='__main__':unittest.main()
