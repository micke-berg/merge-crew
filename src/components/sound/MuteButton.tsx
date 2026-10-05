"use client";

import { useSound } from "./useSound";

/** Sound on/off, styled like the header's "Restart level" button. The choice is remembered. */
export function MuteButton({ className = "" }: { className?: string }) {
  const { muted, toggleMuted, unlock, play } = useSound();
  return (
    <button
      type="button"
      aria-pressed={muted}
      aria-label={muted ? "Sound is off. Turn sound on" : "Sound is on. Turn sound off"}
      title={muted ? "Sound off" : "Sound on"}
      onClick={() => {
        unlock();
        const nowMuted = toggleMuted();
        if (!nowMuted) play("click");
      }}
      className={`inline-flex items-center gap-1.5 rounded-full border border-[#B9AD97] px-3 py-1.5 text-sm font-semibold text-[#5D5649] transition-colors hover:bg-[#F3ECDF] hover:text-[#26283B] focus-visible:ring-4 focus-visible:ring-[#2563C9]/30 focus-visible:outline-none ${className}`}
    >
      <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden>
        <path d="M2.5 6h2.2L8 3.2v9.6L4.7 10H2.5z" fill="currentColor" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
        {muted ? (
          <path d="M10.5 6l4 4M14.5 6l-4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        ) : (
          <>
            <path d="M10.4 5.6a3.4 3.4 0 0 1 0 4.8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            <path d="M12.3 3.8a6 6 0 0 1 0 8.4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </>
        )}
      </svg>
      <span className="hidden sm:inline">{muted ? "Sound off" : "Sound on"}</span>
    </button>
  );
}
