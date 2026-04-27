/**
 * AnonymousName Component
 *
 * Displays a candidate's name in a hidden/anonymized state by default.
 * Clicking reveals the real name with a smooth transition.
 *
 * Props:
 *   - name: The real candidate name
 *   - id: A unique identifier (used for the anonymous label)
 *   - showAvatar: Whether to render an avatar circle (default: true)
 *   - revealed: Optional external control — if provided, overrides internal toggle
 */

import { useState } from "react";
import "./AnonymousName.css";

const AnonymousName = ({
  name,
  id,
  showAvatar = true,
  revealed: revealedProp,
}) => {
  const [revealedInternal, setRevealedInternal] = useState(false);
  const revealed = revealedProp !== undefined ? revealedProp : revealedInternal;

  const displayName = revealed ? name || "Unknown" : `Candidate #${id}`;
  const avatarChar = revealed ? (name || "?")[0].toUpperCase() : "?";

  const handleToggle = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (revealedProp === undefined) {
      setRevealedInternal((prev) => !prev);
    }
  };

  return (
    <div
      className={`anon-name ${revealed ? "anon-name--revealed" : "anon-name--hidden"}`}
      onClick={handleToggle}
      title={revealed ? "Click to hide name" : "Click to reveal name"}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") handleToggle(e);
      }}
    >
      {showAvatar && <div className="anon-name__avatar">{avatarChar}</div>}
      <div className="anon-name__text">
        <span className="anon-name__label">{displayName}</span>
        <span className="anon-name__icon">
          {revealed ? (
            /* Eye-off icon */
            <svg viewBox="0 0 24 24" fill="none" width="14" height="14">
              <path
                d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <line
                x1="1"
                y1="1"
                x2="23"
                y2="23"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            /* Eye icon */
            <svg viewBox="0 0 24 24" fill="none" width="14" height="14">
              <path
                d="M1 12C1 12 5 4 12 4C19 4 23 12 23 12C23 12 19 20 12 20C5 20 1 12 1 12Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle
                cx="12"
                cy="12"
                r="3"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </span>
      </div>
    </div>
  );
};

export default AnonymousName;
