import json
import tempfile
import unittest
from pathlib import Path

from review_saved_pages import parse


class SavedCardTests(unittest.TestCase):
    def parse_card(self, price, area, description='', status=200):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)
            (path / 'response.json').write_text(json.dumps({'status': status, 'url': 'https://propertywala.com/properties/type-residential_plot_land/for-sale/location-mumbai_maharashtra', 'observed_at': '2026-09-22T00:00:00Z'}))
            (path / 'body.bin').write_bytes(f'<article id="P123"><a href="/P123"><img src="x"/><div class="property-price">{price}</div></a><h3>Residential Plot for sale in Juhu</h3><span class="areaUnit">{area}</span><p>{description}</p></article>'.encode())
            return parse(path)[0]

    def test_explicit_unit_conversion_and_provenance(self):
        row = self.parse_card('₹ 2.25 Cr', '250 SqYards')[0]
        self.assertEqual(row['price_rupees'], 22500000)
        self.assertEqual(row['area_sqft'], 2250)
        self.assertEqual(row['recomputed_inr_sqft'], 10000)
        self.assertEqual(row['requested_market'], 'mumbai')
        self.assertEqual(row['source_locality_label'], 'Juhu')
        self.assertFalse(row['admitted_to_benchmark'])

    def test_ranges_missing_units_and_category_conflicts(self):
        row = self.parse_card('₹ 10 - 20 lacs', '2000', '2 BHK apartments')[0]
        self.assertIsNone(row['price_rupees'])
        self.assertIsNone(row['area_sqft'])
        self.assertIn('building_or_commercial_description', row['review_flags'])

    def test_acres_and_refused_response(self):
        self.assertEqual(self.parse_card('₹ 100 Cr', '3 Acres')[0]['area_sqft'], 130680)
        self.assertEqual(self.parse_card('₹ 1 L', '100 SqFeet', status=403), [])


if __name__ == '__main__':
    unittest.main()
