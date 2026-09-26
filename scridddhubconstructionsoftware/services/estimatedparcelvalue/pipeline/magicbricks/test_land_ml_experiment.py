"""Leakage, grouping, weighting and abstention tests; synthetic targets only."""
import math
import unittest

import numpy as np
from threadpoolctl import threadpool_limits

from run_land_ml_experiment import features, group_weights, make_model, prediction, split_rows


def row(i, **overrides):
    result = dict(source="magicbricks", listing_id=str(i), area_sqft=1000+i*10,
        asking_rate_inr_sqft=500+i, city="city", locality_key="city | locality",
        benchmark_segment="individual_or_unknown", area_band="0-1500 sqft",
        evidence_cluster_id=f"group{i}", fold=i%5)
    result.update(overrides)
    return result


class MLExperimentTests(unittest.TestCase):
    def test_feature_allowlist_excludes_target_price_text_and_identity(self):
        a = row(1)
        b = dict(a, asking_rate_inr_sqft=999999, price_inr=1, price_rupees=1,
                 source_rate_inr_sqft=1, description="Price 1 rupee", listing_id="new",
                 project_name="Target price encoded here", evidence_cluster_id="other",
                 latitude=90, longitude=180)
        np.testing.assert_array_equal(features([a]), features([b]))

    def test_whole_group_holdout_required(self):
        with self.assertRaisesRegex(ValueError, "crosses"):
            split_rows([row(1, evidence_cluster_id="same", fold=0),
                        row(2, evidence_cluster_id="same", fold=1)], 0)

    def test_repeated_advertisements_get_one_group_total_weight(self):
        rows = [row(i, evidence_cluster_id="repeated") for i in range(10)] + [row(11)]
        weights = group_weights(rows)
        self.assertAlmostEqual(sum(weights[:10]), weights[10])

    def test_learned_number_cannot_override_insufficient_evidence(self):
        result = prediction(row(1), "model", 999.0,
                            dict(supporting_evidence_clusters=4, supporting_listing_ids=100))
        self.assertIsNone(result["estimate"])
        self.assertEqual(result["status"], "insufficient_data")

    def test_preprocessing_uses_training_only_and_output_has_rate_units(self):
        training = [row(i, asking_rate_inr_sqft=1000) for i in range(25)]
        test = row(200, locality_key="heldout-only locality", area_sqft=5000)
        with threadpool_limits(limits=1):
            for name in ("ridge_log_rate", "hist_gradient_boosting_log_rate"):
                model = make_model(name)
                model.fit(features(training), [r["asking_rate_inr_sqft"] for r in training],
                          model__sample_weight=group_weights(training))
                result = model.predict(features([test]))[0]
                self.assertAlmostEqual(result, 1000, places=5)
                transform = model.regressor_.named_steps["features"]
                categories = transform.named_transformers_["categorical"].categories_[1]
                self.assertNotIn("heldout-only locality", categories)
                mean = transform.named_transformers_["numeric"].mean_[0]
                self.assertAlmostEqual(mean, np.mean([math.log(r["area_sqft"]) for r in training]))


if __name__ == "__main__":
    unittest.main()
