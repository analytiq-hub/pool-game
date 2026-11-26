# Tabletop Pool

A three.js 8-ball pool game modelled on a small tabletop toy table
(reference photos in `docs/images/`, which is git-ignored).

## Run it locally

Requires Node.js 20+.

Install dependencies (first time only), then start the Vite dev server:

```sh
npm install
npm run dev
```

Open http://localhost:5173 in your browser. The server reloads on file changes; stop it with Ctrl+C.

Other commands:

| Command | What it does |
|---|---|
| `npm test` | Physics and rules unit tests (Vitest) |
| `npm run build` | Type-check and build a static site into `dist/` |
| `npm run preview` | Serve the built `dist/` locally |

## Controls

- **Aim**: point at the table. The cue follows the pointer.
- **Shoot**: press, pull back to set power, and release.
- **Fine aim**: ← → (Shift for bigger steps). ↑ ↓ set power, Space shoots.
- **Spin**: drag the blue dot on the cue ball in the bottom right corner.
- **Camera**: right-drag to orbit, scroll to zoom. V switches between the player and top views.
- **Ball in hand**: move the cue ball and click to place it.

## Code layout

| Path | What it does |
|---|---|
| `src/constants.ts` | Table dimensions and physics parameters |
| `src/physics/` | Ball motion (slide/roll/spin), ball-ball throw, Han 2005 cushion model, pockets, aim prediction |
| `src/game/rules.ts` | Simplified 8-ball rules |
| `src/game/game.ts` | Game loop, input, camera |
| `src/render/` | Table, balls, cue, room and procedural textures |
| `src/ui/` | HUD (players, power, spin, help) |

The physics approach is inspired by [tailuge/billiards](https://github.com/tailuge/billiards). See `docs/inspiration.md`.
