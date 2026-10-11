import type { Metadata } from "next";
import Link from "next/link";
import { entries } from "@/commands/entries";
import { CommandEntryCard } from "@/components/commands/CommandEntryCard";
import { secondaryButton } from "@/components/commands/styles";

export const metadata: Metadata = {
  title: "Git commands · Merge Crew",
  description:
    "A plain-language reference for the git commands Merge Crew teaches: what each one does, when to use it, and what can go wrong.",
};

export default function CommandsPage() {
  return (
    <div
      className="min-h-dvh bg-paper font-sans text-ink"
      style={{ backgroundImage: "radial-gradient(var(--color-paper-dot) 1.1px, transparent 1.2px)", backgroundSize: "22px 22px" }}
    >
      <main className="mx-auto max-w-3xl px-4 pt-8 pb-16 md:px-8 md:pt-12">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-full text-[14px] font-semibold text-soft underline decoration-line-strong underline-offset-4 hover:text-ink focus-visible:ring-4 focus-visible:ring-focus/30 focus-visible:outline-none"
        >
          <span aria-hidden>←</span> Back to Merge Crew
        </Link>

        <h1 className="mt-5 text-4xl leading-tight font-black tracking-[-0.02em] md:text-5xl">Git commands</h1>
        <p className="mt-3 max-w-xl text-lg leading-relaxed text-body">
          The commands the game teaches, in plain words. You can read this without playing, or jump into a level from any
          entry.
        </p>

        <nav aria-label="Commands" className="mt-6">
          <ul className="flex flex-wrap gap-2">
            {entries.map((e) => (
              <li key={e.slug}>
                <a
                  href={`#${e.slug}`}
                  className="inline-block rounded-full border border-line-strong bg-card px-3 py-1 font-mono text-[12.5px] font-semibold text-soft transition-colors hover:bg-sunk hover:text-ink focus-visible:ring-4 focus-visible:ring-focus/30 focus-visible:outline-none"
                >
                  {e.slug}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mt-8 space-y-5">
          {entries.map((e) => (
            <CommandEntryCard key={e.slug} entry={e} />
          ))}
        </div>

        <p className="mt-10 text-center">
          <Link href="/" className={secondaryButton}>
            Back to the game
          </Link>
        </p>
      </main>
    </div>
  );
}
