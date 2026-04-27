/**
 * Frontend Anonymization Utility
 *
 * Mirrors the backend anonymization_service.py logic in JavaScript.
 * Used to mask PII in resume content displayed in the UI before the
 * recruiter explicitly chooses to reveal it.
 */

/**
 * Anonymize PII in resume text for display in the UI.
 *
 * Strips: names (first line heuristic), emails, phones, SSNs,
 * URLs, DOBs, and street addresses.
 *
 * @param {string} text - Raw resume content
 * @returns {string} Anonymized text with [REDACTED] placeholders
 */
export function anonymizeContent(text) {
  if (!text) return text;

  let result = text;

  // ── Name header (first non-empty line if it looks like a name) ──
  const lines = result.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const stripped = lines[i].trim();
    if (!stripped) continue;

    const words = stripped.split(/\s+/);
    if (words.length >= 2 && words.length <= 5) {
      const allAlpha = words.every((w) => /^[A-Za-z]+$/.test(w));
      const allTitle = words.every((w) => /^[A-Z]/.test(w));
      const excluded = new Set([
        "summary",
        "objective",
        "education",
        "experience",
        "skills",
        "projects",
        "certifications",
        "references",
        "profile",
        "about",
        "contact",
        "resume",
        "curriculum",
        "vitae",
        "cv",
        "work",
        "professional",
        "technical",
        "just",
        "the",
        "and",
        "for",
      ]);
      const hasExcluded = words.some((w) => excluded.has(w.toLowerCase()));

      if (allAlpha && allTitle && !hasExcluded) {
        lines[i] = "[NAME REDACTED]";
      }
    }
    break; // only check first non-empty line
  }
  result = lines.join("\n");

  // ── Emails ─────────────────────────────────────────────────────
  result = result.replace(
    /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g,
    "[EMAIL REDACTED]",
  );

  // ── URLs ───────────────────────────────────────────────────────
  result = result.replace(/https?:\/\/[^\s,)"'<>]+/g, "[URL REDACTED]");
  result = result.replace(
    /\b(?:linkedin\.com|github\.com|twitter\.com|facebook\.com|x\.com|instagram\.com)\/[^\s,)"'<>]+/gi,
    "[URL REDACTED]",
  );

  // ── SSN ────────────────────────────────────────────────────────
  result = result.replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[SSN REDACTED]");

  // ── Phone numbers ──────────────────────────────────────────────
  // (NNN) NNN-NNNN
  result = result.replace(
    /(?:\+\d{1,3}[\s-]?)?\(\d{3}\)[\s-]?\d{3}[\s-]?\d{4}/g,
    "[PHONE REDACTED]",
  );
  // NNN-NNN-NNNN or NNN NNN NNNN
  result = result.replace(
    /(?:\+\d{1,3}[\s-])?\d{3}[\s-]\d{3}[\s-]\d{4}\b/g,
    "[PHONE REDACTED]",
  );
  // +CC NNN NNN NNNN (international)
  result = result.replace(
    /\+\d{1,3}[\s-]\d{3}[\s-]\d{3}[\s-]\d{4}\b/g,
    "[PHONE REDACTED]",
  );

  // ── DOB ────────────────────────────────────────────────────────
  result = result.replace(
    /(?:date\s+of\s+birth|d\.?o\.?b\.?|born)\s*[:\-]?\s*\d{1,2}[/\-\.]\d{1,2}[/\-\.]\d{2,4}/gi,
    "[DOB REDACTED]",
  );

  // ── Street addresses ──────────────────────────────────────────
  result = result.replace(
    /\b\d{1,5}\s+[A-Za-z0-9\s]+\s+(?:Street|St|Avenue|Ave|Boulevard|Blvd|Drive|Dr|Lane|Ln|Road|Rd|Court|Ct|Place|Pl|Way|Circle|Cir|Terrace|Ter)\b\.?(?:[,\s]+(?:Apt|Suite|Ste|Unit|#)\s*\d+[A-Za-z]?)?/gi,
    "[ADDRESS REDACTED]",
  );

  return result;
}
