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
 * URLs, DOBs, street addresses, and ZIP/postal tails.
 *
 * @param {string} text - Raw resume content
 * @returns {string} Anonymized text with [REDACTED] placeholders
 */
export function anonymizeContent(text) {
  if (!text) return text;

  const excludedWords = new Set([
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
    "with",
    "from",
    "this",
    "that",
    "have",
    "been",
    "are",
    "was",
    "were",
    "will",
  ]);

  // Step 1: redact the first non-empty line when it looks like a name.
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const stripped = lines[i].trim();
    if (!stripped) {
      continue;
    }

    const words = stripped.split(/\s+/);
    if (words.length >= 2 && words.length <= 5) {
      const allAlpha = words.every((word) => /^[A-Za-z]+$/.test(word));
      const allTitle = words.every((word) => /^[A-Z]/.test(word));
      const hasExcludedWord = words.some((word) => excludedWords.has(word.toLowerCase()));

      if (allAlpha && allTitle && !hasExcludedWord) {
        lines[i] = "[NAME REDACTED]";
        break;
      }
    }

    // If the first non-empty line does not look like a name, stop.
    break;
  }

  let result = lines.join("\n");

  // Step 2: apply regex-based PII patterns in backend order.
  const patterns = [
    [/\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g, "[EMAIL REDACTED]"],
    [/https?:\/\/[^\s,)"'<>]+/g, "[URL REDACTED]"],
    [
      /\b(?:linkedin\.com|github\.com|twitter\.com|facebook\.com|x\.com|instagram\.com)\/[^\s,)"'<>]+/gi,
      "[URL REDACTED]",
    ],
    [/\b\d{3}-\d{2}-\d{4}\b/g, "[SSN REDACTED]"],
    [/(?:\+\d{1,3}[\s\-]?)?\(\d{3}\)[\s\-]?\d{3}[\s\-]?\d{4}/g, "[PHONE REDACTED]"],
    [/(?:\+\d{1,3}[\s\-])?\d{3}[\s\-]\d{3}[\s\-]\d{4}\b/g, "[PHONE REDACTED]"],
    [/\+\d{1,3}[\s\-]\d{3}[\s\-]\d{3}[\s\-]\d{4}\b/g, "[PHONE REDACTED]"],
    [
      /(?:date\s+of\s+birth|d\.?o\.?b\.?|born)\s*[:\-]?\s*[\d]{1,2}[\/\-\.][\d]{1,2}[\/\-\.][\d]{2,4}/gi,
      "[DOB REDACTED]",
    ],
    [
      /(?:date\s+of\s+birth|d\.?o\.?b\.?|born)\s*[:\-]?\s*(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}/gi,
      "[DOB REDACTED]",
    ],
    [
      /\b\d{1,5}\s+[A-Za-z0-9\s]+\s+(?:Street|St|Avenue|Ave|Boulevard|Blvd|Drive|Dr|Lane|Ln|Road|Rd|Court|Ct|Place|Pl|Way|Circle|Cir|Terrace|Ter)\b\.?(?:[,\s]+(?:Apt|Suite|Ste|Unit|#)\s*\d+[A-Za-z]?)?/gi,
      "[ADDRESS REDACTED]",
    ],
    [/,?\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?/g, ""],
  ];

  for (const [pattern, replacement] of patterns) {
    result = result.replace(pattern, replacement);
  }

  // Step 3: collapse adjacent duplicate redaction markers of the same type.
  for (const marker of ["EMAIL", "PHONE", "URL", "ADDRESS", "DOB", "SSN", "NAME"]) {
    const tag = `[${marker} REDACTED]`;
    const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const duplicatePattern = new RegExp(`(?:${escapedTag}\\s*){2,}`, "g");
    result = result.replace(duplicatePattern, `${tag}\n`);
  }

  return result;
}
