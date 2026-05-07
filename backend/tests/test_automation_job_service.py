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
    def __init__(self):
        self.rows = []

    def add(self, row):
        if row not in self.rows:
            if getattr(row, "id", None) is None:
                row.id = len(self.rows) + 1
            self.rows.append(row)

    def commit(self):
        return None

    def refresh(self, row):  # noqa: ARG002
        return None

    def exec(self, query):
        class _Result:
            def __init__(self, rows, conditions):
                self.rows = rows
                self.conditions = conditions

            def first(self):
                matches = self.rows
                for column, _, expected in self.conditions:
                    matches = [row for row in matches if getattr(row, column) == expected]
                return matches[0] if matches else None

            def all(self):
                return list(self.rows)

        return _Result(self.rows, getattr(query, "conditions", []))


class _AutomationJobStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"


class _AutomationJob:
    job_type = _Column("job_type")
    idempotency_key = _Column("idempotency_key")

    def __init__(self, **kwargs):
        self.id = kwargs.get("id")
        self.job_type = kwargs.get("job_type")
        self.idempotency_key = kwargs.get("idempotency_key")
        self.actor_type = kwargs.get("actor_type", "user")
        self.actor_user_id = kwargs.get("actor_user_id")
        self.payload_json = kwargs.get("payload_json", "{}")
        self.result_json = kwargs.get("result_json")
        self.error_message = kwargs.get("error_message")
        self.status = kwargs.get("status", _AutomationJobStatus.QUEUED)
        self.attempts = kwargs.get("attempts", 0)
        self.max_attempts = kwargs.get("max_attempts", 3)
        self.latency_ms = kwargs.get("latency_ms")
        self.next_retry_at = kwargs.get("next_retry_at")
        self.started_at = kwargs.get("started_at")
        self.finished_at = kwargs.get("finished_at")
        self.created_at = kwargs.get("created_at")
        self.updated_at = kwargs.get("updated_at")


sqlmodel_stub = types.ModuleType("sqlmodel")
sqlmodel_stub.Session = _Session
sqlmodel_stub.select = lambda model: _Query(model)
sys.modules["sqlmodel"] = sqlmodel_stub

models_stub = types.ModuleType("models")
models_stub.__path__ = []
sys.modules["models"] = models_stub

automation_job_module = types.ModuleType("models.automation_job")
automation_job_module.AutomationJob = _AutomationJob
automation_job_module.AutomationJobStatus = _AutomationJobStatus
sys.modules["models.automation_job"] = automation_job_module

from automation_job_service import enqueue_automation_job, register_automation_handler


class AutomationJobServiceTest(unittest.TestCase):
    def test_enqueue_automation_job_is_idempotent(self):
        session = _Session()
        job_type = "test_echo_job"

        @register_automation_handler(job_type)
        def _handler(db_session, payload, actor_user_id, actor_type):  # noqa: ARG001
            return {"value": payload["value"], "actor": actor_type}

        first = enqueue_automation_job(
            session=session,
            job_type=job_type,
            payload={"value": 7},
            actor_user_id=1,
            idempotency_key="same-key",
        )
        second = enqueue_automation_job(
            session=session,
            job_type=job_type,
            payload={"value": 7},
            actor_user_id=1,
            idempotency_key="same-key",
        )

        self.assertEqual(first.id, second.id)
        self.assertEqual(json.loads(first.result_json)["value"], 7)
        self.assertEqual(first.status.value, "succeeded")


if __name__ == "__main__":
    unittest.main()
