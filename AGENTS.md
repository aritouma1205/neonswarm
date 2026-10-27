# NEON SWARM

Zero-asset survivors-like arena shooter. Vanilla TypeScript + Canvas 2D;
every visual and sound is procedural.

## Commands

```bash
npm install          # once
npm run dev          # play (vite dev server)
npm run typecheck    # tsc --noEmit
npm test             # vitest — includes headless bot playtests in tests/balance.test.ts
npm run build        # production bundle → dist/
npx vite preview     # serve the built bundle (used by scripts/)
```

## Layout

- `src/core/` — engine primitives: fixed-step loop support, seeded RNG
  (mulberry32), object `Pool`, `SpatialHash` broad phase, `Input`.
- `src/game/` — gameplay: `state.ts` (Game orchestrator, pooled entities,
  hit/death/XP/level-up flow), `director.ts` (spawn budget + boss schedule),
  `enemies.ts`, `weapons.ts`, `upgrades.ts`, `collisions.ts`, `gems.ts`,
  `fx.ts`, `camera.ts`, `audio.ts` (WebAudio synth SFX + 16-step sequencer),
  `ui.ts` (DOM screens).
- `src/render/` — canvas renderer: `sprites.ts` (pre-rendered glow sprites),
  `background.ts` (parallax starfield + grid), `hud.ts`.
- `scripts/` — `screenshot.mjs` (playwright-core smoke run), `stage-shot.mjs`
  (poses a dense real frame for the film), `render-music.mjs` (the game's
  sequencer pattern → WAV).
- `promo/` — HyperFrames composition: 20 s launch film
  (`npx hyperframes check|snapshot|render` inside it; needs ffmpeg on PATH).

## Conventions

- Deterministic sim: entities live in fixed pools; `Game` takes a seed.
  `update(dt, input)` is pure w.r.t. that rng — tests drive it headlessly.
- Tune constants in `src/game/config.ts` + `director.ts` curves only;
  `tests/balance.test.ts` (kiting bot) is the regression check — median
  survival should stay roughly 120–200 s.
