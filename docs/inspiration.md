# Inspiration & Prior Art

External projects worth studying before building the three.js pool game.
Check each repo's license before copying any code.

## Full games / strong references

| Project | Stack | Why it's interesting |
|---|---|---|
| [tailuge/billiards](https://github.com/tailuge/billiards) ([play](https://tailuge.itch.io/billiards)) | TypeScript + three.js | The most complete open-source browser billiards game. Physics based on published research (Han 2005, Mathavan 2010): sidespin, backspin, and cushion bounce that depends on spin, contact height and friction. LGPL v3.0. |
| [eigu47/playpool](https://github.com/eigu47/playpool) | three.js + React Three Fiber + Rapier | 8-ball built on a general-purpose physics engine. Good contrast to a hand-written physics approach. |
| [smkplus/Snooker.io](https://github.com/smkplus/Snooker.io) | three.js | WebGL 8-ball pool. |
| [lolwuz/Pool](https://github.com/lolwuz/Pool) | three.js | Small, simple 3D pool game; easy to read end to end. |
| [1j01/pool](https://github.com/1j01/pool) | three.js | Table and ball visuals; no real physics or gameplay. |
| [henshmi/Classic-Pool-Game](https://github.com/henshmi/Classic-Pool-Game) | JS / 2D canvas | Classic 2D gameplay loop and rules. |
| [foo123/Billiard.js](https://github.com/foo123/Billiard.js) | JS | Billiards simulation. |

## Physics reading

- [Why most pool games feel wrong: realistic cushion physics](https://billiards.tailuge.workers.dev/blog1.html)
- [Implementing Mathavan cushion physics](https://billiards.tailuge.workers.dev/blog3.html)
- [tailuge three.js physics diagrams](https://tailuge.github.io/billiards/dist/diagrams/three.html)
- [Reproducing Han and Mathavan physics in billiards (three.js forum)](https://discourse.threejs.org/t/reproducing-han-and-mathaven-physics-in-billiards/91034)
- [Unsophisticated 3D billiards physics (three.js forum)](https://discourse.threejs.org/t/unsophisticated-3d-billiards-physics/67118)
- [pooltool](https://github.com/ekiefl/pooltool): Python billiards sandbox focused on realistic physics. A good source for the equations.

## Main design choice: physics

1. **Hand-written ball physics** (the tailuge approach). Balls are spheres on a plane, so collisions are analytic: ball-ball, ball-cushion and pockets. This gives full control over spin, roll and slide transitions, and it is deterministic, which helps with replays and multiplayer.
2. **General physics engine** (Rapier or cannon-es, the playpool approach). Faster to get running, but it is harder to make spin and cushion response feel right.

Recommendation: write the physics by hand, with a fixed timestep and substeps. Use three.js only for rendering.

## Images

Model and reference images go in [`images/`](images/).
