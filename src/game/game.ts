import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  FOOT_SPOT_X,
  HALF_L,
  HALF_W,
  HEAD_STRING_X,
  MAX_SHOT_SPEED,
  MAX_TIP_OFFSET,
  PHYSICS_DT,
  R,
} from '../constants';
import { playBallClick, playCueHit, playCushion, playPocket, setSoundEnabled, soundEnabled, unlockAudio } from '../audio';
import { predictAim } from '../physics/aim';
import { anyMoving, Ball, step, strike, type PhysicsEvent } from '../physics/physics';
import { AimGuide } from '../render/aimGuide';
import { BallView, ballGeometry } from '../render/balls';
import { CueView } from '../render/cue';
import { Hud } from '../ui/hud';
import { evaluateShot, newGame, type GameState } from './rules';

type Phase = 'placing' | 'aiming' | 'striking' | 'rolling' | 'over';

const STRIKE_TIME = 0.09;
const MAX_STEPS_PER_FRAME = 240;
const DRAG_FULL_POWER_PX = 220;

const VIEWS = {
  player: { pos: new THREE.Vector3(-0.66, 0.44, 0.1), target: new THREE.Vector3(0.03, -0.02, 0) },
  top: { pos: new THREE.Vector3(0, 0.78, 0.0001), target: new THREE.Vector3(0, 0, 0) },
};

export class Game {
  private readonly balls: Ball[] = [];
  private readonly views: BallView[] = [];
  private readonly cue = new CueView();
  private readonly guide = new AimGuide();
  private readonly headLine: THREE.Line;
  private readonly controls: OrbitControls;
  private readonly hud: Hud;
  private readonly raycaster = new THREE.Raycaster();
  private readonly aimPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -R);

  private state: GameState = newGame();
  private phase: Phase = 'placing';
  private aim = new THREE.Vector2(1, 0);
  private power = 0;
  private spin = { side: 0, height: 0 };
  private drag: { x: number; y: number } | null = null;
  private strikeT = 0;
  private strikePower = 0;
  private shot = { firstHit: null as number | null, potted: [] as number[] };
  private onTableBefore = new Set<number>();
  private accumulator = 0;
  private viewMode: keyof typeof VIEWS = 'player';
  private cameraTween: { t: number; fromPos: THREE.Vector3; fromTarget: THREE.Vector3 } | null = null;

  constructor(
    scene: THREE.Scene,
    private readonly camera: THREE.PerspectiveCamera,
    private readonly dom: HTMLElement,
    hudContainer: HTMLElement,
  ) {
    const geo = ballGeometry();
    for (let id = 0; id < 16; id++) {
      const b = new Ball(id);
      this.balls.push(b);
      const v = new BallView(b, geo);
      this.views.push(v);
      scene.add(v.mesh);
    }
    scene.add(this.cue.group, this.guide.group);

    this.headLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(HEAD_STRING_X, 0.0006, -HALF_W),
        new THREE.Vector3(HEAD_STRING_X, 0.0006, HALF_W),
      ]),
      new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.45 }),
    );
    scene.add(this.headLine);

    camera.position.copy(VIEWS.player.pos);
    this.controls = new OrbitControls(camera, dom);
    this.controls.target.copy(VIEWS.player.target);
    this.controls.enableDamping = true;
    this.controls.minDistance = 0.22;
    this.controls.maxDistance = 2.2;
    this.controls.maxPolarAngle = THREE.MathUtils.degToRad(82);
    // Left button and one finger are for aiming and shooting.
    this.controls.mouseButtons = {
      LEFT: null as unknown as THREE.MOUSE,
      MIDDLE: THREE.MOUSE.PAN,
      RIGHT: THREE.MOUSE.ROTATE,
    };
    this.controls.touches = { ONE: null as unknown as THREE.TOUCH, TWO: THREE.TOUCH.DOLLY_ROTATE };

    this.hud = new Hud(hudContainer, {
      onNewGame: () => this.newGame(),
      onToggleView: () => this.toggleView(),
      onToggleSound: () => {
        setSoundEnabled(!soundEnabled());
        return soundEnabled();
      },
      onSpinChange: (side, height) => (this.spin = { side, height }),
    });

    this.bindInput();
    this.newGame();
  }

  // ---------- setup ----------

  newGame(): void {
    this.state = newGame();
    this.rack();
    this.hud.showGameOver(null);
    this.hud.flash(this.state.message, 5000);
    this.refreshHud();
  }

  private rack(): void {
    const cue = this.balls[0];
    cue.place(HEAD_STRING_X - 0.03, 0);
    // Apex toward the head; 8 in the middle; one solid and one stripe in the back corners.
    const order = this.rackOrder();
    const dx = Math.sqrt(3) * R + 1e-5;
    let k = 0;
    for (let row = 0; row < 5; row++) {
      for (let j = 0; j <= row; j++) {
        const id = order[k++];
        const jitter = (Math.random() - 0.5) * 1e-5;
        this.balls[id].place(FOOT_SPOT_X + row * dx, (j - row / 2) * (2 * R + 2e-5) + jitter);
      }
    }
    this.views.forEach((v) => v.reset());
    this.aim.set(1, 0);
    this.phase = 'placing';
  }

  private rackOrder(): number[] {
    const solids = [1, 2, 3, 4, 5, 6, 7];
    const stripes = [9, 10, 11, 12, 13, 14, 15];
    const shuffle = (a: number[]) => a.sort(() => Math.random() - 0.5);
    shuffle(solids);
    shuffle(stripes);
    const solidCorner = solids.pop()!;
    const stripeCorner = stripes.pop()!;
    const rest = shuffle([...solids, ...stripes]);
    // Rack positions in order: row 0 (1), row 1 (2), row 2 (3), row 3 (4), row 4 (5).
    const order: number[] = new Array(15);
    order[4] = 8; // middle of row 2
    const corners = Math.random() < 0.5 ? [solidCorner, stripeCorner] : [stripeCorner, solidCorner];
    order[10] = corners[0];
    order[14] = corners[1];
    for (let i = 0; i < 15; i++) if (order[i] === undefined) order[i] = rest.pop()!;
    return order;
  }

  // ---------- input ----------

  private pointerOnTable(e: PointerEvent): THREE.Vector3 | null {
    const rect = this.dom.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(this.aimPlane, hit);
  }

  private bindInput(): void {
    this.dom.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      unlockAudio();
      const p = this.pointerOnTable(e);
      if (this.phase === 'placing') {
        if (p) this.moveCueBall(p.x, p.z);
        if (this.cuePlacementValid()) {
          this.phase = 'aiming';
          this.hud.flash('Aim, then press and pull back to shoot.', 2500);
        }
        return;
      }
      if (this.phase === 'aiming') {
        if (p) this.aimAt(p);
        this.drag = { x: e.clientX, y: e.clientY };
        this.dom.setPointerCapture(e.pointerId);
      }
    });

    this.dom.addEventListener('pointermove', (e) => {
      if (this.phase === 'placing') {
        const p = this.pointerOnTable(e);
        if (p) this.moveCueBall(p.x, p.z);
        return;
      }
      if (this.phase !== 'aiming') return;
      if (this.drag) {
        const d = Math.hypot(e.clientX - this.drag.x, e.clientY - this.drag.y);
        this.power = Math.min(1, d / DRAG_FULL_POWER_PX);
      } else if (e.pointerType === 'mouse') {
        const p = this.pointerOnTable(e);
        if (p) this.aimAt(p);
      }
    });

    const release = () => {
      if (!this.drag) return;
      this.drag = null;
      if (this.phase === 'aiming' && this.power > 0.02) this.shoot();
      else this.power = 0;
    };
    this.dom.addEventListener('pointerup', release);
    this.dom.addEventListener('pointercancel', () => {
      this.drag = null;
      this.power = 0;
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'v' || e.key === 'V') this.toggleView();
      else if (e.key === 'h' || e.key === 'H') this.hud.toggleHelp();
      else if (e.key === 'Escape') {
        this.drag = null;
        this.power = 0;
        this.hud.toggleHelp(false);
      }
      if (this.phase !== 'aiming') return;
      const stepAngle = THREE.MathUtils.degToRad(e.shiftKey ? 2 : 0.25);
      if (e.key === 'ArrowLeft') this.aim.rotateAround(new THREE.Vector2(), -stepAngle);
      else if (e.key === 'ArrowRight') this.aim.rotateAround(new THREE.Vector2(), stepAngle);
      else if (e.key === 'ArrowUp') this.power = Math.min(1, this.power + 0.04);
      else if (e.key === 'ArrowDown') this.power = Math.max(0, this.power - 0.04);
      else if (e.key === ' ') {
        unlockAudio();
        if (this.power > 0.02) this.shoot();
        else this.hud.flash('Set the power with ↑ first, or drag back with the mouse.', 2500);
      } else return;
      e.preventDefault();
    });
  }

  private aimAt(p: THREE.Vector3): void {
    const c = this.balls[0].pos;
    const dx = p.x - c.x;
    const dz = p.z - c.z;
    if (Math.hypot(dx, dz) > R * 0.5) this.aim.set(dx, dz).normalize();
  }

  private moveCueBall(x: number, z: number): void {
    const maxX = this.state.kitchenOnly ? HEAD_STRING_X : HALF_L - R;
    const cx = THREE.MathUtils.clamp(x, -HALF_L + R, maxX);
    const cz = THREE.MathUtils.clamp(z, -HALF_W + R, HALF_W - R);
    const cue = this.balls[0];
    const prev = cue.pos.clone();
    cue.place(cx, cz);
    if (!this.cuePlacementValid()) cue.place(prev.x, prev.z);
  }

  private cuePlacementValid(): boolean {
    const cue = this.balls[0];
    return this.balls.every(
      (b) => b === cue || !b.onTable || Math.hypot(b.pos.x - cue.pos.x, b.pos.z - cue.pos.z) >= 2 * R + 1e-4,
    );
  }

  private toggleView(): void {
    this.viewMode = this.viewMode === 'player' ? 'top' : 'player';
    this.cameraTween = { t: 0, fromPos: this.camera.position.clone(), fromTarget: this.controls.target.clone() };
  }

  // ---------- shooting ----------

  private shoot(): void {
    this.phase = 'striking';
    this.strikeT = 0;
    this.strikePower = this.power;
    this.shot = { firstHit: null, potted: [] };
    this.onTableBefore = new Set(this.balls.filter((b) => b.id !== 0 && b.onTable).map((b) => b.id));
    this.guide.group.visible = false;
  }

  private applyStrike(): void {
    const speed = Math.max(0.04, this.strikePower * MAX_SHOT_SPEED);
    strike(
      this.balls[0],
      new THREE.Vector3(this.aim.x, 0, this.aim.y),
      speed,
      this.spin.side * MAX_TIP_OFFSET,
      this.spin.height * MAX_TIP_OFFSET,
    );
    playCueHit(this.strikePower);
    this.power = 0;
    this.cue.group.visible = false;
    this.phase = 'rolling';
    this.accumulator = 0;
  }

  private handleEvents(events: PhysicsEvent[]): void {
    for (const ev of events) {
      if (ev.type === 'ball') {
        if (this.shot.firstHit === null && (ev.a === 0 || ev.b === 0)) this.shot.firstHit = ev.a === 0 ? ev.b : ev.a;
        playBallClick(ev.speed);
      } else if (ev.type === 'cushion') {
        playCushion(ev.speed);
      } else {
        this.shot.potted.push(ev.ball);
        playPocket();
      }
    }
  }

  private endShot(): void {
    const { state, action } = evaluateShot(this.state, this.shot, this.onTableBefore);
    this.state = state;
    this.hud.flash(state.message, action === 'gameover' ? 8000 : 4000);

    if (action === 'gameover') {
      this.phase = 'over';
      this.hud.showGameOver(state.message);
    } else if (action === 'rerack') {
      this.rack();
    } else if (state.ballInHand || this.balls[0].state === 'pocketed') {
      const cue = this.balls[0];
      if (cue.state === 'pocketed') {
        cue.place(HEAD_STRING_X - 0.03, 0);
        if (!this.cuePlacementValid()) this.findFreeSpot();
        this.views[0].reset();
      }
      this.phase = 'placing';
    } else {
      this.phase = 'aiming';
    }
    this.refreshHud();
  }

  private findFreeSpot(): void {
    const cue = this.balls[0];
    for (let x = -HALF_L + 2 * R; x < HALF_L - R; x += R) {
      for (let z = -HALF_W + 2 * R; z < HALF_W - R; z += R) {
        cue.place(x, z);
        if (this.cuePlacementValid()) return;
      }
    }
  }

  private refreshHud(): void {
    const onTable = new Set(this.balls.filter((b) => b.onTable).map((b) => b.id));
    this.hud.render(this.state, onTable);
  }

  // ---------- frame ----------

  update(dt: number): void {
    if (this.phase === 'striking') {
      this.strikeT += dt;
      if (this.strikeT >= STRIKE_TIME) this.applyStrike();
    }

    if (this.phase === 'rolling') {
      this.accumulator += dt;
      const events: PhysicsEvent[] = [];
      let steps = 0;
      while (this.accumulator >= PHYSICS_DT && steps < MAX_STEPS_PER_FRAME) {
        step(this.balls, PHYSICS_DT, events);
        this.accumulator -= PHYSICS_DT;
        steps++;
      }
      if (steps === MAX_STEPS_PER_FRAME) this.accumulator = 0;
      this.handleEvents(events);
      if (events.some((e) => e.type === 'pocket')) this.refreshHud();
      if (!anyMoving(this.balls)) this.endShot();
    }

    for (const v of this.views) v.sync(dt);

    const cuePos = this.balls[0].pos;
    const showCue = this.phase === 'aiming' || this.phase === 'striking';
    this.cue.group.visible = showCue;
    if (showCue) {
      const pullTarget = 0.008 + this.power * 0.09;
      const pull =
        this.phase === 'striking'
          ? THREE.MathUtils.lerp(0.008 + this.strikePower * 0.09, -0.003, Math.min(1, this.strikeT / STRIKE_TIME) ** 2)
          : pullTarget;
      this.cue.update(cuePos, this.aim.x, this.aim.y, pull, this.spin.side * MAX_TIP_OFFSET, this.spin.height * MAX_TIP_OFFSET);
    }

    this.guide.group.visible = this.phase === 'aiming';
    if (this.phase === 'aiming') {
      this.guide.update(cuePos.x, cuePos.z, predictAim(this.balls[0], this.balls, this.aim.x, this.aim.y));
    }
    this.headLine.visible = this.phase === 'placing' && this.state.kitchenOnly;
    this.hud.setPower(this.phase === 'striking' ? this.strikePower : this.power);

    if (this.cameraTween) {
      this.cameraTween.t = Math.min(1, this.cameraTween.t + dt / 0.6);
      const k = 1 - (1 - this.cameraTween.t) ** 3;
      const v = VIEWS[this.viewMode];
      this.camera.position.lerpVectors(this.cameraTween.fromPos, v.pos, k);
      this.controls.target.lerpVectors(this.cameraTween.fromTarget, v.target, k);
      if (this.cameraTween.t >= 1) this.cameraTween = null;
    }
    this.controls.update();
  }
}
