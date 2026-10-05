// Pathspec matching: exact paths, directories, "." and simple globs. Paths are relative to the
// worktree root; Merge Crew has no current directory below the root.

import type { Path } from "./types";

export function normalizeSpec(spec: string): string {
  let s = spec;
  while (s.startsWith("./")) s = s.slice(2);
  if (s.startsWith(":/")) s = s.slice(2);
  while (s.endsWith("/") && s.length > 1) s = s.slice(0, -1);
  return s === "." ? "" : s;
}

function globToRegExp(glob: string): RegExp {
  let re = "";
  for (const ch of glob) {
    if (ch === "*") re += ".*";
    else if (ch === "?") re += ".";
    else re += ch.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${re}$`);
}

export function matches(spec: string, path: Path): boolean {
  const s = normalizeSpec(spec);
  if (s === "") return true;
  if (path === s || path.startsWith(`${s}/`)) return true;
  if (/[*?]/.test(s)) return globToRegExp(s).test(path);
  return false;
}

/** Whether the spec matched a path only as a directory, which `git rm` needs -r for. */
export function matchesAsDirectory(spec: string, path: Path): boolean {
  const s = normalizeSpec(spec);
  return s === "" || path.startsWith(`${s}/`);
}

export function select(specs: string[], paths: Iterable<Path>): { matched: Path[]; unmatched: string[] } {
  const all = [...new Set(paths)].sort();
  const matched = new Set<Path>();
  const unmatched: string[] = [];
  for (const spec of specs) {
    const hits = all.filter((p) => matches(spec, p));
    if (hits.length === 0) unmatched.push(spec);
    for (const h of hits) matched.add(h);
  }
  return { matched: [...matched].sort(), unmatched };
}
