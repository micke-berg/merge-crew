# Current state

Updated: 2026-10-05

## Where things stand

- Repository scaffolded (Next.js, TypeScript, Tailwind v4).
- Privacy check (private word list), secret scan (gitleaks), lint, typecheck and build run in CI.
- `docs/spec.md` is a draft waiting for owner review.

## Next

1. Owner reviews the spec.
2. Choose and test the character art: one robot in Rive, idle plus two emotions, rendered in the app.
3. Shared types in `src/engine/types.ts` (repository state, command, event, level).
4. First playable slice: one Act 2 level (Blaze force-pushes, the player recovers the commits), fully animated.

## Open questions

- Final art route: adapt the free Rive base, or commission.
