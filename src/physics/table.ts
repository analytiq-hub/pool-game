import {
  CORNER_MOUTH,
  CORNER_POCKET_OFFSET,
  CORNER_POCKET_R,
  CUSHION_DEPTH,
  HALF_L,
  HALF_W,
  SIDE_MOUTH,
  SIDE_POCKET_OFFSET,
  SIDE_POCKET_R,
} from '../constants';

/** A 2D point on the table plane: x along the length, z across the width. */
export interface P2 {
  x: number;
  z: number;
}

export interface Segment {
  a: P2;
  b: P2;
}

export interface Pocket {
  x: number;
  z: number;
  r: number;
  kind: 'corner' | 'side';
}

/**
 * A cushion's footprint as a convex quad, listed as
 * [nose start, nose end, back end, back start].
 * The nose edge is where balls normally strike. The two short edges are the pocket jaws.
 */
export type CushionPoly = [P2, P2, P2, P2];

const D = CUSHION_DEPTH;
/** How far the corner jaw's back point moves toward the pocket (a slightly forgiving cut). */
const CORNER_JAW_BACK = 0.4 * D;
const SIDE_JAW_BACK = 0.001;

function buildCushions(): CushionPoly[] {
  const polys: CushionPoly[] = [];
  // Long rails at z = ±HALF_W, two cushions each (split by the side pocket).
  for (const sz of [-1, 1]) {
    const zn = sz * HALF_W;
    const zb = sz * (HALF_W + D);
    for (const sx of [-1, 1]) {
      const cornerEnd = sx * (HALF_L - CORNER_MOUTH);
      const sideEnd = sx * SIDE_MOUTH;
      polys.push([
        { x: cornerEnd, z: zn },
        { x: sideEnd, z: zn },
        { x: sx * (SIDE_MOUTH - SIDE_JAW_BACK), z: zb },
        { x: sx * (HALF_L - CORNER_MOUTH + CORNER_JAW_BACK), z: zb },
      ]);
    }
  }
  // Short rails at x = ±HALF_L.
  for (const sx of [-1, 1]) {
    const xn = sx * HALF_L;
    const xb = sx * (HALF_L + D);
    polys.push([
      { x: xn, z: -(HALF_W - CORNER_MOUTH) },
      { x: xn, z: HALF_W - CORNER_MOUTH },
      { x: xb, z: HALF_W - CORNER_MOUTH + CORNER_JAW_BACK },
      { x: xb, z: -(HALF_W - CORNER_MOUTH + CORNER_JAW_BACK) },
    ]);
  }
  return polys;
}

function buildPockets(): Pocket[] {
  const pockets: Pocket[] = [];
  const o = CORNER_POCKET_OFFSET;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      pockets.push({ x: sx * (HALF_L + o), z: sz * (HALF_W + o), r: CORNER_POCKET_R, kind: 'corner' });
    }
  }
  for (const sz of [-1, 1]) {
    pockets.push({ x: 0, z: sz * (HALF_W + SIDE_POCKET_OFFSET), r: SIDE_POCKET_R, kind: 'side' });
  }
  return pockets;
}

export const CUSHIONS: CushionPoly[] = buildCushions();
export const POCKETS: Pocket[] = buildPockets();

/** The edges a ball can hit: jaw, nose, jaw of every cushion. */
export const SEGMENTS: Segment[] = CUSHIONS.flatMap(([ns, ne, be, bs]) => [
  { a: bs, b: ns },
  { a: ns, b: ne },
  { a: ne, b: be },
]);

/** Closest point on segment ab to p. */
export function closestOnSegment(px: number, pz: number, s: Segment): P2 {
  const abx = s.b.x - s.a.x;
  const abz = s.b.z - s.a.z;
  const len2 = abx * abx + abz * abz;
  let t = len2 > 0 ? ((px - s.a.x) * abx + (pz - s.a.z) * abz) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  return { x: s.a.x + abx * t, z: s.a.z + abz * t };
}
