import unittest
from urllib.robotparser import RobotFileParser
from run_permitted_batch import request_key, result_ids


class PermittedBatchTests(unittest.TestCase):
    def test_project_fragments_reuse_one_get(self):
        self.assertEqual(request_key('https://example.test/project#P1'),request_key('https://example.test/project#P2'))

    def test_pagination_form_is_part_of_identity(self):
        self.assertNotEqual(request_key('https://example.test/results',{'pageno':'1'}),request_key('https://example.test/results',{'pageno':'2'}))
        self.assertNotEqual(request_key('https://example.test/results'),request_key('https://example.test/results',{}))
        self.assertEqual(request_key('https://example.test/results',{'city':'1','pageno':'2'}),request_key('https://example.test/results',{'pageno':'2','city':'1'}))

    def test_disallowed_detail_and_allowed_search(self):
        rules=RobotFileParser();rules.parse(['User-agent: *','Disallow: /property/','Disallow: /_next/'])
        self.assertFalse(rules.can_fetch('ResidentialLandResearch/1.0','https://www.reeltor.com/property/P123'))
        self.assertTrue(rules.can_fetch('ResidentialLandResearch/1.0','https://www.reeltor.com/plots-for-sale-in-khadakpada'))

    def test_repeated_results_detected_independent_of_html_order(self):
        a='<a href="/property-detail/plot-123.htm">A</a><a href="/property-detail/plot-456.htm">B</a>'
        b='<a href="/property-detail/plot-456.htm">Changed text</a><a href="/property-detail/plot-123.htm">A</a>'
        self.assertEqual(result_ids(a),result_ids(b))
        self.assertEqual(result_ids('Temporary server issue'),frozenset())


if __name__=='__main__':unittest.main()
