from pathlib import Path
import sys
import unittest
from datetime import datetime as real_datetime, timedelta, timezone

sys.path.append(str(Path(__file__).resolve().parents[1]))
sys.path.append(str(Path(__file__).resolve().parents[1] / "services"))

import automation_heuristics as heuristics
from automation_heuristics import build_job_draft, extract_document_metadata, suggest_interview_slots


class AutomationHeuristicsTest(unittest.TestCase):
    def test_build_job_draft_normalizes_role_and_criteria(self):
        draft = build_job_draft(
            title="senior software eng",
            description_text="Build APIs. Use Python and React. Own testing.",
            target_role="platform engineer",
        )

        self.assertTrue(draft["title"])
        self.assertEqual(draft["department"], "Engineering")
        self.assertTrue(any(item["skill_name"] == "Python" for item in draft["criteria"]))

    def test_extract_document_metadata_detects_type_and_expiry(self):
        metadata = extract_document_metadata(
            "contract_2026-04-30.pdf",
            "This agreement expires on 2026-04-30.",
            "Contract",
        )

        self.assertEqual(metadata["document_type_candidate"], "Contract")
        self.assertTrue(metadata["expiry_date_candidate"].startswith("2026-04-30"))
        self.assertGreaterEqual(metadata["confidence"], 0.8)

    def test_suggest_interview_slots_avoids_conflicts_in_timezone(self):
        fixed_now = real_datetime(2026, 4, 29, 8, 0, tzinfo=timezone.utc)

        class _FixedDateTime(real_datetime):
            @classmethod
            def now(cls, tz=None):
                return fixed_now if tz is None else fixed_now.astimezone(tz)

        original_datetime = heuristics.datetime
        heuristics.datetime = _FixedDateTime
        try:
            slots = suggest_interview_slots(
                existing_windows=[
                    (
                        real_datetime(2026, 4, 30, 9, 0, tzinfo=timezone.utc),
                        real_datetime(2026, 4, 30, 10, 0, tzinfo=timezone.utc),
                    )
                ],
                timezone_name="UTC",
                duration_minutes=60,
                window_days=2,
                slot_count=2,
            )
        finally:
            heuristics.datetime = original_datetime

        self.assertEqual(len(slots), 2)
        self.assertTrue(slots[0]["scheduled_start_at"].startswith("2026-04-30T11:00"))
        self.assertIn("UTC", slots[0]["label"])

    def test_suggest_interview_slots_falls_back_to_utc_label(self):
        fixed_now = real_datetime(2026, 4, 29, 8, 0, tzinfo=timezone.utc)

        class _FixedDateTime(real_datetime):
            @classmethod
            def now(cls, tz=None):
                return fixed_now if tz is None else fixed_now.astimezone(tz)

        original_datetime = heuristics.datetime
        heuristics.datetime = _FixedDateTime
        try:
            slots = suggest_interview_slots(
                existing_windows=[],
                timezone_name="Not/AZone",
                duration_minutes=60,
                window_days=1,
                slot_count=1,
            )
        finally:
            heuristics.datetime = original_datetime

        self.assertEqual(len(slots), 1)
        self.assertIn("UTC", slots[0]["label"])


if __name__ == "__main__":
    unittest.main()
