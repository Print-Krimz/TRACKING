"""
Quiz Models

Stores quiz outcomes tied to candidate job applications.
"""

from datetime import datetime
from enum import Enum
from typing import Optional

from sqlmodel import Field, SQLModel


class QuizOutcome(str, Enum):
    """Outcome tags used after quiz evaluation."""

    QUALIFIED = "qualified"
    REVIEW_NEEDED = "review_needed"
    NOT_QUALIFIED = "not_qualified"


class ApplicationQuizResult(SQLModel, table=True):
    """
    Stores one quiz result per application.

    The payload fields are JSON strings to keep the schema lightweight:
    - `answers_payload`: submitted answers and correctness
    - `breakdown_payload`: per-skill score breakdown
    """

    __tablename__ = "application_quiz_result"

    id: Optional[int] = Field(default=None, primary_key=True)
    application_id: int = Field(
        foreign_key="application.id",
        unique=True,
        index=True,
    )
    total_questions: int = Field(ge=1)
    correct_answers: int = Field(ge=0)
    score_percent: int = Field(ge=0, le=100)
    must_have_score_percent: int = Field(default=0, ge=0, le=100)
    passed: bool = Field(default=False)
    outcome: QuizOutcome = Field(default=QuizOutcome.REVIEW_NEEDED)
    answers_payload: Optional[str] = Field(
        default=None,
        description="JSON payload of answered questions and correctness",
    )
    breakdown_payload: Optional[str] = Field(
        default=None,
        description="JSON payload of score breakdown by skill",
    )
    submitted_at: datetime = Field(default_factory=datetime.utcnow)
