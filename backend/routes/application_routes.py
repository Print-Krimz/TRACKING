"""
Application Routes

API endpoints for job applications and role-based quiz assessment.
"""

import json
import re
from collections import defaultdict
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from database import get_session
from dependencies import check_permissions, get_current_user
from models.application import Application, ApplicationStatus
from models.application_interview import (
    ApplicationInterview,
    InterviewStatus,
)
from models.application_message import ApplicationMessage, ApplicationMessageThread
from models.job import JobRequisition, JobStatus
from models.permission import Permission, RolePermissionLink
from models.quiz import ApplicationQuizResult, QuizOutcome
from models.resume import Resume
from models.talent_pool import TalentPoolEntry
from models.user import User
from models.notification import NotificationType
from schemas.application import (
    ApplicationCreateRequest,
    ApplicationListResponse,
    ApplicationQuizResultResponse,
    ApplicationResponse,
    ApplicationStatusUpdate,
    CandidateApplicationList,
    CandidateApplicationResponse,
    JobQuizQuestionResponse,
    JobQuizResponse,
    QuizSkillBreakdownItem,
)
from schemas.interview import (
    InterviewCreateRequest,
    InterviewListResponse,
    InterviewResponse,
)
from schemas.messaging import (
    MarkMessagesReadRequest,
    MessageSendRequest,
    MessageThreadResponse,
)
from services.audit_service import log_audit
from services.notification_service import create_notification
from services.talent_pool_service import save_application_to_talent_pool


PASS_SCORE_PERCENT = 70
MUST_HAVE_PASS_PERCENT = 60
MAX_QUIZ_QUESTIONS = 12
MIN_QUIZ_QUESTIONS = 8


SKILL_QUIZ_TEMPLATES = {
    "python": [
        {
            "question_type": "practical",
            "difficulty": "medium",
            "question_text": "Scenario: While working on `{responsibility}`, user input can be malformed. What is the best first step?",
            "options": [
                "Validate and sanitize inputs before business logic runs",
                "Cast everything to strings to avoid exceptions",
                "Ignore invalid records silently",
                "Wrap all code in a broad `except` and continue",
            ],
            "correct_option": 0,
        },
        {
            "question_type": "conceptual",
            "difficulty": "medium",
            "question_text": "In Python services, why avoid mutable default arguments in function definitions?",
            "options": [
                "They increase memory usage only",
                "They persist state across calls and can cause hidden bugs",
                "They prevent function reuse",
                "They disable type hints",
            ],
            "correct_option": 1,
        },
        {
            "question_type": "practical",
            "difficulty": "hard",
            "question_text": "Scenario: An async Python endpoint is slow under concurrency. Which change is most effective first?",
            "options": [
                "Move blocking I/O to non-blocking async libraries or workers",
                "Add more print statements for tracing",
                "Replace async with recursion",
                "Disable retries for external calls",
            ],
            "correct_option": 0,
        },
    ],
    "javascript": [
        {
            "question_type": "practical",
            "difficulty": "medium",
            "question_text": "Scenario: A UI action triggers two API calls and one may fail. What is the most reliable handling approach?",
            "options": [
                "Use structured async error handling and show actionable feedback",
                "Ignore failures because users can refresh",
                "Use `setTimeout` to hide race conditions",
                "Convert promises to global variables",
            ],
            "correct_option": 0,
        },
        {
            "question_type": "conceptual",
            "difficulty": "medium",
            "question_text": "Why is `===` generally preferred over `==` in production JavaScript?",
            "options": [
                "It is faster in every engine",
                "It avoids implicit type coercion surprises",
                "It supports async/await",
                "It automatically validates API payloads",
            ],
            "correct_option": 1,
        },
        {
            "question_type": "practical",
            "difficulty": "hard",
            "question_text": "Scenario: Event handlers cause memory growth after page changes. What should you verify first?",
            "options": [
                "That listeners/subscriptions are cleaned up on teardown",
                "That all functions use `var`",
                "That bundling is disabled in production",
                "That the page title updates correctly",
            ],
            "correct_option": 0,
        },
    ],
    "react": [
        {
            "question_type": "practical",
            "difficulty": "medium",
            "question_text": "Scenario: A list reorders and selected state jumps to wrong items. What is the likely fix?",
            "options": [
                "Use stable unique keys tied to persistent item identity",
                "Use array index as key in all cases",
                "Disable re-rendering entirely",
                "Store UI state in localStorage only",
            ],
            "correct_option": 0,
        },
        {
            "question_type": "conceptual",
            "difficulty": "medium",
            "question_text": "What is the main purpose of the dependency array in `useEffect`?",
            "options": [
                "To define when side effects should re-run",
                "To enable CSS modules",
                "To auto-memoize every variable",
                "To prevent component unmounting",
            ],
            "correct_option": 0,
        },
        {
            "question_type": "practical",
            "difficulty": "hard",
            "question_text": "Scenario: A child component mutates props and bugs appear across screens. What is the best correction?",
            "options": [
                "Treat props as immutable and update state via controlled data flow",
                "Clone everything with JSON stringify in render",
                "Disable strict mode",
                "Move all logic into one component file",
            ],
            "correct_option": 0,
        },
    ],
    "sql": [
        {
            "question_type": "practical",
            "difficulty": "medium",
            "question_text": "Scenario: A report query became slow after data growth. What is the most appropriate first optimization?",
            "options": [
                "Inspect execution plan and add/select proper indexes",
                "Select more columns to reduce joins",
                "Move filters from WHERE to client code",
                "Replace joins with nested loops in application code",
            ],
            "correct_option": 0,
        },
        {
            "question_type": "conceptual",
            "difficulty": "medium",
            "question_text": "When should a transaction be used in database operations?",
            "options": [
                "Only for read-only queries",
                "When multiple dependent writes must succeed or fail together",
                "Only when table size is small",
                "Only for temporary tables",
            ],
            "correct_option": 1,
        },
        {
            "question_type": "practical",
            "difficulty": "hard",
            "question_text": "Scenario: Two concurrent updates overwrite each other. Which strategy best prevents lost updates?",
            "options": [
                "Use proper transaction isolation or optimistic locking",
                "Increase query timeout",
                "Disable constraints",
                "Retry writes without checking version/state",
            ],
            "correct_option": 0,
        },
    ],
    "networking": [
        {
            "question_type": "practical",
            "difficulty": "medium",
            "question_text": "Scenario: Users intermittently cannot reach an internal service. What is a strong first troubleshooting sequence?",
            "options": [
                "Check DNS resolution, routing path, and firewall rules",
                "Reboot all endpoints immediately",
                "Increase browser cache size",
                "Disable TLS on the service",
            ],
            "correct_option": 0,
        },
        {
            "question_type": "conceptual",
            "difficulty": "medium",
            "question_text": "Why is TCP typically chosen over UDP for critical transactional APIs?",
            "options": [
                "TCP guarantees ordered and reliable delivery",
                "TCP always has lower latency",
                "UDP cannot cross subnets",
                "TCP removes the need for retries",
            ],
            "correct_option": 0,
        },
        {
            "question_type": "practical",
            "difficulty": "hard",
            "question_text": "Scenario: Latency spikes after a new route was deployed. What is the best evidence-based next step?",
            "options": [
                "Capture baseline metrics and compare hop-by-hop path changes",
                "Randomly change MTU values",
                "Disable monitoring to reduce overhead",
                "Switch all traffic to broadcast",
            ],
            "correct_option": 0,
        },
    ],
    "docker": [
        {
            "question_type": "practical",
            "difficulty": "medium",
            "question_text": "Scenario: A container works locally but fails in CI due to missing dependencies. What improves reliability most?",
            "options": [
                "Pin dependencies and build from a deterministic Dockerfile",
                "Install dependencies manually after container start",
                "Run as root and disable image caching",
                "Keep mutable state inside the container filesystem",
            ],
            "correct_option": 0,
        },
        {
            "question_type": "conceptual",
            "difficulty": "medium",
            "question_text": "What is the main value of Docker image layers in build pipelines?",
            "options": [
                "They support incremental caching and reproducible builds",
                "They remove the need for base images",
                "They encrypt all runtime traffic",
                "They eliminate dependency versions",
            ],
            "correct_option": 0,
        },
        {
            "question_type": "practical",
            "difficulty": "hard",
            "question_text": "Scenario: Containers restart without clear errors. What should be added first for safer operations?",
            "options": [
                "Health checks and structured startup/readiness logging",
                "Long random sleep in entrypoint",
                "Disable restart policy",
                "Hardcode secrets in the image",
            ],
            "correct_option": 0,
        },
    ],
    "linux": [
        {
            "question_type": "practical",
            "difficulty": "medium",
            "question_text": "Scenario: A service is failing in production Linux hosts. Which action is best first?",
            "options": [
                "Inspect service logs and status to identify root cause before changes",
                "Delete old logs and restart repeatedly",
                "Disable permissions checks",
                "Run all services as root permanently",
            ],
            "correct_option": 0,
        },
        {
            "question_type": "conceptual",
            "difficulty": "medium",
            "question_text": "Why should least-privilege file permissions be enforced on deployment artifacts?",
            "options": [
                "To reduce attack surface and accidental modification risk",
                "To improve CPU throughput",
                "To remove the need for backups",
                "To bypass authentication",
            ],
            "correct_option": 0,
        },
        {
            "question_type": "practical",
            "difficulty": "hard",
            "question_text": "Scenario: CPU spikes are intermittent and difficult to reproduce. What provides the most actionable signal?",
            "options": [
                "Correlate process-level metrics with logs during spike windows",
                "Change shell prompt and rerun manually",
                "Disable all cron jobs permanently",
                "Increase swap without investigation",
            ],
            "correct_option": 0,
        },
    ],
    "aws": [
        {
            "question_type": "practical",
            "difficulty": "medium",
            "question_text": "Scenario: You need static assets with global low-latency delivery. Which design is most suitable?",
            "options": [
                "Store assets in S3 and serve through CloudFront",
                "Serve assets directly from a database",
                "Use only Lambda with no object storage",
                "Place static assets in a private subnet only",
            ],
            "correct_option": 0,
        },
        {
            "question_type": "conceptual",
            "difficulty": "medium",
            "question_text": "What is the purpose of least-privilege IAM policies?",
            "options": [
                "Grant only permissions required for explicit tasks",
                "Allow all actions for faster delivery",
                "Replace auditing and logging",
                "Avoid using roles in production",
            ],
            "correct_option": 0,
        },
        {
            "question_type": "practical",
            "difficulty": "hard",
            "question_text": "Scenario: Traffic is unpredictable and occasionally doubles. What setup best handles this with controlled cost?",
            "options": [
                "Autoscaling with health checks and observable scaling policies",
                "Single large instance with no alarms",
                "Manual scaling after user complaints",
                "Disable load balancing to reduce complexity",
            ],
            "correct_option": 0,
        },
    ],
    "html": [
        {
            "question_type": "practical",
            "difficulty": "easy",
            "question_text": "Scenario: A form field is not announced correctly by screen readers. What should be fixed first?",
            "options": [
                "Ensure explicit label association with the input control",
                "Increase font size only",
                "Remove semantic tags",
                "Replace form with div elements",
            ],
            "correct_option": 0,
        },
        {
            "question_type": "conceptual",
            "difficulty": "easy",
            "question_text": "Why are semantic HTML elements preferred in production interfaces?",
            "options": [
                "They improve accessibility and document meaning",
                "They disable CSS overrides",
                "They guarantee zero JavaScript",
                "They automatically optimize images",
            ],
            "correct_option": 0,
        },
        {
            "question_type": "practical",
            "difficulty": "medium",
            "question_text": "Scenario: A navigation menu is keyboard inaccessible. Which correction is most appropriate?",
            "options": [
                "Use semantic interactive elements with proper focus handling",
                "Hide focus outline globally",
                "Capture all key events at document root only",
                "Rely exclusively on mouse interactions",
            ],
            "correct_option": 0,
        },
    ],
    "css": [
        {
            "question_type": "practical",
            "difficulty": "easy",
            "question_text": "Scenario: A card layout breaks on smaller screens. Which approach is most robust?",
            "options": [
                "Use responsive layout rules (flex/grid + breakpoints)",
                "Set fixed pixel widths for all viewports",
                "Disable wrapping for all containers",
                "Reduce font size to 8px",
            ],
            "correct_option": 0,
        },
        {
            "question_type": "conceptual",
            "difficulty": "medium",
            "question_text": "What is the main consequence of high CSS specificity in large codebases?",
            "options": [
                "Styles become harder to override and maintain predictably",
                "Animations run faster",
                "HTML validation is skipped",
                "Images auto-compress more aggressively",
            ],
            "correct_option": 0,
        },
        {
            "question_type": "practical",
            "difficulty": "medium",
            "question_text": "Scenario: Vertical centering is inconsistent across dynamic content heights. Which solution is best?",
            "options": [
                "Use flex/grid alignment instead of fragile positional hacks",
                "Use absolute positioning with magic numbers",
                "Force fixed heights for all content blocks",
                "Disable responsive behavior",
            ],
            "correct_option": 0,
        },
    ],
    "git": [
        {
            "question_type": "practical",
            "difficulty": "easy",
            "question_text": "Scenario: You are preparing a fix for review. What commit strategy best supports reliable code review?",
            "options": [
                "Create focused, logically grouped commits with clear messages",
                "Commit unrelated changes together for speed",
                "Force-push directly to main with no review",
                "Skip commit messages and rely on PR title only",
            ],
            "correct_option": 0,
        },
        {
            "question_type": "conceptual",
            "difficulty": "medium",
            "question_text": "When integrating updates from main into a feature branch, what is the key difference between rebase and merge?",
            "options": [
                "Rebase rewrites branch history; merge preserves branch topology",
                "Merge rewrites remote history by default",
                "Rebase removes all conflicts automatically",
                "There is no practical difference",
            ],
            "correct_option": 0,
        },
        {
            "question_type": "practical",
            "difficulty": "hard",
            "question_text": "Scenario: A conflict appears in a critical config file. What is the best resolution workflow?",
            "options": [
                "Inspect both intents, resolve explicitly, then run verification before commit",
                "Accept both sections and skip tests",
                "Delete the conflicted file and regenerate later",
                "Abort and push conflict markers for team review",
            ],
            "correct_option": 0,
        },
    ],
}

SKILL_ALIAS_MAP = {
    "node": "javascript",
    "node.js": "javascript",
    "typescript": "javascript",
    "ts": "javascript",
    "postgres": "sql",
    "postgresql": "sql",
    "mysql": "sql",
    "database": "sql",
    "databases": "sql",
    "network": "networking",
    "tcp/ip": "networking",
    "amazon web services": "aws",
    "cloud": "aws",
    "html5": "html",
    "css3": "css",
    "version control": "git",
}


router = APIRouter(
    prefix="/applications",
    tags=["Applications"],
    responses={401: {"description": "Not authenticated"}},
)


def _slug(text: str) -> str:
    normalized = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return normalized or "skill"


def _normalize_skill(skill_name: str) -> str:
    clean = re.sub(r"[^a-z0-9+# ]+", " ", (skill_name or "").lower())
    clean = re.sub(r"\s+", " ", clean).strip()
    if clean in SKILL_ALIAS_MAP:
        return SKILL_ALIAS_MAP[clean]
    if clean in SKILL_QUIZ_TEMPLATES:
        return clean
    for token in clean.split(" "):
        if token in SKILL_ALIAS_MAP:
            return SKILL_ALIAS_MAP[token]
        if token in SKILL_QUIZ_TEMPLATES:
            return token
    return clean


def _safe_format(template: str, context: dict[str, str]) -> str:
    try:
        return template.format(**context)
    except (KeyError, ValueError):
        return template


def _extract_job_responsibilities(job: JobRequisition) -> list[str]:
    text = (job.description or "").replace("\r", "\n")
    raw_lines = re.split(r"\n+|[\u2022*]", text)
    responsibilities: list[str] = []
    skip_prefixes = (
        "requirements",
        "qualifications",
        "preferred",
        "must have",
        "nice to have",
    )

    for line in raw_lines:
        clean_line = re.sub(r"\s+", " ", line).strip(" -:;.")
        if len(clean_line) < 25:
            continue
        if clean_line.lower().startswith(skip_prefixes):
            continue
        responsibilities.append(clean_line)
        if len(responsibilities) >= 6:
            break

    if responsibilities:
        return responsibilities

    return [f"deliver the core responsibilities of a {job.title or 'team role'}"]


def _difficulty_profile(experience_years: int | None) -> tuple[list[str], list[str]]:
    if experience_years is None:
        return (["medium", "easy"], ["hard"])
    if experience_years <= 1:
        return (["easy", "medium"], ["hard"])
    if experience_years <= 3:
        return (["medium", "easy"], ["hard"])
    if experience_years <= 6:
        return (["medium", "hard"], ["easy"])
    return (["hard", "medium"], ["easy"])


def _build_fallback_skill_pool(
    skill_name: str, role_title: str, responsibilities: list[str]
) -> list[dict]:
    primary = responsibilities[0]
    secondary = responsibilities[1] if len(responsibilities) > 1 else primary
    return [
        {
            "question_type": "practical",
            "difficulty": "medium",
            "question_text": "Scenario: You are assigned to `{responsibility}`. Which action best demonstrates real `{skill}` competence?",
            "options": [
                "Apply the skill to deliver a reliable, testable outcome aligned to requirements",
                "Wait for someone else to implement the critical part",
                "Use trial-and-error in production without verification",
                "Focus only on terminology without implementation",
            ],
            "correct_option": 0,
            "responsibility": primary,
        },
        {
            "question_type": "conceptual",
            "difficulty": "medium",
            "question_text": "For a `{role}` role, what indicates solid conceptual understanding of `{skill}`?",
            "options": [
                "Ability to explain trade-offs and choose suitable approaches",
                "Ability to memorize definitions only",
                "Relying on defaults without understanding impact",
                "Avoiding documentation and standards",
            ],
            "correct_option": 0,
            "responsibility": primary,
        },
        {
            "question_type": "practical",
            "difficulty": "hard",
            "question_text": "Scenario: During `{responsibility}`, the first implementation fails quality checks. What is the strongest next step?",
            "options": [
                "Diagnose root cause, adjust solution, and re-validate against acceptance criteria",
                "Ship anyway because timeline is tight",
                "Blame dependencies and stop investigation",
                "Skip testing to save time",
            ],
            "correct_option": 0,
            "responsibility": secondary,
        },
        {
            "question_type": "conceptual",
            "difficulty": "easy",
            "question_text": "For `{skill}` in a `{role}` role, what is the clearest sign of competence growth?",
            "options": [
                "Improving solution quality through feedback and measurable outcomes",
                "Memorizing terms without implementing them",
                "Avoiding peer review to move faster",
                "Skipping post-task reflection",
            ],
            "correct_option": 0,
            "responsibility": primary,
        },
        {
            "question_type": "practical",
            "difficulty": "medium",
            "question_text": "Scenario: While handling `{responsibility}`, requirements change late. What response best shows competent `{skill}` practice?",
            "options": [
                "Reassess impact, adjust implementation, and confirm acceptance criteria",
                "Ignore the change and keep old assumptions",
                "Delay all work until requirements are perfect",
                "Push unreviewed changes directly to production",
            ],
            "correct_option": 0,
            "responsibility": secondary,
        },
    ]


def _materialize_skill_templates(
    job: JobRequisition,
    skill_name: str,
    is_must_have: bool,
    responsibilities: list[str],
) -> list[dict]:
    skill_key = _normalize_skill(skill_name)
    base_templates = SKILL_QUIZ_TEMPLATES.get(skill_key, [])
    fallback_templates = _build_fallback_skill_pool(
        skill_name, job.title or "this role", responsibilities
    )
    raw_templates = base_templates + fallback_templates if base_templates else fallback_templates

    role_title = job.title or "this role"
    materialized: list[dict] = []
    for idx, template in enumerate(raw_templates):
        uses_responsibility = "{responsibility}" in template["question_text"] or any(
            "{responsibility}" in option for option in template["options"]
        )
        responsibility_variants = (
            responsibilities[: min(3, len(responsibilities))]
            if uses_responsibility
            else [template.get("responsibility", responsibilities[0])]
        )

        for variant_idx, responsibility in enumerate(responsibility_variants):
            context = {
                "skill": skill_name,
                "role": role_title,
                "responsibility": responsibility,
            }
            materialized.append(
                {
                    "template_id": f"{skill_key or _slug(skill_name)}:{idx}:{variant_idx}",
                    "skill_name": skill_name,
                    "is_must_have": is_must_have,
                    "question_type": template.get("question_type", "conceptual"),
                    "difficulty": template.get("difficulty", "medium"),
                    "question_text": _safe_format(template["question_text"], context),
                    "options": [
                        _safe_format(option, context) for option in template["options"]
                    ],
                    "correct_option": template["correct_option"],
                }
            )
    return materialized


def _template_rank(
    template: dict, preferred_difficulties: list[str], preferred_type: str
) -> tuple[int, int, int]:
    difficulty_order = {"easy": 0, "medium": 1, "hard": 2}
    score = 0
    if template["difficulty"] in preferred_difficulties:
        score += 4
    if template["question_type"] == preferred_type:
        score += 3
    if template["question_type"] == "practical":
        score += 1
    return (
        score,
        int(template.get("is_must_have", False)),
        difficulty_order.get(template["difficulty"], 1),
    )


def _select_from_pool(
    pool: list[dict],
    used_template_ids: set[str],
    preferred_difficulties: list[str],
    preferred_type: str,
) -> dict | None:
    available = [template for template in pool if template["template_id"] not in used_template_ids]
    if not available:
        return None
    ranked = sorted(
        available,
        key=lambda template: _template_rank(
            template, preferred_difficulties, preferred_type
        ),
        reverse=True,
    )
    return ranked[0]


def _build_job_quiz_questions(job: JobRequisition) -> list[dict]:
    criteria_payload = [
        {
            "skill_name": (criterion.skill_name or "").strip(),
            "is_must_have": bool(criterion.is_must_have),
            "weight": criterion.weight or 0,
        }
        for criterion in (job.criteria or [])
        if (criterion.skill_name or "").strip()
    ]

    if not criteria_payload:
        criteria_payload = [
            {
                "skill_name": job.title or "Role Competency",
                "is_must_have": True,
                "weight": 10,
            }
        ]

    criteria = sorted(
        criteria_payload,
        key=lambda c: (not c["is_must_have"], -c["weight"], c["skill_name"].lower()),
    )
    responsibilities = _extract_job_responsibilities(job)
    preferred_difficulties, fallback_difficulties = _difficulty_profile(
        job.experience_years
    )

    questions: list[dict] = []
    question_index = 1
    used_template_ids: set[str] = set()
    skill_pools: list[list[dict]] = []
    next_type_for_nice_to_have = "practical"

    for criterion in criteria:
        if len(questions) >= MAX_QUIZ_QUESTIONS:
            break

        skill_name = criterion["skill_name"]
        is_must_have = criterion["is_must_have"]
        pool = _materialize_skill_templates(
            job, skill_name, is_must_have, responsibilities
        )
        if not pool:
            continue

        skill_pools.append(pool)
        target_questions = 2 if is_must_have else 1
        preferred_type_order = (
            ["practical", "conceptual"] if is_must_have else [next_type_for_nice_to_have]
        )
        if not is_must_have:
            next_type_for_nice_to_have = (
                "conceptual" if next_type_for_nice_to_have == "practical" else "practical"
            )

        for preferred_type in preferred_type_order:
            if len(questions) >= MAX_QUIZ_QUESTIONS or target_questions <= 0:
                break
            selected_template = _select_from_pool(
                pool, used_template_ids, preferred_difficulties, preferred_type
            )
            if not selected_template:
                selected_template = _select_from_pool(
                    pool, used_template_ids, fallback_difficulties, preferred_type
                )
            if not selected_template:
                continue
            used_template_ids.add(selected_template["template_id"])
            questions.append(
                {
                    "question_id": f"q{question_index}-{_slug(skill_name)}",
                    "skill_name": skill_name,
                    "question_text": selected_template["question_text"],
                    "options": selected_template["options"],
                    "correct_option": selected_template["correct_option"],
                    "difficulty": selected_template["difficulty"],
                    "is_must_have": is_must_have,
                    "question_type": selected_template["question_type"],
                }
            )
            question_index += 1
            target_questions -= 1

    while len(questions) < MIN_QUIZ_QUESTIONS and len(questions) < MAX_QUIZ_QUESTIONS:
        practical_count = sum(1 for question in questions if question["question_type"] == "practical")
        conceptual_count = len(questions) - practical_count
        preferred_type = "practical" if practical_count <= conceptual_count else "conceptual"

        best_template = None
        for pool in skill_pools:
            candidate = _select_from_pool(
                pool, used_template_ids, preferred_difficulties, preferred_type
            )
            if not candidate:
                candidate = _select_from_pool(
                    pool, used_template_ids, fallback_difficulties, preferred_type
                )
            if not candidate:
                continue
            if best_template is None or _template_rank(
                candidate, preferred_difficulties, preferred_type
            ) > _template_rank(best_template, preferred_difficulties, preferred_type):
                best_template = candidate

        if not best_template:
            break

        used_template_ids.add(best_template["template_id"])
        questions.append(
            {
                "question_id": f"q{question_index}-{_slug(best_template['skill_name'])}",
                "skill_name": best_template["skill_name"],
                "question_text": best_template["question_text"],
                "options": best_template["options"],
                "correct_option": best_template["correct_option"],
                "difficulty": best_template["difficulty"],
                "is_must_have": best_template["is_must_have"],
                "question_type": best_template["question_type"],
            }
        )
        question_index += 1

    if questions:
        practical_count = sum(1 for question in questions if question["question_type"] == "practical")
        if practical_count == 0:
            for pool in skill_pools:
                practical_template = _select_from_pool(
                    pool, used_template_ids, preferred_difficulties, "practical"
                )
                if not practical_template:
                    continue
                used_template_ids.add(practical_template["template_id"])
                questions[-1] = {
                    "question_id": questions[-1]["question_id"],
                    "skill_name": practical_template["skill_name"],
                    "question_text": practical_template["question_text"],
                    "options": practical_template["options"],
                    "correct_option": practical_template["correct_option"],
                    "difficulty": practical_template["difficulty"],
                    "is_must_have": practical_template["is_must_have"],
                    "question_type": practical_template["question_type"],
                }
                break

    # `question_type` is internal metadata for balancing and is not exposed to clients.
    for question in questions:
        question.pop("question_type", None)

    if len(questions) < MIN_QUIZ_QUESTIONS:
        emergency_pool = _materialize_skill_templates(
            job,
            job.title or "Role Competency",
            True,
            responsibilities,
        )
        emergency_idx = 0
        while (
            emergency_pool
            and len(questions) < MIN_QUIZ_QUESTIONS
            and len(questions) < MAX_QUIZ_QUESTIONS
        ):
            template = emergency_pool[emergency_idx % len(emergency_pool)]
            questions.append(
                {
                    "question_id": f"q{question_index}-{_slug(template['skill_name'])}",
                    "skill_name": template["skill_name"],
                    "question_text": template["question_text"],
                    "options": template["options"],
                    "correct_option": template["correct_option"],
                    "difficulty": template.get("difficulty", "medium"),
                    "is_must_have": True,
                }
            )
            question_index += 1
            emergency_idx += 1

    return questions[:MAX_QUIZ_QUESTIONS]


def _evaluate_quiz(questions: list[dict], request_answers: list) -> dict:
    if not request_answers:
        raise ValueError("Quiz answers are required to submit an application")

    answers_by_id = {answer.question_id: answer.selected_option for answer in request_answers}
    expected_question_ids = {question["question_id"] for question in questions}
    provided_question_ids = set(answers_by_id.keys())

    missing = expected_question_ids - provided_question_ids
    unexpected = provided_question_ids - expected_question_ids
    if missing:
        raise ValueError(
            f"Missing answers for question(s): {', '.join(sorted(missing))}"
        )
    if unexpected:
        raise ValueError(
            f"Invalid question id(s): {', '.join(sorted(unexpected))}"
        )

    total_questions = len(questions)
    correct_answers = 0
    must_total = 0
    must_correct = 0

    score_breakdown: dict[str, dict] = defaultdict(
        lambda: {"total": 0, "correct": 0, "is_must_have": False}
    )
    answers_payload = []

    for question in questions:
        question_id = question["question_id"]
        selected_option = answers_by_id[question_id]
        if selected_option < 0 or selected_option >= len(question["options"]):
            raise ValueError(
                f"Selected option is out of range for question {question_id}"
            )

        is_correct = selected_option == question["correct_option"]
        if is_correct:
            correct_answers += 1

        if question["is_must_have"]:
            must_total += 1
            if is_correct:
                must_correct += 1

        skill_bucket = score_breakdown[question["skill_name"]]
        skill_bucket["total"] += 1
        skill_bucket["correct"] += 1 if is_correct else 0
        skill_bucket["is_must_have"] = (
            skill_bucket["is_must_have"] or question["is_must_have"]
        )

        answers_payload.append(
            {
                "question_id": question_id,
                "skill_name": question["skill_name"],
                "selected_option": selected_option,
                "correct_option": question["correct_option"],
                "is_correct": is_correct,
            }
        )

    score_percent = round((correct_answers / total_questions) * 100)
    must_have_score_percent = (
        round((must_correct / must_total) * 100) if must_total > 0 else 100
    )
    passed = (
        score_percent >= PASS_SCORE_PERCENT
        and must_have_score_percent >= MUST_HAVE_PASS_PERCENT
    )

    if passed:
        outcome = QuizOutcome.QUALIFIED
    elif score_percent >= 50:
        outcome = QuizOutcome.REVIEW_NEEDED
    else:
        outcome = QuizOutcome.NOT_QUALIFIED

    breakdown = []
    for skill_name, item in sorted(
        score_breakdown.items(),
        key=lambda pair: (not pair[1]["is_must_have"], pair[0].lower()),
    ):
        skill_percent = round((item["correct"] / item["total"]) * 100)
        breakdown.append(
            {
                "skill_name": skill_name,
                "total": item["total"],
                "correct": item["correct"],
                "percent": skill_percent,
                "is_must_have": item["is_must_have"],
            }
        )

    return {
        "total_questions": total_questions,
        "correct_answers": correct_answers,
        "score_percent": score_percent,
        "must_have_score_percent": must_have_score_percent,
        "passed": passed,
        "outcome": outcome,
        "breakdown": breakdown,
        "answers_payload": answers_payload,
    }


def _to_quiz_result_response(
    quiz_result: ApplicationQuizResult | None,
) -> ApplicationQuizResultResponse | None:
    if not quiz_result:
        return None

    breakdown = []
    if quiz_result.breakdown_payload:
        try:
            breakdown_data = json.loads(quiz_result.breakdown_payload)
            breakdown = [QuizSkillBreakdownItem(**item) for item in breakdown_data]
        except (json.JSONDecodeError, TypeError, ValueError):
            breakdown = []

    return ApplicationQuizResultResponse(
        total_questions=quiz_result.total_questions,
        correct_answers=quiz_result.correct_answers,
        score_percent=quiz_result.score_percent,
        must_have_score_percent=quiz_result.must_have_score_percent,
        passed=quiz_result.passed,
        outcome=quiz_result.outcome,
        breakdown=breakdown,
        submitted_at=quiz_result.submitted_at,
    )


def _get_quiz_results_map(
    session: Session, application_ids: list[int]
) -> dict[int, ApplicationQuizResult]:
    if not application_ids:
        return {}

    quiz_results = session.exec(
        select(ApplicationQuizResult).where(
            ApplicationQuizResult.application_id.in_(application_ids)
        )
    ).all()
    return {result.application_id: result for result in quiz_results}


def _get_talent_pool_application_ids(
    session: Session, application_ids: list[int]
) -> set[int]:
    if not application_ids:
        return set()

    pooled_ids = session.exec(
        select(TalentPoolEntry.source_application_id).where(
            TalentPoolEntry.source_application_id.in_(application_ids)
        )
    ).all()
    return {application_id for application_id in pooled_ids if application_id is not None}


def _build_application_response(
    application: Application,
    job: JobRequisition | None,
    candidate: User | None,
    in_talent_pool: bool = False,
    quiz_result: ApplicationQuizResult | None = None,
) -> ApplicationResponse:
    return ApplicationResponse(
        id=application.id,
        job_id=application.job_id,
        job_title=job.title if job else None,
        candidate_id=application.candidate_id,
        candidate_name=candidate.username if candidate else None,
        resume_id=application.resume_id,
        status=application.status,
        match_score=application.match_score,
        is_shortlisted=application.is_shortlisted,
        in_talent_pool=in_talent_pool,
        quiz_result=_to_quiz_result_response(quiz_result),
        applied_at=application.applied_at,
        updated_at=application.updated_at,
    )


def _validate_apply_preconditions(
    session: Session,
    job_id: int,
    candidate_id: int,
    resume_id: int | None,
) -> JobRequisition:
    job = session.get(JobRequisition, job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found",
        )
    if job.status != JobStatus.OPEN:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Job is not accepting applications",
        )

    existing = session.exec(
        select(Application).where(
            Application.job_id == job_id,
            Application.candidate_id == candidate_id,
        )
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You have already applied to this job",
        )

    if resume_id:
        resume = session.get(Resume, resume_id)
        if not resume or resume.user_id != candidate_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid resume",
            )
    return job


@router.get(
    "/quiz/{job_id}",
    response_model=JobQuizResponse,
    summary="Get role quiz",
    description="Get a job-specific quiz that must be completed before applying.",
)
def get_job_quiz(
    job_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(check_permissions("apply_to_job")),
):
    """Return role-specific quiz questions for a job application."""
    job = _validate_apply_preconditions(session, job_id, current_user.id, None)
    questions = _build_job_quiz_questions(job)

    return JobQuizResponse(
        job_id=job.id,
        job_title=job.title,
        total_questions=len(questions),
        pass_score_percent=PASS_SCORE_PERCENT,
        must_have_pass_percent=MUST_HAVE_PASS_PERCENT,
        questions=[
            JobQuizQuestionResponse(
                question_id=question["question_id"],
                skill_name=question["skill_name"],
                question_text=question["question_text"],
                options=question["options"],
                difficulty=question["difficulty"],
                is_must_have=question["is_must_have"],
            )
            for question in questions
        ],
    )


@router.post(
    "/",
    response_model=ApplicationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Apply to a job",
    description=(
        "Submit an application to a job with completed quiz answers. "
        "**Requires 'apply_to_job' permission (Candidate).**"
    ),
)
def apply_to_job(
    request: ApplicationCreateRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(check_permissions("apply_to_job")),
):
    """Apply to a job posting with quiz assessment."""
    job = _validate_apply_preconditions(
        session, request.job_id, current_user.id, request.resume_id
    )
    quiz_questions = _build_job_quiz_questions(job)

    try:
        score = _evaluate_quiz(quiz_questions, request.quiz_answers)
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(err),
        ) from err

    application = Application(
        job_id=request.job_id,
        candidate_id=current_user.id,
        resume_id=request.resume_id,
        status=ApplicationStatus.RECEIVED,
    )
    session.add(application)
    session.flush()

    quiz_result = ApplicationQuizResult(
        application_id=application.id,
        total_questions=score["total_questions"],
        correct_answers=score["correct_answers"],
        score_percent=score["score_percent"],
        must_have_score_percent=score["must_have_score_percent"],
        passed=score["passed"],
        outcome=score["outcome"],
        answers_payload=json.dumps(score["answers_payload"]),
        breakdown_payload=json.dumps(score["breakdown"]),
    )
    session.add(quiz_result)
    session.commit()
    session.refresh(application)
    session.refresh(quiz_result)

    return _build_application_response(
        application,
        job,
        current_user,
        quiz_result=quiz_result,
    )


@router.get(
    "/",
    response_model=ApplicationListResponse,
    summary="List applications",
    description="""
    List job applications.

    **Candidates:** See only their own applications
    **Recruiters/Admins:** See all applications
    """,
)
def list_applications(
    job_id: int = None,
    page: int = 1,
    limit: int = 50,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """List applications based on user role."""
    query = select(Application)

    if not current_user.has_permission("view_all_applications"):
        query = query.where(Application.candidate_id == current_user.id)

    if job_id:
        query = query.where(Application.job_id == job_id)

    query = query.order_by(Application.applied_at.desc())

    total = len(session.exec(query).all())
    total_pages = (total + limit - 1) // limit if limit > 0 else 1
    skip = (page - 1) * limit

    applications = session.exec(query.offset(skip).limit(limit)).all()
    application_ids = [app.id for app in applications if app.id is not None]
    pooled_application_ids = _get_talent_pool_application_ids(session, application_ids)
    quiz_results_map = _get_quiz_results_map(session, application_ids)

    result = []
    for app in applications:
        job = session.get(JobRequisition, app.job_id)
        candidate = session.get(User, app.candidate_id)
        result.append(
            _build_application_response(
                app,
                job,
                candidate,
                in_talent_pool=app.id in pooled_application_ids,
                quiz_result=quiz_results_map.get(app.id),
            )
        )

    return ApplicationListResponse(
        applications=result,
        total=total,
        page=page,
        limit=limit,
        total_pages=total_pages,
    )


@router.get(
    "/my-applications",
    response_model=CandidateApplicationList,
    summary="My applications",
    description="Get your application timeline (Candidate view).",
)
def get_my_applications(
    page: int = 1,
    limit: int = 50,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Get candidate's applications with status timeline."""
    query = (
        select(Application)
        .where(Application.candidate_id == current_user.id)
        .order_by(Application.applied_at.desc())
    )

    total = len(session.exec(query).all())
    total_pages = (total + limit - 1) // limit if limit > 0 else 1
    skip = (page - 1) * limit

    applications = session.exec(query.offset(skip).limit(limit)).all()
    quiz_results_map = _get_quiz_results_map(
        session,
        [app.id for app in applications if app.id is not None],
    )

    result = []
    for app in applications:
        job = session.get(JobRequisition, app.job_id)
        if job:
            quiz_result = quiz_results_map.get(app.id)
            result.append(
                CandidateApplicationResponse(
                    id=app.id,
                    job_id=app.job_id,
                    job_title=job.title,
                    company_department=job.department,
                    location=job.location,
                    status=app.status,
                    quiz_outcome=quiz_result.outcome if quiz_result else None,
                    quiz_score_percent=quiz_result.score_percent if quiz_result else None,
                    applied_at=app.applied_at,
                    updated_at=app.updated_at,
                )
            )

    return CandidateApplicationList(
        applications=result,
        total=total,
        page=page,
        limit=limit,
        total_pages=total_pages,
    )


@router.get(
    "/{application_id}",
    response_model=ApplicationResponse,
    summary="Get application details",
)
def get_application(
    application_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Get application details."""
    application = session.get(Application, application_id)

    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found",
        )

    if not current_user.has_permission("view_all_applications"):
        if application.candidate_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied",
            )

    job = session.get(JobRequisition, application.job_id)
    candidate = session.get(User, application.candidate_id)
    quiz_result = session.exec(
        select(ApplicationQuizResult).where(
            ApplicationQuizResult.application_id == application.id
        )
    ).first()

    return _build_application_response(
        application,
        job,
        candidate,
        in_talent_pool=bool(
            session.exec(
                select(TalentPoolEntry).where(
                    TalentPoolEntry.source_application_id == application.id
                )
            ).first()
        ),
        quiz_result=quiz_result,
    )


@router.patch(
    "/{application_id}/status",
    response_model=ApplicationResponse,
    summary="Update application status",
    description="Update the status of an application. **Requires 'manage_applications' permission.**",
)
def update_application_status(
    application_id: int,
    request: ApplicationStatusUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(check_permissions("manage_applications")),
):
    """Update application status (recruiter action)."""
    application = session.get(Application, application_id)

    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found",
        )

    application.status = request.status
    application.updated_at = datetime.utcnow()

    if request.notes:
        application.notes = request.notes

    linked_pool_entries = session.exec(
        select(TalentPoolEntry).where(
            TalentPoolEntry.source_application_id == application.id
        )
    ).all()
    for entry in linked_pool_entries:
        entry.source_status = request.status
        entry.updated_at = datetime.utcnow()
        session.add(entry)

    session.commit()
    session.refresh(application)

    if request.status == ApplicationStatus.REJECTED and not linked_pool_entries:
        try:
            _, created = save_application_to_talent_pool(
                session,
                application,
                recruiter_id=current_user.id,
                auto_rescan=False,
            )
            if created:
                linked_pool_entries = session.exec(
                    select(TalentPoolEntry).where(
                        TalentPoolEntry.source_application_id == application.id
                    )
                ).all()
        except ValueError:
            pass

    job = session.get(JobRequisition, application.job_id)
    candidate = session.get(User, application.candidate_id)
    quiz_result = session.exec(
        select(ApplicationQuizResult).where(
            ApplicationQuizResult.application_id == application.id
        )
    ).first()

    return _build_application_response(
        application,
        job,
        candidate,
        in_talent_pool=bool(linked_pool_entries),
        quiz_result=quiz_result,
    )


@router.patch(
    "/{application_id}/shortlist",
    response_model=ApplicationResponse,
    summary="Toggle shortlist status",
    description="Toggle shortlist on/off for an application. **Requires 'manage_applications' permission.**",
)
def toggle_shortlist(
    application_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(check_permissions("manage_applications")),
):
    """Toggle shortlist status for a candidate application."""
    application = session.get(Application, application_id)

    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found",
        )

    application.is_shortlisted = not application.is_shortlisted
    application.updated_at = datetime.utcnow()

    session.commit()
    session.refresh(application)

    job = session.get(JobRequisition, application.job_id)
    candidate = session.get(User, application.candidate_id)
    quiz_result = session.exec(
        select(ApplicationQuizResult).where(
            ApplicationQuizResult.application_id == application.id
        )
    ).first()

    return _build_application_response(
        application,
        job,
        candidate,
        in_talent_pool=bool(
            session.exec(
                select(TalentPoolEntry).where(
                    TalentPoolEntry.source_application_id == application.id
                )
            ).first()
        ),
        quiz_result=quiz_result,
    )


def _can_access_application(current_user: User, application: Application) -> bool:
    if current_user.has_permission("view_all_applications"):
        return True
    return application.candidate_id == current_user.id


def _get_or_create_thread(
    session: Session, application_id: int
) -> ApplicationMessageThread:
    thread = session.exec(
        select(ApplicationMessageThread).where(
            ApplicationMessageThread.application_id == application_id
        )
    ).first()
    if thread:
        return thread

    thread = ApplicationMessageThread(application_id=application_id)
    session.add(thread)
    session.flush()
    return thread


def _first_internal_recruiter_id(session: Session) -> int | None:
    query = (
        select(User.id)
        .join(RolePermissionLink, RolePermissionLink.role_id == User.role_id)
        .join(Permission, Permission.id == RolePermissionLink.permission_id)
        .where(Permission.name == "manage_applications")
    )
    return session.exec(query).first()


@router.get(
    "/{application_id}/messages",
    response_model=MessageThreadResponse,
    summary="Get application message thread",
)
def get_application_messages(
    application_id: int,
    page: int = 1,
    limit: int = 50,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    application = session.get(Application, application_id)
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    if not _can_access_application(current_user, application):
        raise HTTPException(status_code=403, detail="Access denied")

    thread = _get_or_create_thread(session, application_id)
    session.commit()
    session.refresh(thread)

    query = select(ApplicationMessage).where(ApplicationMessage.thread_id == thread.id)
    total = len(session.exec(query).all())
    skip = max(page - 1, 0) * limit
    messages = session.exec(
        query.order_by(ApplicationMessage.created_at.asc()).offset(skip).limit(limit)
    ).all()

    usernames = {}
    for message in messages:
        sender = session.get(User, message.sender_user_id)
        usernames[message.sender_user_id] = sender.username if sender else "Unknown"

    return {
        "thread_id": thread.id,
        "application_id": application_id,
        "messages": [
            {
                "id": msg.id,
                "thread_id": msg.thread_id,
                "sender_user_id": msg.sender_user_id,
                "sender_username": usernames.get(msg.sender_user_id, "Unknown"),
                "recipient_user_id": msg.recipient_user_id,
                "body": msg.body,
                "is_read": msg.is_read,
                "created_at": msg.created_at,
            }
            for msg in messages
        ],
        "total": total,
        "page": page,
        "limit": limit,
    }


@router.post(
    "/{application_id}/messages",
    response_model=MessageThreadResponse,
    summary="Send message on application thread",
)
def send_application_message(
    application_id: int,
    request: MessageSendRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    application = session.get(Application, application_id)
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    if not _can_access_application(current_user, application):
        raise HTTPException(status_code=403, detail="Access denied")

    thread = _get_or_create_thread(session, application_id)

    if current_user.id == application.candidate_id:
        recipient_user_id = _first_internal_recruiter_id(session) or current_user.id
    else:
        recipient_user_id = application.candidate_id

    message = ApplicationMessage(
        thread_id=thread.id,
        sender_user_id=current_user.id,
        recipient_user_id=recipient_user_id,
        body=request.body.strip(),
        is_read=False,
    )
    session.add(message)
    thread.updated_at = datetime.utcnow()
    session.add(thread)

    log_audit(
        session=session,
        user_id=current_user.id,
        action="SEND_MESSAGE",
        entity_type="ApplicationMessage",
        entity_id=None,
        details=f"application_id={application_id}",
    )
    if recipient_user_id != current_user.id:
        create_notification(
            session=session,
            user_id=recipient_user_id,
            type=NotificationType.INFO,
            message=f"New message on application #{application_id}.",
            link="/applicants",
        )

    session.commit()
    return get_application_messages(
        application_id=application_id,
        page=1,
        limit=50,
        session=session,
        current_user=current_user,
    )


@router.patch(
    "/{application_id}/messages/read",
    response_model=MessageThreadResponse,
    summary="Mark application messages as read",
)
def mark_application_messages_read(
    application_id: int,
    request: MarkMessagesReadRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    application = session.get(Application, application_id)
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    if not _can_access_application(current_user, application):
        raise HTTPException(status_code=403, detail="Access denied")

    thread = session.exec(
        select(ApplicationMessageThread).where(
            ApplicationMessageThread.application_id == application_id
        )
    ).first()
    if not thread:
        return get_application_messages(
            application_id=application_id,
            page=1,
            limit=50,
            session=session,
            current_user=current_user,
        )

    query = select(ApplicationMessage).where(
        ApplicationMessage.thread_id == thread.id,
        ApplicationMessage.recipient_user_id == current_user.id,
        ApplicationMessage.is_read == False,
    )
    if request.message_ids:
        query = query.where(ApplicationMessage.id.in_(request.message_ids))

    rows = session.exec(query).all()
    for row in rows:
        row.is_read = True
        session.add(row)
    session.commit()

    return get_application_messages(
        application_id=application_id,
        page=1,
        limit=50,
        session=session,
        current_user=current_user,
    )


@router.post(
    "/{application_id}/interviews",
    response_model=InterviewResponse,
    summary="Schedule interview for application",
)
def schedule_interview(
    application_id: int,
    request: InterviewCreateRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(check_permissions("manage_applications")),
):
    application = session.get(Application, application_id)
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    if request.scheduled_end_at <= request.scheduled_start_at:
        raise HTTPException(status_code=400, detail="End time must be after start time.")

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    active = session.exec(
        select(ApplicationInterview).where(
            ApplicationInterview.application_id == application_id,
            ApplicationInterview.status.in_(
                [InterviewStatus.SCHEDULED, InterviewStatus.RESCHEDULED]
            ),
            ApplicationInterview.scheduled_end_at >= now,
        )
    ).all()
    for interview in active:
        interview.status = InterviewStatus.RESCHEDULED
        interview.updated_at = datetime.utcnow()
        session.add(interview)

    interview = ApplicationInterview(
        application_id=application_id,
        scheduled_by_user_id=current_user.id,
        interviewer_user_id=request.interviewer_user_id,
        scheduled_start_at=request.scheduled_start_at,
        scheduled_end_at=request.scheduled_end_at,
        timezone=request.timezone or "UTC",
        mode=request.mode,
        location_or_link=request.location_or_link,
        notes=request.notes,
        status=InterviewStatus.SCHEDULED,
    )
    session.add(interview)

    log_audit(
        session=session,
        user_id=current_user.id,
        action="SCHEDULE_INTERVIEW",
        entity_type="ApplicationInterview",
        entity_id=None,
        details=f"application_id={application_id}",
    )
    create_notification(
        session=session,
        user_id=application.candidate_id,
        type=NotificationType.INFO,
        message=f"Interview scheduled for application #{application_id}.",
        link="/my-applications",
    )
    if request.interviewer_user_id:
        create_notification(
            session=session,
            user_id=request.interviewer_user_id,
            type=NotificationType.INFO,
            message=f"You were assigned an interview for application #{application_id}.",
            link="/applicants",
        )

    session.commit()
    session.refresh(interview)
    return interview


@router.get(
    "/{application_id}/interviews",
    response_model=InterviewListResponse,
    summary="List interview history for application",
)
def list_application_interviews(
    application_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    application = session.get(Application, application_id)
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    if not _can_access_application(current_user, application):
        raise HTTPException(status_code=403, detail="Access denied")

    interviews = session.exec(
        select(ApplicationInterview)
        .where(ApplicationInterview.application_id == application_id)
        .order_by(ApplicationInterview.created_at.desc())
    ).all()
    return {"interviews": interviews, "total": len(interviews)}


@router.delete(
    "/{application_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove candidate record",
    description="Delete an application/candidate record. **Requires 'manage_users' permission.**",
)
def remove_application(
    application_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(check_permissions("manage_users")),
):
    """Remove an application record from the system."""
    application = session.get(Application, application_id)

    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found",
        )

    quiz_result = session.exec(
        select(ApplicationQuizResult).where(
            ApplicationQuizResult.application_id == application_id
        )
    ).first()
    if quiz_result:
        session.delete(quiz_result)

    session.delete(application)
    session.commit()
