"""Regression tests for auditable transcript parsing."""
import importlib.util
import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "parse_transcript_and_walkthrough.py"
FIXTURE = ROOT / "tests" / "fixtures" / "transcript_parser_cases.txt"
SPEC = importlib.util.spec_from_file_location("transcript_parser", SCRIPT)
assert SPEC and SPEC.loader
parser = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = parser
SPEC.loader.exec_module(parser)


class TranscriptParserTest(unittest.TestCase):
    def test_commands_are_metadata_and_duplicate_title_uses_final_heading(self):
        records = parser.parse_transcript(FIXTURE)

        self.assertEqual([record["title"] for record in records], ["Meadow", "Meadow"])
        self.assertEqual([record["source"]["frame"]["command"] for record in records], ["look", "look"])
        self.assertEqual(records[0]["source"]["ignored_title_lines"], [3])
        self.assertEqual(records[0]["source"]["title"]["line"], 6)
        self.assertEqual(records[0]["description"], "A café beside the 汉字 marker.\nThe grass is wet.")
        self.assertEqual(records[1]["description"], "A later visit.")

    def test_utf8_byte_span_and_line_span_point_to_the_parsed_source(self):
        record = parser.parse_transcript(FIXTURE)[0]
        source = record["source"]["description"]
        fixture_bytes = FIXTURE.read_bytes()

        self.assertEqual((source["start_line"], source["end_line"]), (7, 8))
        self.assertEqual(fixture_bytes[source["byte_start"] : source["byte_end"]].decode("utf-8"), record["description"])

    def test_report_does_not_merge_unverified_hardcoded_notes(self):
        report = parser.build_report(FIXTURE)

        self.assertEqual(report["merge_policy"]["strategy"], "none")
        self.assertTrue(report["merge_policy"]["manual_resolution_required"])
        hardcoded = report["hardcoded_wabe_descriptions"]["meadow"]
        self.assertEqual(hardcoded["source"]["kind"], "hardcoded_wabe_note")
        self.assertIn("Unverified", hardcoded["source"]["verification"])
        self.assertEqual(len(report["parsed_transcript"]), 2)


if __name__ == "__main__":
    unittest.main()
