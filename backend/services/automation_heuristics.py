import json
import re
from datetime import datetime, timedelta, timezone as dt_timezone
from typing import Optional
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError


ROLE_HINTS = [
    {
        "match": ("engineer", "developer", "programmer", "software"),
        "title": "Software Engineer",
        "department": "Engineering",
        "education_level": "Bachelor's Degree",
        "experience_years": 3,
        "salary_min": 120000,
        "salary_max": 180000,
        "criteria": ["Python", "React", "API Design", "Testing", "SQL"],
    },
    {
        "match": ("recruiter", "talent acquisition", "hiring"),
        "title": "Recruiter",
        "department": "People Operations",
        "education_level": "Bachelor's Degree",
        "experience_years": 2,
        "salary_min": 70000,
        "salary_max": 110000,
        "criteria": ["Applicant Tracking", "Interviewing", "Communication", "Excel"],
    },
    {
        "match": ("analyst", "reporting", "analytics", "data"),
        "title": "Data Analyst",
        "department": "Analytics",
        "education_level": "Bachelor's Degree",
        "experience_years": 2,
        "salary_min": 80000,
        "salary_max": 120000,
        "criteria": ["SQL", "Reporting", "Dashboards", "Excel"],
    },
]


COMMON_CRITERIA = {
    "python": ("Python", 9),
    "react": ("React", 8),
    "typescript": ("TypeScript", 7),
    "javascript": ("JavaScript", 7),
    "sql": ("SQL", 8),
    "api": ("API Design", 8),
    "testing": ("Testing", 7),
    "communication": ("Communication", 6),
    "leadership": ("Leadership", 6),
    "excel": ("Excel", 5),
    "dashboard": ("Reporting", 6),
    "automation": ("Automation", 7),
    "interview": ("Interviewing", 6),
    "deployment": ("Deployment", 6),
    "compliance": ("Compliance", 6),
    "document": ("Documentation", 5),
}


DATE_PATTERNS = [
    r"\b(\d{4}-\d{2}-\d{2})\b",
    r"\b(\d{1,2}/\d{1,2}/\d{4})\b",
    r"\b(\d{1,2}-\d{1,2}-\d{4})\b",
]


def _guess_role_context(title: str, description_text: str, target_role: Optional[str]) -> dict:
    haystack = " ".join(filter(None, [title, description_text, target_role])).lower()
    for hint in ROLE_HINTS:
        if any(token in haystack for token in hint["match"]):
            return hint
    return {
        "title": target_role or title or "Generalist",
        "department": "General",
        "education_level": "Bachelor's Degree",
        "experience_years": 2,
        "salary_min": 50000,
        "salary_max": 90000,
        "criteria": ["Communication", "Problem Solving", "Ownership", "Collaboration"],
    }


def _normalize_title(title: str, target_role: Optional[str], fallback: str) -> str:
    source = target_role or title or fallback
    cleaned = re.sub(r"\s+", " ", source).strip()
    return cleaned[:200] if cleaned else fallback


def _extract_snippet(description_text: str) -> str:
    text = re.sub(r"\s+", " ", description_text or "").strip()
    if not text:
        return ""
    sentences = re.split(r"(?<=[.!?])\s+", text)
    return " ".join(sentences[:2])[:500]


def _extract_salary_hint(description_text: str, context: dict) -> tuple[Optional[int], Optional[int]]:
    text = description_text or ""
    numbers = [int(match.replace(",", "")) for match in re.findall(r"\b(\d{2,3}(?:,\d{3})+|\d{4,6})\b", text)]
    if len(numbers) >= 2:
        lower, upper = sorted(numbers[:2])
        return lower, upper
    return context.get("salary_min"), context.get("salary_max")


def build_job_draft(title: str = "", description_text: str = "", target_role: Optional[str] = None) -> dict:
    context = _guess_role_context(title, description_text, target_role)
    normalized_title = _normalize_title(title, target_role, context["title"])
    salary_min, salary_max = _extract_salary_hint(description_text, context)

    criteria = []
    seen = set()
    for token, (label, weight) in COMMON_CRITERIA.items():
        if token in f"{title} {description_text} {target_role}".lower() and label not in seen:
            criteria.append(
                {
                    "skill_name": label,
                    "is_must_have": weight >= 7,
                    "weight": weight,
                }
            )
            seen.add(label)
    if not criteria:
        for label in context["criteria"][:5]:
            criteria.append({"skill_name": label, "is_must_have": True, "weight": 7})

    return {
        "title": normalized_title,
        "description": _extract_snippet(description_text) or description_text[:1000],
        "department": context["department"],
        "location": "Remote",
        "employment_type": "full-time",
        "experience_years": context["experience_years"],
        "education_level": context["education_level"],
        "salary_min": salary_min,
        "salary_max": salary_max,
        "salary_currency": "USD",
        "criteria": criteria[:8],
        "salary_hint": "market-aligned" if salary_min and salary_max else "not specified",
    }


def _parse_date_token(token: str) -> Optional[datetime]:
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%m-%d-%Y"):
        try:
            return datetime.strptime(token, fmt)
        except ValueError:
            continue
    return None


def extract_document_metadata(
    filename: str,
    file_text: str = "",
    existing_document_type: Optional[str] = None,
) -> dict:
    haystack = " ".join(filter(None, [filename, file_text, existing_document_type])).lower()
    candidates = [
        ("resume", ["resume", "cv", "curriculum vitae"], "Resume"),
        ("id", ["id", "identity", "passport", "license"], "Valid ID"),
        ("contract", ["contract", "agreement", "nda"], "Contract"),
        ("certification", ["cert", "certificate", "license", "licensure"], "Certification"),
    ]

    document_type_candidate = existing_document_type or "Other"
    confidence = 0.35
    for _, tokens, label in candidates:
        if any(token in haystack for token in tokens):
            document_type_candidate = label
            confidence = 0.82 if label != "Other" else 0.45
            break

    dates = []
    for pattern in DATE_PATTERNS:
        for match in re.findall(pattern, haystack):
            parsed = _parse_date_token(match)
            if parsed:
                dates.append(parsed)
    expiry_date_candidate = min(dates).isoformat() if dates else None
    if expiry_date_candidate:
        confidence = min(0.95, confidence + 0.08)

    if existing_document_type and existing_document_type != document_type_candidate:
        confidence = max(0.4, confidence - 0.1)

    return {
        "document_type_candidate": document_type_candidate,
        "expiry_date_candidate": expiry_date_candidate,
        "confidence": round(confidence, 2),
    }


def suggest_interview_slots(
    existing_start_times: list[datetime] | None = None,
    existing_windows: list[tuple[datetime, datetime]] | None = None,
    timezone_name: str = "UTC",
    duration_minutes: int = 60,
    window_days: int = 5,
    slot_count: int = 3,
) -> list[dict]:
    display_timezone = timezone_name
    try:
        zone = ZoneInfo(timezone_name)
    except (ZoneInfoNotFoundError, ValueError):
        zone = dt_timezone.utc
        display_timezone = "UTC"

    def _to_zone(value: datetime) -> datetime:
        if value.tzinfo is None:
            return value.replace(tzinfo=dt_timezone.utc).astimezone(zone)
        return value.astimezone(zone)

    now = datetime.now(dt_timezone.utc).astimezone(zone)
    windows = list(existing_windows or [])
    if not windows and existing_start_times:
        windows = [
            (start, start + timedelta(minutes=duration_minutes))
            for start in existing_start_times
        ]

    occupied_windows = [
        (_to_zone(start), _to_zone(end))
        for start, end in windows
        if start and end
    ]
    slots: list[dict] = []

    for day_offset in range(1, window_days + 1):
        candidate_day = now + timedelta(days=day_offset)
        if candidate_day.weekday() >= 5:
            continue
        for hour in (9, 11, 13, 15):
            start = candidate_day.replace(hour=hour, minute=0, second=0, microsecond=0)
            end = start + timedelta(minutes=duration_minutes)
            if start <= now:
                continue
            if any(start < existing_end and end > existing_start for existing_start, existing_end in occupied_windows):
                continue
            slots.append(
                {
                    "scheduled_start_at": start.isoformat(),
                    "scheduled_end_at": end.isoformat(),
                    "label": start.strftime(f"%a %b %d, %I:%M %p {display_timezone}"),
                }
            )
            if len(slots) >= slot_count:
                return slots
    return slots


def make_delta_summary(before: dict, after: dict) -> dict:
    return {
        "old_score": before.get("best_match_score"),
        "new_score": after.get("best_match_score"),
        "matched_jobs_delta": int(after.get("matched_open_jobs_count", 0)) - int(before.get("matched_open_jobs_count", 0)),
    }
