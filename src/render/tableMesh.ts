import * as THREE from 'three';
import {
  BODY_BOTTOM,
  CORNER_MOUTH,
  CORNER_POCKET_OFFSET,
  CORNER_POCKET_R,
  CUSHION_DEPTH,
  CUSHION_HEIGHT,
  HALF_L,
  HALF_W,
  OUTER_X,
  OUTER_Z,
  POCKET_DEPTH,
  RAIL_TOP,
  SIDE_POCKET_OFFSET,
  SIDE_POCKET_R,
} from '../constants';
import { CUSHIONS, POCKETS, type P2 } from '../physics/table';
import { COLORS, feltTexture, woodTexture } from './textures';

// The tabletop toy table: emerald felt bed and soft cushions, a grey woodgrain rail strip,
// a dark wood box, black plastic corner caps and side brackets, and big round pockets.

const D = CUSHION_DEPTH;
const CAP_TOP = RAIL_TOP + 0.003;
const CAP_OVERHANG = 0.002;
const CORNER_ARM = CORNER_MOUTH + 0.012;
const SIDE_CAP_HALF = 0.032;
const WALL = 0.012;

/** A Shape in the table plane. Shape y = −z, so rotateX(−π/2) maps it back to world (x, z). */
function shapeOf(points: P2[]): THREE.Shape {
  const s = new THREE.Shape();
  points.forEach((p, i) => (i === 0 ? s.moveTo(p.x, -p.z) : s.lineTo(p.x, -p.z)));
  s.closePath();
  return s;
}

/** Extrude a table-plane shape upward from y0 by height. */
function extrudeUp(shape: THREE.Shape, y0: number, height: number, bevel = 0): THREE.BufferGeometry {
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: height - 2 * bevel,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 4,
    curveSegments: 40,
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, y0 + bevel, 0);
  geo.computeVertexNormals();
  return geo;
}

/** Shrink a convex polygon by s on every edge. */
function insetPolygon(pts: P2[], s: number): P2[] {
  const n = pts.length;
  const cx = pts.reduce((a, p) => a + p.x, 0) / n;
  const cz = pts.reduce((a, p) => a + p.z, 0) / n;
  const lines = pts.map((p, i) => {
    const q = pts[(i + 1) % n];
    let nx = -(q.z - p.z);
    let nz = q.x - p.x;
    const l = Math.hypot(nx, nz);
    nx /= l;
    nz /= l;
    // Point the normal inward.
    if ((cx - p.x) * nx + (cz - p.z) * nz < 0) {
      nx = -nx;
      nz = -nz;
    }
    return { px: p.x + nx * s, pz: p.z + nz * s, dx: q.x - p.x, dz: q.z - p.z };
  });
  return lines.map((l, i) => {
    const m = lines[(i - 1 + n) % n];
    // Intersect line m (previous edge) with line l.
    const den = m.dx * l.dz - m.dz * l.dx;
    const t = ((l.px - m.px) * l.dz - (l.pz - m.pz) * l.dx) / den;
    return { x: m.px + m.dx * t, z: m.pz + m.dz * t };
  });
}

function arc(cx: number, cz: number, r: number, from: number, to: number, steps = 40): P2[] {
  const pts: P2[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = from + ((to - from) * i) / steps;
    pts.push({ x: cx + r * Math.cos(a), z: cz + r * Math.sin(a) });
  }
  return pts;
}

/** L-shaped black corner cap for the (+x, +z) corner, with the pocket bitten out. */
function cornerCapOutline(): P2[] {
  const e = CAP_OVERHANG;
  const cx = HALF_L + CORNER_POCKET_OFFSET;
  const cz = HALF_W + CORNER_POCKET_OFFSET;
  const r = CORNER_POCKET_R;
  const xa = HALF_L + D;
  const za = cz - Math.sqrt(r * r - (xa - cx) ** 2);
  const zb = HALF_W + D;
  const xb = cx - Math.sqrt(r * r - (zb - cz) ** 2);
  const from = Math.atan2(za - cz, xa - cx);
  const to = Math.atan2(zb - cz, xb - cx);
  return [
    { x: HALF_L - CORNER_ARM, z: HALF_W + D },
    { x: HALF_L - CORNER_ARM, z: OUTER_Z + e },
    { x: OUTER_X + e, z: OUTER_Z + e },
    { x: OUTER_X + e, z: HALF_W - CORNER_ARM },
    { x: HALF_L + D, z: HALF_W - CORNER_ARM },
    ...arc(cx, cz, r, from, to),
  ];
}

/** Black side-pocket bracket for the +z rail. */
function sideCapOutline(): P2[] {
  const e = CAP_OVERHANG;
  const cz = HALF_W + SIDE_POCKET_OFFSET;
  const r = SIDE_POCKET_R;
  const z0 = HALF_W + D;
  const xi = Math.sqrt(r * r - (z0 - cz) ** 2);
  const from = Math.atan2(z0 - cz, -xi);
  const to = Math.atan2(z0 - cz, xi);
  return [
    { x: -SIDE_CAP_HALF, z: z0 },
    ...arc(0, cz, r, from, to),
    { x: SIDE_CAP_HALF, z: z0 },
    { x: SIDE_CAP_HALF, z: OUTER_Z + e },
    { x: -SIDE_CAP_HALF, z: OUTER_Z + e },
  ];
}

/** A box whose long axis is x, with the grain running along it. */
function railBox(len: number, depth: number, height: number, mat: THREE.Material): THREE.Mesh {
  const geo = new THREE.BoxGeometry(len, height, depth);
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function buildTable(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'table';

  const felt = feltTexture();
  felt.repeat.set(12, 12);
  const feltMat = new THREE.MeshPhysicalMaterial({
    map: felt,
    roughness: 0.95,
    sheen: 0.25,
    sheenRoughness: 0.9,
    sheenColor: new THREE.Color('#2fa877'),
  });
  const cushionMat = feltMat.clone();
  cushionMat.color = new THREE.Color('#d2dcd6');

  const railTex = woodTexture(COLORS.railWood, COLORS.railGrain, 3);
  const railMat = new THREE.MeshStandardMaterial({ map: railTex, roughness: 0.55 });
  const bodyTex = woodTexture(COLORS.bodyWood, COLORS.bodyGrain, 11);
  bodyTex.repeat.set(1, 0.5);
  const bodyMat = new THREE.MeshStandardMaterial({ map: bodyTex, roughness: 0.6 });
  const plasticMat = new THREE.MeshPhysicalMaterial({
    color: COLORS.plastic,
    roughness: 0.42,
    clearcoat: 0.4,
    clearcoatRoughness: 0.3,
  });
  const pocketMat = new THREE.MeshStandardMaterial({ color: '#050505', roughness: 0.9, side: THREE.DoubleSide });

  // Felt bed with pocket holes.
  const bedShape = shapeOf([
    { x: -OUTER_X, z: -OUTER_Z },
    { x: OUTER_X, z: -OUTER_Z },
    { x: OUTER_X, z: OUTER_Z },
    { x: -OUTER_X, z: OUTER_Z },
  ]);
  for (const p of POCKETS) {
    const hole = new THREE.Path();
    hole.absarc(p.x, -p.z, p.r, 0, Math.PI * 2, true);
    bedShape.holes.push(hole);
  }
  const bedGeo = new THREE.ShapeGeometry(bedShape, 48);
  bedGeo.rotateX(-Math.PI / 2);
  const bed = new THREE.Mesh(bedGeo, feltMat);
  bed.receiveShadow = true;
  group.add(bed);

  // Pocket cups.
  for (const p of POCKETS) {
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(p.r, p.r * 0.92, POCKET_DEPTH, 40, 1, true), pocketMat);
    cup.position.set(p.x, -POCKET_DEPTH / 2, p.z);
    group.add(cup);
    const bottom = new THREE.Mesh(new THREE.CircleGeometry(p.r * 0.92, 40), pocketMat);
    bottom.rotation.x = -Math.PI / 2;
    bottom.position.set(p.x, -POCKET_DEPTH, p.z);
    group.add(bottom);
  }

  // Felt-covered cushions with rounded noses.
  const bevel = 0.0045;
  for (const poly of CUSHIONS) {
    const geo = extrudeUp(shapeOf(insetPolygon(poly, bevel)), 0, CUSHION_HEIGHT, bevel);
    const m = new THREE.Mesh(geo, cushionMat);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
  }

  // Grey woodgrain rail strips.
  const railDepth = OUTER_Z - (HALF_W + D);
  const longLen = HALF_L - CORNER_ARM - SIDE_CAP_HALF;
  for (const sz of [-1, 1]) {
    for (const sx of [-1, 1]) {
      const rail = railBox(longLen, railDepth, RAIL_TOP, railMat);
      rail.position.set(sx * (SIDE_CAP_HALF + longLen / 2), RAIL_TOP / 2, sz * (HALF_W + D + railDepth / 2));
      group.add(rail);
    }
  }
  const shortLen = 2 * (HALF_W - CORNER_ARM);
  const shortDepth = OUTER_X - (HALF_L + D);
  for (const sx of [-1, 1]) {
    const rail = railBox(shortLen, shortDepth, RAIL_TOP, railMat);
    rail.rotation.y = Math.PI / 2;
    rail.position.set(sx * (HALF_L + D + shortDepth / 2), RAIL_TOP / 2, 0);
    group.add(rail);
  }

  // Dark wood box.
  const bodyH = -BODY_BOTTOM;
  for (const sz of [-1, 1]) {
    const wall = railBox(2 * OUTER_X, WALL, bodyH, bodyMat);
    wall.position.set(0, BODY_BOTTOM / 2, sz * (OUTER_Z - WALL / 2));
    group.add(wall);
  }
  for (const sx of [-1, 1]) {
    const wall = railBox(2 * OUTER_Z - 2 * WALL, WALL, bodyH, bodyMat);
    wall.rotation.y = Math.PI / 2;
    wall.position.set(sx * (OUTER_X - WALL / 2), BODY_BOTTOM / 2, 0);
    group.add(wall);
  }
  const bottom = railBox(2 * OUTER_X, 2 * OUTER_Z, 0.006, bodyMat);
  bottom.position.y = BODY_BOTTOM + 0.003;
  group.add(bottom);

  // Black plastic corner caps (mirrored for each corner) and the plates that wrap down the sides.
  const cornerGeo = extrudeUp(shapeOf(cornerCapOutline()), 0, CAP_TOP, 0.0008);
  const plateH = bodyH - 0.008;
  const plateW = 0.042;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const cap = new THREE.Mesh(cornerGeo, plasticMat);
      cap.scale.set(sx, 1, sz);
      cap.castShadow = true;
      cap.receiveShadow = true;
      group.add(cap);

      const px = new THREE.Mesh(new THREE.BoxGeometry(CAP_OVERHANG, plateH, plateW), plasticMat);
      px.position.set(sx * (OUTER_X + CAP_OVERHANG / 2), -plateH / 2, sz * (OUTER_Z + CAP_OVERHANG - plateW / 2));
      group.add(px);
      const pz = new THREE.Mesh(new THREE.BoxGeometry(plateW, plateH, CAP_OVERHANG), plasticMat);
      pz.position.set(sx * (OUTER_X + CAP_OVERHANG - plateW / 2), -plateH / 2, sz * (OUTER_Z + CAP_OVERHANG / 2));
      group.add(pz);
    }
  }

  const sideGeo = extrudeUp(shapeOf(sideCapOutline()), 0, CAP_TOP, 0.0008);
  for (const sz of [-1, 1]) {
    const cap = new THREE.Mesh(sideGeo, plasticMat);
    cap.scale.set(1, 1, sz);
    cap.castShadow = true;
    cap.receiveShadow = true;
    group.add(cap);
    const plate = new THREE.Mesh(new THREE.BoxGeometry(2 * SIDE_CAP_HALF, 0.012, CAP_OVERHANG), plasticMat);
    plate.position.set(0, -0.006, sz * (OUTER_Z + CAP_OVERHANG / 2));
    group.add(plate);
  }

  return group;
}
