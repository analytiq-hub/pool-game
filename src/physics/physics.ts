import { Vector3 } from 'three';
import {
  BALL_MASS,
  CUSHION_CONTACT_HEIGHT,
  E_BALL,
  E_CUSHION,
  G,
  HALF_L,
  HALF_W,
  MU_BALL,
  MU_CUSHION,
  MU_ROLL,
  MU_SLIDE,
  MU_SPIN,
  R,
} from '../constants';
import { closestOnSegment, POCKETS, SEGMENTS } from './table';

// Ball physics in the style of tailuge/billiards: each ball has a linear velocity v and an
// angular velocity w. Cloth friction moves it from sliding to rolling. Ball-ball contacts
// include friction ("throw"). Cushion impacts use the Han (2005) model, as described by
// Mathavan et al. (2010). This code was written from those papers, not copied.

export type MotionState = 'stationary' | 'sliding' | 'rolling' | 'spinning' | 'pocketed';

export class Ball {
  readonly pos = new Vector3();
  readonly vel = new Vector3();
  readonly w = new Vector3();
  state: MotionState = 'stationary';
  pocket = -1;

  constructor(public readonly id: number) {}

  get onTable(): boolean {
    return this.state !== 'pocketed';
  }

  get moving(): boolean {
    return this.state !== 'stationary' && this.state !== 'pocketed';
  }

  place(x: number, z: number): void {
    this.pos.set(x, R, z);
    this.vel.set(0, 0, 0);
    this.w.set(0, 0, 0);
    this.state = 'stationary';
    this.pocket = -1;
  }
}

export type PhysicsEvent =
  | { type: 'ball'; a: number; b: number; speed: number }
  | { type: 'cushion'; ball: number; speed: number }
  | { type: 'pocket'; ball: number; pocket: number; speed: number };

const UP = new Vector3(0, 1, 0);
const I_OVER_M = (2 / 5) * R * R; // moment of inertia / mass
const SLIP_EPS = 1e-4;
const STOP_V = 2e-3;
const STOP_SPIN = 0.3;

const tmpU = new Vector3();
const tmpA = new Vector3();
const tmpB = new Vector3();
const tmpN = new Vector3();
const tmpT = new Vector3();

/** Velocity of the ball's contact point with the cloth: v + w × (−R·up). */
function contactVelocity(b: Ball, out: Vector3): Vector3 {
  // w × (0, −R, 0) = (R wz, 0, −R wx)
  return out.set(b.vel.x + R * b.w.z, 0, b.vel.z - R * b.w.x);
}

/** Apply cloth friction for a time step dt. */
export function updateMotion(b: Ball, dt: number): void {
  if (!b.moving) return;
  b.vel.y = 0;
  const u = contactVelocity(b, tmpU);
  const slip = u.length();

  if (slip > SLIP_EPS) {
    // Sliding: kinetic friction opposes slip. Slip decays at (7/2)·μs·g.
    const slipTime = slip / (3.5 * MU_SLIDE * G);
    const h = Math.min(dt, slipTime);
    u.divideScalar(slip);
    b.vel.addScaledVector(u, -MU_SLIDE * G * h);
    // dw = (5 μs g / 2R) (up × û) h
    tmpA.crossVectors(UP, u).multiplyScalar(((5 * MU_SLIDE * G) / (2 * R)) * h);
    b.w.add(tmpA);
    b.state = 'sliding';
    if (h < dt) rollingStep(b, dt - h);
  } else {
    rollingStep(b, dt);
  }

  // Spin about the vertical axis decays independently.
  const spinDecay = ((5 * MU_SPIN * G) / (2 * R)) * dt;
  if (Math.abs(b.w.y) <= spinDecay) b.w.y = 0;
  else b.w.y -= Math.sign(b.w.y) * spinDecay;

  const speed = Math.hypot(b.vel.x, b.vel.z);
  if (speed < STOP_V && contactVelocity(b, tmpU).length() < STOP_V) {
    b.vel.set(0, 0, 0);
    b.w.x = 0;
    b.w.z = 0;
    b.state = Math.abs(b.w.y) > STOP_SPIN ? 'spinning' : 'stationary';
    if (b.state === 'stationary') b.w.y = 0;
  }
}

function rollingStep(b: Ball, dt: number): void {
  const speed = Math.hypot(b.vel.x, b.vel.z);
  const dec = MU_ROLL * G * dt;
  if (speed <= dec) {
    b.vel.set(0, 0, 0);
  } else {
    b.vel.multiplyScalar((speed - dec) / speed);
  }
  // Rolling without slipping: wx = vz / R, wz = −vx / R.
  b.w.x = b.vel.z / R;
  b.w.z = -b.vel.x / R;
  b.state = speed > 0 ? 'rolling' : 'spinning';
}

/** Ball-ball collision with restitution and friction (throw). Returns the normal impact speed, or 0. */
export function collideBalls(a: Ball, b: Ball): number {
  tmpN.subVectors(b.pos, a.pos);
  tmpN.y = 0;
  const dist = tmpN.length();
  if (dist >= 2 * R || dist === 0) return 0;
  tmpN.divideScalar(dist);

  // Separate the overlapping pair.
  const push = (2 * R - dist) / 2;
  a.pos.addScaledVector(tmpN, -push);
  b.pos.addScaledVector(tmpN, push);

  const vn = tmpA.subVectors(a.vel, b.vel).dot(tmpN);
  if (vn <= 0) return 0;

  // Normal impulse per unit mass (equal masses).
  const J = ((1 + E_BALL) / 2) * vn;
  a.vel.addScaledVector(tmpN, -J);
  b.vel.addScaledVector(tmpN, J);

  // Tangential slip at the contact point: (va + wa × Rn) − (vb + wb × (−Rn)).
  const ca = tmpA.crossVectors(a.w, tmpN).multiplyScalar(R).add(a.vel);
  const cb = tmpB.crossVectors(b.w, tmpN).multiplyScalar(-R).add(b.vel);
  const slipV = ca.sub(cb);
  slipV.addScaledVector(tmpN, -slipV.dot(tmpN));
  slipV.y = 0;
  const slip = slipV.length();
  if (slip > 1e-6) {
    // Each unit of tangential impulse reduces the slip by 7 (1 + 5/2 for each of the two balls).
    const jt = Math.min(MU_BALL * J, slip / 7);
    const dir = slipV.divideScalar(slip);
    a.vel.addScaledVector(dir, -jt);
    b.vel.addScaledVector(dir, jt);
    // Δw = (5 / 2R) n × Jt for both balls.
    tmpT.crossVectors(tmpN, dir).multiplyScalar((-5 / (2 * R)) * jt);
    a.w.add(tmpT);
    b.w.add(tmpT);
  }

  a.vel.y = 0;
  b.vel.y = 0;
  a.state = 'sliding';
  b.state = 'sliding';
  return vn;
}

const SIN_T = (CUSHION_CONTACT_HEIGHT - R) / R;
const COS_T = Math.sqrt(1 - SIN_T * SIN_T);

/**
 * Han (2005) cushion impulse. n is the unit horizontal normal pointing from the ball into the cushion.
 * Works in a local frame: x = n (into the cushion), y = t (along the cushion), z = up.
 */
export function hanBounce(b: Ball, n: Vector3): number {
  const t = tmpT.crossVectors(UP, n); // n × t = up
  const vx = b.vel.dot(n);
  if (vx <= 0) return 0;
  const vy = b.vel.dot(t);
  const wx = b.w.dot(n);
  const wy = b.w.dot(t);
  const wz = b.w.y;
  const m = BALL_MASS;
  const e = E_CUSHION;
  const mu = MU_CUSHION;
  const s = SIN_T;
  const c0 = COS_T;

  const sx = vx * s + R * wy;
  const sy = -vy - R * wz * c0 + R * wx * s;
  const c = vx * c0;
  const A = 7 / (2 * m);
  const B = 1 / m;
  const PzE = ((1 + e) * c) / B;
  const PzS = Math.hypot(sx, sy) / A;

  let PX: number;
  let PY: number;
  let PZ: number;
  if (PzS <= PzE) {
    PX = (-sx / A) * s - PzE * c0;
    PY = sy / A;
    PZ = (sx / A) * c0 - PzE * s;
  } else {
    const phi = Math.atan2(sy, sx);
    PX = -mu * PzE * Math.cos(phi) * s - PzE * c0;
    PY = mu * PzE * Math.sin(phi);
    PZ = mu * PzE * Math.cos(phi) * c0 - PzE * s;
  }

  const I = I_OVER_M * m;
  const nvx = vx + PX / m;
  const nvy = vy + PY / m;
  const nwx = wx - (R / I) * PY * s;
  const nwy = wy + (R / I) * (PX * s - PZ * c0);
  const nwz = wz + (R / I) * PY * c0;

  const nx = n.x;
  const nz = n.z;
  const tx = t.x;
  const tz = t.z;
  b.vel.set(nvx * nx + nvy * tx, 0, nvx * nz + nvy * tz);
  b.w.set(nwx * nx + nwy * tx, nwz, nwx * nz + nwy * tz);
  b.state = 'sliding';
  return vx;
}

const NEAR_X = HALF_L - 1.5 * R;
const NEAR_Z = HALF_W - 1.5 * R;

/** Resolve cushion contacts for one ball. Returns the impact speed, or 0. */
export function collideCushions(b: Ball): number {
  if (Math.abs(b.pos.x) < NEAR_X && Math.abs(b.pos.z) < NEAR_Z) return 0;
  let impact = 0;
  for (const seg of SEGMENTS) {
    const cp = closestOnSegment(b.pos.x, b.pos.z, seg);
    const dx = cp.x - b.pos.x;
    const dz = cp.z - b.pos.z;
    const d2 = dx * dx + dz * dz;
    if (d2 >= R * R || d2 === 0) continue;
    const d = Math.sqrt(d2);
    tmpN.set(dx / d, 0, dz / d);
    // Push the ball back out to touching distance.
    b.pos.addScaledVector(tmpN, -(R - d));
    impact = Math.max(impact, hanBounce(b, tmpN));
  }
  return impact;
}

/** Returns the index of the pocket the ball falls into, or −1. */
export function checkPocket(b: Ball): number {
  for (let i = 0; i < POCKETS.length; i++) {
    const p = POCKETS[i];
    const dx = b.pos.x - p.x;
    const dz = b.pos.z - p.z;
    if (dx * dx + dz * dz < p.r * p.r) return i;
  }
  // Safety net: a ball whose centre is well past a nose line can only be in a pocket mouth.
  if (Math.abs(b.pos.x) > HALF_L + R || Math.abs(b.pos.z) > HALF_W + R) {
    let best = 0;
    let bestD = Infinity;
    POCKETS.forEach((p, i) => {
      const d = Math.hypot(b.pos.x - p.x, b.pos.z - p.z);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best;
  }
  return -1;
}

/** Advance the whole table by one time step, appending events. */
export function step(balls: Ball[], dt: number, events: PhysicsEvent[]): void {
  for (const b of balls) {
    if (!b.moving) continue;
    updateMotion(b, dt);
    b.pos.x += b.vel.x * dt;
    b.pos.z += b.vel.z * dt;
  }

  for (let i = 0; i < balls.length; i++) {
    const a = balls[i];
    if (!a.onTable) continue;
    for (let j = i + 1; j < balls.length; j++) {
      const b = balls[j];
      if (!b.onTable || (!a.moving && !b.moving)) continue;
      const dx = b.pos.x - a.pos.x;
      const dz = b.pos.z - a.pos.z;
      if (dx * dx + dz * dz >= 4 * R * R) continue;
      const speed = collideBalls(a, b);
      if (speed > 0) events.push({ type: 'ball', a: a.id, b: b.id, speed });
    }
  }

  for (const b of balls) {
    if (!b.moving) continue;
    const speed = collideCushions(b);
    if (speed > 0) events.push({ type: 'cushion', ball: b.id, speed });
    const p = checkPocket(b);
    if (p >= 0) {
      const speed = Math.hypot(b.vel.x, b.vel.z);
      b.state = 'pocketed';
      b.pocket = p;
      b.vel.set(0, 0, 0);
      b.w.set(0, 0, 0);
      events.push({ type: 'pocket', ball: b.id, pocket: p, speed });
    }
  }
}

export function anyMoving(balls: Ball[]): boolean {
  return balls.some((b) => b.moving);
}

/**
 * Cue strike. dir is the horizontal aim direction. side and height are tip offsets as a
 * fraction of R (positive side = right english, positive height = follow).
 */
export function strike(b: Ball, dir: Vector3, speed: number, side: number, height: number): void {
  const d = tmpA.set(dir.x, 0, dir.z).normalize();
  b.vel.copy(d).multiplyScalar(speed);
  // w = (5V / 2R) (height · (up × d) + side · up)
  const k = (5 * speed) / (2 * R);
  tmpB.crossVectors(UP, d).multiplyScalar(height * k);
  b.w.copy(tmpB);
  b.w.y = side * k;
  b.state = 'sliding';
}
