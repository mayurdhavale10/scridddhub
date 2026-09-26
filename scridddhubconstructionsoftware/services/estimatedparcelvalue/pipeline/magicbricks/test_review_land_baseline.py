import unittest
from review_land_baseline import area_band, cluster_rows, estimate, evaluate, locality_key, reviewed_eligible


def row(i, rate=100, cluster=None):
    return dict(listing_id=str(i), property_group_id=str(i), evidence_cluster_id=cluster or str(i),
                locality_key="city | locality", area_band="0-1500 sqft", benchmark_segment="individual_or_unknown",
                asking_rate_inr_sqft=rate, project_name=None, city="City", coordinate_status="missing_or_invalid")


class BaselineTests(unittest.TestCase):
    def test_contextual_keyword_cannot_override_other_exclusions(self):
        record = dict(listing_id="kVjGs8gWy5RzpSvf+uAgZw==", provisional_eligible=False,
                      flags=["land_use_keyword_review"])
        self.assertTrue(reviewed_eligible(record))
        record["flags"].append("rate_disagreement")
        self.assertFalse(reviewed_eligible(record))

    def test_source_city_is_not_locality(self):
        self.assertIsNone(locality_key(dict(city="Mumbai", source_locality="Mumbai")))
        self.assertEqual(locality_key(dict(city="Navi Mumbai", source_locality="Chirle, Navi Mumbai")), "navi mumbai | chirle")

    def test_area_boundaries(self):
        self.assertEqual(area_band(1500), "0-1500 sqft")
        self.assertEqual(area_band(1501), "1500-3000 sqft")

    def test_repeated_cluster_cannot_inflate_support(self):
        training = [row(i, cluster="same") for i in range(20)]
        self.assertEqual(estimate(training, row(100))["status"], "insufficient_data")

    def test_equal_cluster_weights_and_target_not_used(self):
        training = [row(i, 100, "a") for i in range(20)] + [row(i, 1000) for i in range(21,25)]
        result = estimate(training, row(99, 999999))
        self.assertEqual(result["estimate"], 1000)
        self.assertEqual(result["supporting_evidence_clusters"], 5)

    def test_transitive_project_and_pin_grouping(self):
        a, b, c = row(1), row(2), row(3)
        a["project_name"] = b["project_name"] = "Project"
        for r in (b,c):
            r.update(coordinate_status="within_broad_target_box_unverified", latitude=19.12345, longitude=73.12345)
        result = cluster_rows([a,b,c])
        self.assertEqual(len({r["evidence_cluster_id"] for r in result}), 1)

    def test_fold_excludes_whole_cluster(self):
        rows = [row(i, rate=100+i, cluster="same") for i in range(10)]
        results = evaluate(rows)
        self.assertTrue(all(r["status"] == "insufficient_data" for r in results))
        self.assertEqual(len({r["fold"] for r in results}), 1)

    def test_no_cross_locality_fallback(self):
        training = [row(i) for i in range(10)]
        target = row(99)
        target["locality_key"] = "other"
        self.assertIsNone(estimate(training, target)["estimate"])


if __name__ == "__main__":
    unittest.main()
