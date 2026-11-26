import * as THREE from 'three';
import { R } from '../constants';

// The toy cue from the photos: blue tip, white ferrule, light shaft, dark butt.

const ELEVATION = THREE.MathUtils.degToRad(6);

export class CueView {
  readonly group = new THREE.Group();
  private readonly stick = new THREE.Group();

  constructor() {
    // Built along −Z from the tip at the origin, so lookAt() aims the tip at the ball.
    const parts: [number, number, number, string, number][] = [
      // length, radius at tip end, radius at butt end, colour, roughness
      [0.006, 0.0045, 0.0045, '#2f6fb3', 0.9],
      [0.014, 0.0046, 0.0047, '#f4f2ea', 0.35],
      [0.46, 0.0047, 0.0068, '#efe5cf', 0.4],
      [0.02, 0.0068, 0.0071, '#1b1b1b', 0.35],
      [0.24, 0.0071, 0.0085, '#262626', 0.5],
      [0.04, 0.0085, 0.0086, '#111111', 0.6],
    ];
    let z = 0;
    for (const [len, r0, r1, color, rough] of parts) {
      const geo = new THREE.CylinderGeometry(r0, r1, len, 24);
      geo.rotateX(Math.PI / 2); // cylinder axis along Z, top (r0) toward +Z
      const m = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ color, roughness: rough, clearcoat: 0.3 }));
      m.position.z = -(z + len / 2);
      m.castShadow = true;
      this.stick.add(m);
      z += len;
    }
    this.group.add(this.stick);
    this.group.visible = false;
  }

  /** Place the cue behind the ball, pulled back by `pull` metres, with a tip offset. */
  update(ball: THREE.Vector3, dirX: number, dirZ: number, pull: number, side: number, height: number): void {
    const len = Math.hypot(dirX, dirZ) || 1;
    const dx = dirX / len;
    const dz = dirZ / len;
    // Right-hand side of the aim direction, viewed from above.
    const rx = -dz;
    const rz = dx;
    const back = R + 0.004 + pull;
    const cosE = Math.cos(ELEVATION);
    const sinE = Math.sin(ELEVATION);
    const tip = new THREE.Vector3(
      ball.x - dx * back * cosE + rx * side * R,
      ball.y + back * sinE + height * R,
      ball.z - dz * back * cosE + rz * side * R,
    );
    this.group.position.copy(tip);
    this.group.lookAt(tip.x + dx * cosE, tip.y - sinE, tip.z + dz * cosE);
  }
}
