# CLAUDE.md

Digital playtest client for the **Churrasco** card game (3–7 players, remote,
browser/phone; multiplayer via Playroom Kit, no backend). This is a _balancing
tool_, not a shipping product — every tuning lever lives in one file and the
end screen shows the score broken down by category.

- **Setup, scripts, and a prose architecture tour:** `README.md`.
- **Design rationale / living design log** (why each rule and number is what it
  is, what was cut and why): `DOCS.md`, and the source-of-truth design doc at
  `~/Docs/dev/game/churrasco/_index.md`.

Read `DOCS.md` before changing any rule or balance number — most "obvious"
tweaks were already tried and rejected there.

## Commands

- `npm test` — Vitest engine suite. **Run after any `src/game/` change.**
- `npm run build` — `tsc -b` (typecheck) + Vite build. Run before calling a
  change done; scripts in `scripts/` are _not_ in the build, so smoke-run them
  separately if you touch them (`npx tsx scripts/sim.ts 200`).
- `npm run dev` — local Playroom session (works without a gameId).
- `npm run lint` (oxlint) / `npm run format` (prettier).

## Architecture boundary — the one thing to get right

Two worlds, kept strictly separate:

1. **`src/game/` — the pure engine.** No React, no Playroom, no I/O. `rules.ts`
   is a reducer: `applyMove(snap, playerId, move)` returns a **new** snapshot
   (`structuredClone` then mutate) or **throws** on an illegal move.
   `legalMoves(snap, playerId)` is the single source of truth for what's
   allowed. The engine is **deterministic**: all randomness comes from the
   seeded `mulberry32` RNG (`deck.ts`) or a `rand`/`Math.random` passed in by
   the caller (`bot.ts`). **Never** call `Date.now()` / `Math.random()` inside
   the engine — that entropy belongs to the host.

2. **`src/multiplayer/useGameEngine.tsx` — the host.** Host-authoritative sync:
   the _entire_ `GameSnapshot` lives under one synced key, and **the host is the
   only writer**. It validates every move through the pure engine and publishes
   the result; other clients send moves over RPC. Because full state is synced
   (not host memory), host migration and late joins just work. The host also
   injects entropy (`newGame(seats, Date.now() >>> 0)`, bot `Math.random`) and
   runs the auto-pilot for bots / disconnected / idle seats.

UI (`src/components/`) only ever reads `game`/`myMoves` and calls `dispatch(move)`.
It must never mutate state or encode rules — if the UI needs to know whether
something is allowed, it asks `legalMoves`.

## Engine invariants (breaking these desyncs or hangs the game)

- **Everyone reaches 7 together.** The game ends when _every_ hand hits
  `CONFIG.handSize` (7). This only works because every event is **symmetric in
  card count** — all players net +1, or all net 0 — and resolves at round start.
  A new event that gives some players more cards than others will desync the
  end. Net-zero rounds (Não Alimente, As Sobras) just stretch the game by a
  round; the final tableau is always exactly 7.
- **`RoundModifiers` reset every round** (`DEFAULT_MODIFIERS`) and are set by the
  drawn event's `preDeal`. Two hooks, both at round start: `preDeal` (set
  modifiers before the buffet refills) and `postDeal` (override the starter, set
  up a pending interaction phase, or burn the round).
- **Termination / anti-stall** (digital-only house rule, `CONFIG.antiStallPass`):
  pass and abacaxi-swap are legal only while a face-down card remains. On a
  physical table social pressure ends the round; online this guarantees the loop
  terminates. The property tests assert termination + 68-card conservation +
  hands-in-sync across many seeds — keep them green.
- **Sobras públicas:** leftover buffet cards flip face-up at `endRound` before
  carrying over, so next round's carryover is common knowledge.

## Balancing & the sim harness

Every balance lever is in `src/game/config.ts` (points curves, deck copies,
buffet size, placement bonuses, the pratos table). **Don't hand-tune balance by
intuition** — validate with the headless bot-vs-bot sims:

- `scripts/sim.ts` — skill vs. luck, bot-policy comparisons.
- `scripts/sim-players.ts` — scaling across player counts.
- `scripts/sim-linguica.ts` — build-viability experiments.

Run: `npx tsx scripts/<name>.ts [games]`. Design decisions in `DOCS.md` cite
these sims; add/extend a sim when proposing a balance change.

## Conventions

- **Player-facing strings are PT-BR** (`name`/`desc`, banners, card labels).
  **Code, comments, identifiers, and tests are English.**
- **Comments explain _why_, not _what_.** This codebase is densely commented
  with the reasoning and playtest history behind each decision — match that
  density and tone; don't add a comment that only restates the code.
- Style: no semicolons, single quotes, 2-space indent (`npm run format`).
- Tests are colocated `*.test.ts` in `src/game/`. Prefer adding a case there over
  manual verification for engine behavior.
