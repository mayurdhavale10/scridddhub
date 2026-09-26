"""Offline regression checks for the captured pilot; never requests live pages."""
import json
import hashlib
import unittest

from review_khadakpada_pilot import EXPECTED, PILOT, ROOT, pair_reasons, sha, visible_text


class PilotReviewTests(unittest.TestCase):
    def test_related_advertisements_do_not_become_distinct_because_of_price(self):
        a = dict(project_name="Nebula CH", latitude=19.25, longitude=73.12,
                 area_sqft=760, address="Khadakpada", price_inr=8000000)
        b = dict(a, price_inr=20000000)
        self.assertEqual(pair_reasons(a, a), pair_reasons(a, b))
        self.assertIn("same_project_name", pair_reasons(a, b))

    def test_visible_review_does_not_treat_script_values_as_displayed_fields(self):
        markup = '<script>Sold Out; totalFloor=4</script><style>.x{}</style><p>Floors allowed for construction 4</p>'
        result = visible_text(markup)
        self.assertNotIn("Sold Out", result)
        self.assertIn("Floors allowed for construction 4", result)

    def test_provenance_and_locality_review_cover_every_card(self):
        rows = [json.loads(line) for line in (PILOT / "review/diagnostic_observations.jsonl").read_text(encoding="utf-8").splitlines()]
        self.assertEqual(len(rows), 10)
        self.assertEqual(sum(r["result_kind"] == "direct" for r in rows), 3)
        self.assertEqual(len({tuple(r["source_identity"]) for r in rows}), 10)
        for row in rows:
            self.assertFalse(row["eligible_for_model"])
            self.assertIsNone(row["resolved_locality"])
            self.assertEqual(row["raw_sha256"], EXPECTED["search"])
        # Cross-portal listing IDs must retain distinct identities.
        example = rows[0]
        self.assertNotEqual(tuple(example["source_identity"]), ("magicbricks", example["listing_id"]))

    def test_raw_and_reference_evidence_is_unchanged(self):
        for folder, expected in EXPECTED.items():
            self.assertEqual(sha(PILOT / folder / "body.bin"), expected)
        reference = ROOT / "magicbricks_mmr_data/derived/review_baseline_20260920T171020225465Z"
        self.assertEqual(sha(reference / "benchmark_snapshot.jsonl"),
                         "250762e9678af0e6478a568743e17e8ee06fe089d3fa5009d3d8802831767b86")
        manifest = json.loads((PILOT / "review/preservation_manifest.json").read_text())
        for name, expected in manifest["original_files"].items():
            path = ROOT / name
            if name.replace("/", "\\") == "magicbricks_mmr_data\\records.jsonl":
                # The collection is append-only now. Preserve the reviewed
                # historical prefix while allowing explicitly collected rows
                # to follow it.
                lines = path.read_bytes().splitlines(keepends=True)
                historical_prefix = b"".join(lines[:889])
                self.assertEqual(hashlib.sha256(historical_prefix).hexdigest(), expected, name)
            else:
                self.assertEqual(sha(path), expected, name)


if __name__ == "__main__":
    unittest.main()
