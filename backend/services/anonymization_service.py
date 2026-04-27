"""
Anonymization Service

Pre-processing service that strips Personally Identifiable Information (PII)
from resume text before it is sent to the Gemini AI for analysis.

This reduces unconscious bias and protects candidate privacy by removing:
- Full names (heuristic: first lines of a resume)
- Email addresses
- Phone numbers (international and local formats)
- URLs and social media profiles
- Home/mailing addresses
- Dates of birth
- Social Security Numbers / National IDs

The original resume content stored in the database is NEVER modified.
Only the text sent to the AI is anonymized.
"""

import re
from typing import List, Tuple


def _build_patterns() -> List[Tuple[re.Pattern, str]]:
    """
    Build and return a list of compiled regex patterns paired with
    their replacement strings.

    ORDER MATTERS: More specific patterns (email, SSN) must come before
    broader ones (phone) to prevent false matches.

    Returns:
        List of (compiled_pattern, replacement_string) tuples.
    """
    patterns: List[Tuple[re.Pattern, str]] = []

    # ── Email addresses (FIRST — before phone can consume digits) ─
    # Matches standard email formats: user@domain.tld
    patterns.append((
        re.compile(
            r'\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b'
        ),
        '[EMAIL REDACTED]'
    ))

    # ── URLs and social media profiles ────────────────────────────
    # Full URLs: https://linkedin.com/in/johndoe, http://github.com/user
    patterns.append((
        re.compile(
            r'https?://[^\s,)\"\'<>]+'
        ),
        '[URL REDACTED]'
    ))
    # Bare LinkedIn / GitHub / social profiles without http
    patterns.append((
        re.compile(
            r'\b(?:linkedin\.com|github\.com|twitter\.com|facebook\.com'
            r'|x\.com|instagram\.com)/[^\s,)\"\'<>]+',
            re.IGNORECASE
        ),
        '[URL REDACTED]'
    ))

    # ── Social Security / National ID numbers (BEFORE phone) ──────
    # US SSN: 123-45-6789
    patterns.append((
        re.compile(r'\b\d{3}-\d{2}-\d{4}\b'),
        '[SSN REDACTED]'
    ))

    # ── Phone numbers ─────────────────────────────────────────────
    # Parenthesized area code: (555) 123-4567
    patterns.append((
        re.compile(
            r'(?:\+\d{1,3}[\s\-]?)?'           # optional country code
            r'\(\d{3}\)[\s\-]?'                 # (area code)
            r'\d{3}[\s\-]?\d{4}'                # subscriber
        ),
        '[PHONE REDACTED]'
    ))
    # Dashed/spaced: 555-123-4567, 555 123 4567, +1-555-123-4567
    patterns.append((
        re.compile(
            r'(?:\+\d{1,3}[\s\-])?'            # optional country code
            r'\d{3}[\s\-]\d{3}[\s\-]\d{4}\b'   # NNN-NNN-NNNN
        ),
        '[PHONE REDACTED]'
    ))
    # International: +63 917 123 4567
    patterns.append((
        re.compile(
            r'\+\d{1,3}[\s\-]\d{3}[\s\-]\d{3}[\s\-]\d{4}\b'
        ),
        '[PHONE REDACTED]'
    ))

    # ── Date of birth ─────────────────────────────────────────────
    # Labeled: "Date of Birth: ...", "DOB: ...", "Born: ..."
    patterns.append((
        re.compile(
            r'(?:date\s+of\s+birth|d\.?o\.?b\.?|born)\s*[:\-]?\s*'
            r'[\d]{1,2}[/\-\.][\d]{1,2}[/\-\.][\d]{2,4}',
            re.IGNORECASE
        ),
        '[DOB REDACTED]'
    ))
    # Labeled with month name: "Date of Birth: January 15, 1990"
    patterns.append((
        re.compile(
            r'(?:date\s+of\s+birth|d\.?o\.?b\.?|born)\s*[:\-]?\s*'
            r'(?:January|February|March|April|May|June|July|August|'
            r'September|October|November|December)\s+\d{1,2},?\s+\d{4}',
            re.IGNORECASE
        ),
        '[DOB REDACTED]'
    ))

    # ── Home / mailing addresses ──────────────────────────────────
    # Common street patterns: "123 Main Street", "456 Oak Ave, Apt 7"
    patterns.append((
        re.compile(
            r'\b\d{1,5}\s+'                              # street number
            r'[A-Za-z0-9\s]+\s+'                          # street name
            r'(?:Street|St|Avenue|Ave|Boulevard|Blvd|'
            r'Drive|Dr|Lane|Ln|Road|Rd|Court|Ct|'
            r'Place|Pl|Way|Circle|Cir|Terrace|Ter)\b'
            r'\.?'
            r'(?:[,\s]+(?:Apt|Suite|Ste|Unit|#)\s*\d+[A-Za-z]?)?',    # optional unit
            re.IGNORECASE
        ),
        '[ADDRESS REDACTED]'
    ))
    # ZIP/postal code patterns following city/state
    patterns.append((
        re.compile(
            r',?\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?'         # US: ", CA 90210" or ", CA 90210-1234"
        ),
        ''
    ))

    return patterns


# Pre-compile patterns at module load time for performance
_PII_PATTERNS = _build_patterns()


def _redact_name_header(text: str) -> str:
    """
    Heuristically redact the candidate's name from the resume header.

    Most resumes start with the candidate's full name on the first
    non-empty line. This function replaces that line with a placeholder.

    Only acts on the first non-empty line if it looks like a name:
    - 2–5 words
    - All words are purely alphabetic and title-cased
    - No digits, no punctuation, no common section keywords

    Args:
        text: The full resume text.

    Returns:
        The text with the name line redacted (if detected).
    """
    lines = text.split('\n')

    # Words that should NOT be treated as names
    excluded_words = {
        'summary', 'objective', 'education', 'experience',
        'skills', 'projects', 'certifications', 'references',
        'profile', 'about', 'contact', 'resume', 'curriculum',
        'vitae', 'cv', 'work', 'professional', 'technical',
        'just', 'the', 'and', 'for', 'with', 'from', 'this',
        'that', 'have', 'been', 'are', 'was', 'were', 'will',
    }

    for i, line in enumerate(lines):
        stripped = line.strip()
        if not stripped:
            continue  # skip blank lines

        words = stripped.split()

        # A name line is typically 2–5 title-case words, all purely alphabetic
        if 2 <= len(words) <= 5:
            # Every word must be purely alphabetic (no digits, colons, etc.)
            all_alpha = all(w.isalpha() for w in words)
            # All words start with uppercase
            all_title = all(w[0].isupper() for w in words)
            # None of the words are common non-name words
            has_excluded = any(w.lower() in excluded_words for w in words)

            if all_alpha and all_title and not has_excluded:
                lines[i] = '[NAME REDACTED]'
                break  # only redact the first name-like line

        # If the first non-empty line doesn't look like a name, stop
        break

    return '\n'.join(lines)


def anonymize_resume_content(text: str) -> str:
    """
    Anonymize PII in resume text before sending it to the AI.

    Applies a series of regex-based redactions to strip out
    personally identifiable information while preserving the
    professional content (skills, experience, education).

    The original text is NOT modified — this returns a new string.

    Args:
        text: Raw resume text content.

    Returns:
        Anonymized resume text with PII replaced by placeholders.

    Example:
        >>> raw = "John Doe\\njohn@example.com\\n5 years Python experience"
        >>> result = anonymize_resume_content(raw)
        >>> "john@example.com" not in result
        True
        >>> "Python experience" in result
        True
    """
    if not text:
        return text

    # Step 1: Redact the name header
    result = _redact_name_header(text)

    # Step 2: Apply regex-based PII patterns
    for pattern, replacement in _PII_PATTERNS:
        result = pattern.sub(replacement, result)

    # Step 3: Clean up identical consecutive redaction markers on adjacent lines
    # Only collapse when the SAME marker type appears multiple times in a row
    for marker in ['EMAIL', 'PHONE', 'URL', 'ADDRESS', 'DOB', 'SSN', 'NAME']:
        tag = f'[{marker} REDACTED]'
        pattern = re.compile(
            r'(?:' + re.escape(tag) + r'\s*){2,}'
        )
        result = pattern.sub(tag + '\n', result)

    return result
