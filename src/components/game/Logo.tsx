/** The Merge Crew mark: a main line with one branch leaving and merging back. */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="10" fill="#26283B" />
      <path d="M7 21 H25" stroke="#F7F1E5" strokeWidth="3" strokeLinecap="round" />
      <path d="M11 21 C13 21 13 12 16 12 H20 C23 12 22 21 25 21" stroke="#D9461B" strokeWidth="3" fill="none" strokeLinecap="round" />
      <circle cx="9" cy="21" r="2.6" fill="#fff" stroke="#F7F1E5" strokeWidth="1" />
      <circle cx="17" cy="12" r="2.6" fill="#fff" stroke="#D9461B" strokeWidth="1.6" />
      <circle cx="25" cy="21" r="3" fill="#fff" stroke="#11876F" strokeWidth="2" />
    </svg>
  );
}
