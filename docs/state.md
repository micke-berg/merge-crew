# Current state

Updated: 2026-10-05

## Where things stand

- Repository scaffolded (Next.js, TypeScript, Tailwind v4).
- Privacy check (private word list), secret scan (gitleaks), lint, typecheck and build run in CI.
- `docs/spec.md` approved by the owner (2026-10-05).
- Art: the free Rive robot was rejected. `docs/art-brief.md` goes to an external art tool; its three style directions come back to the owner to choose from.

## Next

1. Owner runs the art brief and picks a style direction. Until then, build with simple placeholder shapes so the art can be swapped in.
2. Shared types in `src/engine/types.ts` (repository state, command, event, level).
3. First playable slice: one Act 2 level (Blaze force-pushes, the player recovers the commits), fully animated.

## Open questions

- Which art style direction, and whether the generated art's licence allows a public repo.
