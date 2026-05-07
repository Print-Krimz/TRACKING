import os


AUTOMATION_FLAG_DEFAULTS = {
    "job_autofill": True,
    "bulk_pipeline_actions": True,
    "scheduled_reports": True,
    "interview_assist": True,
    "pool_autorescan": True,
    "doc_ocr_extract": True,
}


def _env_flag(name: str, default: bool) -> bool:
    raw = os.getenv(f"AUTOMATION_{name.upper()}_ENABLED")
    if raw is None:
        return default
    return raw.strip().lower() not in {"0", "false", "no", "off"}


def is_automation_enabled(name: str) -> bool:
    return _env_flag(name, AUTOMATION_FLAG_DEFAULTS.get(name, True))


def get_automation_flags() -> dict[str, bool]:
    return {name: is_automation_enabled(name) for name in AUTOMATION_FLAG_DEFAULTS}
