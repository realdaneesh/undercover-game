export function Mark({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path d="M5 17c12-7 26-7 38 0l-3 15c-5 7-11 7-16 0-5 7-11 7-16 0L5 17Z" fill="currentColor" />
      <path
        d="m12 21 9 4-9 3m24-7-9 4 9 3"
        stroke="var(--eye-color, #13101e)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
export function Brand() {
  return (
    <div className="brand">
      <span className="brand-icon">
        <Mark />
      </span>
      <span>
        UNDERCOVER<span className="brand-dot">.</span>
      </span>
    </div>
  );
}
