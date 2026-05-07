import assert from "node:assert/strict";

import { anonymizeContent } from "./anonymize.js";

const cases = [
  {
    name: "redacts DOB values with month names",
    input: "Date of Birth: January 15, 1990",
    expected: "[DOB REDACTED]",
  },
  {
    name: "removes ZIP tails after address redaction",
    input: "Address: 123 Main Street, CA 90210",
    expected: "Address: [ADDRESS REDACTED]",
  },
  {
    name: "collapses adjacent duplicate markers",
    input: "[EMAIL REDACTED]\n[EMAIL REDACTED]",
    expected: "[EMAIL REDACTED]\n",
  },
];

for (const testCase of cases) {
  assert.equal(
    anonymizeContent(testCase.input),
    testCase.expected,
    `Failed case: ${testCase.name}`,
  );
}

console.log(`anonymize parity checks passed (${cases.length} cases)`);
