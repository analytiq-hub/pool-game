import * as THREE from 'three';
import { POCKET_DEPTH, R } from '../constants';
import type { Ball } from '../physics/physics';
import { POCKETS } from '../physics/table';
import { ballTexture } from './textures';

const DROP_TIME = 0.35;
const tmpAxis = new THREE.Vector3();
const tmpQ = new THREE.Quaternion();

/** Mesh for one ball. It follows the physics state and animates the drop into a pocket. */
export class BallView {
  readonly mesh: THREE.Mesh;
  private dropT = -1;
  private dropFrom = new THREE.Vector3();

  constructor(readonly ball: Ball, geometry: THREE.SphereGeometry) {
    const mat = new THREE.MeshPhysicalMaterial({
      map: ballTexture(ball.id),
      roughness: ball.id === 0 ? 0.32 : 0.16,
      clearcoat: 1,
      clearcoatRoughness: ball.id === 0 ? 0.25 : 0.06,
    });
    this.mesh = new THREE.Mesh(geometry, mat);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.randomizeOrientation();
  }

  randomizeOrientation(): void {
    // Turn the number towards the top so it can be read, with a random twist.
    const e = new THREE.Euler(-Math.PI / 2 + (Math.random() - 0.5) * 0.9, Math.random() * Math.PI * 2, 0, 'YXZ');
    this.mesh.quaternion.setFromEuler(e);
  }

  reset(): void {
    this.dropT = -1;
    this.mesh.visible = true;
    this.mesh.scale.setScalar(1);
    this.randomizeOrientation();
    this.sync(0);
  }

  /** Update the mesh from physics. dt is the frame time, used to integrate rotation. */
  sync(dt: number): void {
    const b = this.ball;
    if (b.state === 'pocketed') {
      this.animateDrop(dt);
      return;
    }
    this.dropT = -1;
    this.mesh.visible = true;
    this.mesh.position.copy(b.pos);
    const wl = b.w.length();
    if (wl > 1e-6 && dt > 0) {
      tmpAxis.copy(b.w).divideScalar(wl);
      tmpQ.setFromAxisAngle(tmpAxis, wl * dt);
      this.mesh.quaternion.premultiply(tmpQ);
    }
  }

  private animateDrop(dt: number): void {
    if (this.dropT < 0) {
      this.dropT = 0;
      this.dropFrom.copy(this.mesh.position);
    }
    if (this.dropT >= 1) {
      this.mesh.visible = false;
      return;
    }
    this.dropT = Math.min(1, this.dropT + dt / DROP_TIME);
    const p = POCKETS[this.ball.pocket];
    const t = this.dropT;
    const ease = t * t;
    this.mesh.position.set(
      THREE.MathUtils.lerp(this.dropFrom.x, p.x, Math.min(1, t * 1.6)),
      THREE.MathUtils.lerp(this.dropFrom.y, -POCKET_DEPTH + R, ease),
      THREE.MathUtils.lerp(this.dropFrom.z, p.z, Math.min(1, t * 1.6)),
    );
  }
}

export function ballGeometry(): THREE.SphereGeometry {
  return new THREE.SphereGeometry(R, 48, 32);
}
