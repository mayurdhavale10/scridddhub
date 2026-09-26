"""Meaningful regression checks for unit conversion, flags and evidence recovery."""
import unittest
from datetime import datetime, timezone
from build_clean_land_data import clean
from magicbricks_residential_plot_crawler import classify_response


class CleanDataTests(unittest.TestCase):
    def row(self, **changes):
        base = dict(source="magicbricks", listing_id="a", market="kalyan", run_id="run",
                    price_rupees=4356000, plot_area=1, plot_area_unit="Acre", price_per_sqft=100,
                    latitude=19.2, longitude=73.1, locality="Kalyan", property_category="Residential Plot",
                    fetched_at="2026-09-20T12:00:00Z", posted_date_raw="2026-09-10T12:00:00Z")
        base.update(changes)
        return clean(base, {"seoURL": "/example", "userType": "Owner"}, "raw/file.json", 1,
                     datetime(2026, 9, 20, tzinfo=timezone.utc))

    def test_acre_conversion_and_preservation(self):
        row = self.row()
        self.assertEqual(row["area_sqft"], 43560)
        self.assertEqual(row["asking_rate_inr_sqft"], 100)
        self.assertEqual(row["plot_area_unit"], "Acre")
        self.assertNotIn("rate_disagreement", row["flags"])
        self.assertIn("large_parcel_review", row["flags"])

    def test_unknown_units_not_assumed(self):
        row = self.row(plot_area_unit="ambiguous")
        self.assertIsNone(row["area_sqft"])
        self.assertFalse(row["provisional_eligible"])

    def test_rate_mismatch_and_rounding(self):
        self.assertIn("rate_disagreement", self.row(price_per_sqft=1000)["flags"])
        self.assertNotIn("rate_disagreement", self.row(price_per_sqft=101)["flags"])

    def test_zero_component_coordinates_and_nan(self):
        self.assertIn("invalid_coordinates", self.row(latitude=0, longitude=73)["flags"])
        self.assertIn("invalid_price", self.row(price_rupees="NaN")["flags"])

    def test_raw_recovery_retains_capture_time(self):
        row = self.row()
        self.assertEqual(row["url"], "https://www.magicbricks.com/example")
        self.assertEqual(row["seller_type"], "Owner")
        self.assertEqual(row["fetched_at"], "2026-09-20T12:00:00Z")

    def test_future_date_and_ambiguous_use(self):
        row = self.row(posted_date_raw="2026-10-01", description="Agricultural land")
        self.assertIn("future_listing_date", row["flags"])
        self.assertEqual(row["land_use_status"], "ambiguous")

    def test_display_price_scale_and_non_total_labels(self):
        self.assertNotIn("display_price_disagreement", self.row(price_display="43.56 Lac")["flags"])
        self.assertIn("display_price_disagreement", self.row(price_display="43.56 Cr")["flags"])
        self.assertIn("ambiguous_price_label", self.row(price_display="Call for Price")["flags"])

    def test_http_200_hidden_challenge_is_not_success(self):
        class HiddenChallenge:
            def locator(self, selector):
                return self

            def count(self):
                return 1
        outcome, reason = classify_response(200, HiddenChallenge())
        self.assertEqual(outcome, "blocked")
        self.assertIn("challenge container", reason)


if __name__ == "__main__":
    unittest.main()
