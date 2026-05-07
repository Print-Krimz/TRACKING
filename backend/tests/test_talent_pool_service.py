from datetime import datetime, timedelta, timezone
from enum import Enum
from pathlib import Path
import json
import sys
import types
import unittest

backend_root = Path(__file__).resolve().parents[1]
sys.path.append(str(backend_root / "services"))


class _Column:
    def __init__(self, name):
        self.name = name

    def __eq__(self, other):
        return (self.name, "eq", other)


class _Query:
    def __init__(self, model):
        self.model = model
        self.conditions = []

    def where(self, *conditions):
        self.conditions.extend(conditions)
        return self

    def order_by(self, *args):  # noqa: ARG002
        return self

    def limit(self, *args):  # noqa: ARG002
        return self


class _Session:
    def __init__(self, user=None, source_job=None, best_match_job=None):
        self.user = user
        self.source_job = source_job
        self.best_match_job = best_match_job

    def get(self, model, ident):  # noqa: ARG002
        if ident == 10:
            return self.user
        if ident == 13:
            return self.source_job
        if ident == 14:
            return self.best_match_job
        return None

    def exec(self, query):  # noqa: ARG002
        class _Result:
            def first(self):
                return None

            def all(self):
                return []

        return _Result()

    def add(self, row):  # noqa: ARG002
        return None

    def commit(self):
        return None

    def refresh(self, row):  # noqa: ARG002
        return None


class _ApplicationStatus(str, Enum):
    REJECTED = "rejected"


class _JobStatus(str, Enum):
    OPEN = "open"


class _TalentPoolStatus(str, Enum):
    ACTIVE = "active"


class _TalentPoolEntryResponse:
    def __init__(self, **kwargs):
        self.__dict__.update(kwargs)

    def model_dump(self):
        return dict(self.__dict__)


sqlmodel_stub = types.ModuleType("sqlmodel")
sqlmodel_stub.Session = _Session
sqlmodel_stub.select = lambda model: _Query(model)
sys.modules["sqlmodel"] = sqlmodel_stub

models_stub = types.ModuleType("models")
models_stub.__path__ = []
sys.modules["models"] = models_stub

services_pkg = types.ModuleType("services")
services_pkg.__path__ = []
sys.modules["services"] = services_pkg

application_module = types.ModuleType("models.application")
application_module.Application = type("Application", (), {})
application_module.ApplicationStatus = _ApplicationStatus
sys.modules["models.application"] = application_module

job_module = types.ModuleType("models.job")
job_module.JobRequisition = type("JobRequisition", (), {})
job_module.JobStatus = _JobStatus
sys.modules["models.job"] = job_module

resume_module = types.ModuleType("models.resume")
resume_module.Resume = type("Resume", (), {})
sys.modules["models.resume"] = resume_module

talent_pool_module = types.ModuleType("models.talent_pool")
talent_pool_module.TalentPoolEntry = type("TalentPoolEntry", (), {"pool_status": _Column("pool_status")})
talent_pool_module.TalentPoolStatus = _TalentPoolStatus
sys.modules["models.talent_pool"] = talent_pool_module

user_module = types.ModuleType("models.user")
user_module.User = type("User", (), {})
sys.modules["models.user"] = user_module

schemas_module = types.ModuleType("schemas")
schemas_module.__path__ = []
sys.modules["schemas"] = schemas_module

talent_pool_schema_module = types.ModuleType("schemas.talent_pool")
talent_pool_schema_module.TalentPoolEntryResponse = _TalentPoolEntryResponse
sys.modules["schemas.talent_pool"] = talent_pool_schema_module

matching_module = types.ModuleType("services.matching_service")
matching_module.calculate_match_score = lambda session, job_id, resume_id: (72, {"recommendation": "good", "keywords_matched": []})
sys.modules["services.matching_service"] = matching_module

automation_flags_module = types.ModuleType("services.automation_flags")
automation_flags_module.is_automation_enabled = lambda name: True
sys.modules["services.automation_flags"] = automation_flags_module

from talent_pool_service import rescan_talent_pool_entry


class TalentPoolServiceTest(unittest.TestCase):
    def test_rescan_skips_when_trigger_is_on_cooldown(self):
        session = _Session(
            user=types.SimpleNamespace(username="Candidate One"),
            source_job=types.SimpleNamespace(title="Source Role"),
            best_match_job=types.SimpleNamespace(title="Best Match"),
        )
        entry = types.SimpleNamespace(
            id=1,
            source_application_id=2,
            candidate_id=10,
            resume_id=11,
            source_job_id=13,
            source_status=_ApplicationStatus.REJECTED,
            pool_status=_TalentPoolStatus.ACTIVE,
            notes="note",
            best_match_job_id=14,
            best_match_score=75,
            matched_open_jobs_count=2,
            pooled_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
            last_rescanned_at=datetime.now(timezone.utc),
            rescan_state_json=json.dumps(
                {"manual": (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()}
            ),
        )

        result = rescan_talent_pool_entry(session, entry, trigger_type="manual")

        self.assertTrue(result["skipped"])
        self.assertEqual(result["delta"]["matched_jobs_delta"], 0)
        self.assertEqual(result["delta"]["old_score"], 75)
        self.assertEqual(result["delta"]["new_score"], 75)


if __name__ == "__main__":
    unittest.main()
