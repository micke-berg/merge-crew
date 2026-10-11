import Link from "next/link";
import type { ReactNode } from "react";
import type { CommandEntry } from "@/commands/entries";
import { primaryButton, secondaryButton } from "./styles";

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-[12px] font-bold tracking-[0.12em] text-muted uppercase">{label}</dt>
      <dd className="mt-0.5 text-[15px] leading-relaxed text-body">{children}</dd>
    </div>
  );
}

/** One command: the name, the plain sentences, examples to type, and links into the game. */
export function CommandEntryCard({ entry }: { entry: CommandEntry }) {
  const { slug, command, title, what, when, risk, examples, practice, usedIn } = entry;
  return (
    <article
      id={slug}
      aria-labelledby={`${slug}-title`}
      className="scroll-mt-6 rounded-3xl border border-line bg-panel p-5 shadow-[0_1px_0_white_inset,0_10px_30px_-18px_rgba(74,58,32,0.35)]"
    >
      <h2 id={`${slug}-title`} className="text-xl leading-tight font-extrabold tracking-tight">
        <a
          href={`#${slug}`}
          className="rounded hover:underline hover:decoration-line-strong hover:underline-offset-4 focus-visible:ring-4 focus-visible:ring-focus/30 focus-visible:outline-none"
        >
          {title}
        </a>
      </h2>
      <p className="mt-2">
        <code className="inline-block max-w-full rounded-lg bg-ink px-2 py-0.5 font-mono text-[13px] break-words text-paper">{command}</code>
      </p>

      <dl className="mt-4 space-y-3">
        <Fact label="What it does">{what}</Fact>
        <Fact label="When to use it">{when}</Fact>
        <Fact label="What can go wrong">{risk}</Fact>
      </dl>

      <div className="mt-4">
        <p className="text-[12px] font-bold tracking-[0.12em] text-muted uppercase">Examples</p>
        <pre className="mt-1 rounded-2xl bg-ink px-3.5 py-3 font-mono text-[13px] leading-relaxed whitespace-pre-wrap break-words text-paper">
          {examples.map((line) => `$ ${line}`).join("\n")}
        </pre>
      </div>

      {(practice || usedIn) && (
        <div className="mt-4 flex flex-wrap gap-2.5">
          {practice && (
            <Link href={`/level/${practice}`} className={primaryButton}>
              Practise it
            </Link>
          )}
          {usedIn && (
            <Link href={`/level/${usedIn}`} className={secondaryButton}>
              Use it for real
            </Link>
          )}
        </div>
      )}
    </article>
  );
}
