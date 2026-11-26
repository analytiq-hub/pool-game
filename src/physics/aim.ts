import { R } from '../constants';
import type { Ball } from './physics';
import { closestOnSegment, SEGMENTS } from './table';

export interface AimPrediction {
  /** Where the cue ball centre is at first contact. */
  ghostX: number;
  ghostZ: number;
  /** Id of the object ball that would be hit, or null for a cushion or nothing. */
  hitBall: number | null;
  /** Object ball direction (unit) after a ball hit. */
  objDirX: number;
  objDirZ: number;
  /** Cue ball tangent direction (unit) after a ball hit (stun-shot approximation). */
  cueDirX: number;
  cueDirZ: number;
}

const MAX_DIST = 1.2;

/** Distance along the ray (ox,oz)+s(dx,dz) to the first cushion contact, by marching. */
function cushionDistance(ox: number, oz: number, dx: number, dz: number, limit: number): number {
  const stepLen = R / 8;
  for (let s = 0; s < limit; s += stepLen) {
    const px = ox + dx * s;
    const pz = oz + dz * s;
    for (const seg of SEGMENTS) {
      const cp = closestOnSegment(px, pz, seg);
      if ((cp.x - px) ** 2 + (cp.z - pz) ** 2 < R * R) return s;
    }
  }
  return limit;
}

export function predictAim(cue: Ball, balls: Ball[], dirX: number, dirZ: number): AimPrediction {
  const len = Math.hypot(dirX, dirZ) || 1;
  const dx = dirX / len;
  const dz = dirZ / len;
  const ox = cue.pos.x;
  const oz = cue.pos.z;

  let best = MAX_DIST;
  let hit: Ball | null = null;
  for (const b of balls) {
    if (b === cue || !b.onTable) continue;
    // Solve |o + s d − q| = 2R.
    const qx = b.pos.x - ox;
    const qz = b.pos.z - oz;
    const proj = qx * dx + qz * dz;
    if (proj <= 0) continue;
    const perp2 = qx * qx + qz * qz - proj * proj;
    const rr = 4 * R * R;
    if (perp2 > rr) continue;
    const s = proj - Math.sqrt(rr - perp2);
    if (s >= 0 && s < best) {
      best = s;
      hit = b;
    }
  }

  const cushion = cushionDistance(ox, oz, dx, dz, best);
  if (cushion < best) {
    best = cushion;
    hit = null;
  }

  const gx = ox + dx * best;
  const gz = oz + dz * best;
  const pred: AimPrediction = {
    ghostX: gx,
    ghostZ: gz,
    hitBall: hit ? hit.id : null,
    objDirX: 0,
    objDirZ: 0,
    cueDirX: 0,
    cueDirZ: 0,
  };
  if (hit) {
    let nx = hit.pos.x - gx;
    let nz = hit.pos.z - gz;
    const nl = Math.hypot(nx, nz) || 1;
    nx /= nl;
    nz /= nl;
    pred.objDirX = nx;
    pred.objDirZ = nz;
    // Tangent line: the aim direction minus its normal component.
    let tx = dx - nx * (dx * nx + dz * nz);
    let tz = dz - nz * (dx * nx + dz * nz);
    const tl = Math.hypot(tx, tz);
    if (tl > 1e-6) {
      tx /= tl;
      tz /= tl;
      pred.cueDirX = tx;
      pred.cueDirZ = tz;
    }
  }
  return pred;
}
