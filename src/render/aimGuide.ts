import * as THREE from 'three';
import { R } from '../constants';
import type { AimPrediction } from '../physics/aim';

const Y = 0.0006;

/** Dashed aim line, ghost ball ring, and the predicted paths after contact. */
export class AimGuide {
  readonly group = new THREE.Group();
  private readonly main: THREE.Line;
  private readonly obj: THREE.Line;
  private readonly cue: THREE.Line;
  private readonly ghost: THREE.Mesh;

  constructor() {
    const mk = (color: string, opacity: number, dashed: boolean) => {
      const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
      const mat = dashed
        ? new THREE.LineDashedMaterial({ color, dashSize: 0.006, gapSize: 0.004, transparent: true, opacity })
        : new THREE.LineBasicMaterial({ color, transparent: true, opacity });
      return new THREE.Line(geo, mat);
    };
    this.main = mk('#ffffff', 0.85, true);
    this.obj = mk('#fff2a8', 0.9, false);
    this.cue = mk('#ffffff', 0.45, true);
    this.ghost = new THREE.Mesh(
      new THREE.RingGeometry(R * 0.92, R, 40),
      new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.7, side: THREE.DoubleSide }),
    );
    this.ghost.rotation.x = -Math.PI / 2;
    this.group.add(this.main, this.obj, this.cue, this.ghost);
    this.group.visible = false;
  }

  private setLine(line: THREE.Line, x0: number, z0: number, x1: number, z1: number): void {
    const pos = line.geometry.getAttribute('position') as THREE.BufferAttribute;
    pos.setXYZ(0, x0, Y, z0);
    pos.setXYZ(1, x1, Y, z1);
    pos.needsUpdate = true;
    line.geometry.computeBoundingSphere();
    if (line.material instanceof THREE.LineDashedMaterial) line.computeLineDistances();
  }

  update(fromX: number, fromZ: number, p: AimPrediction): void {
    this.setLine(this.main, fromX, fromZ, p.ghostX, p.ghostZ);
    this.ghost.position.set(p.ghostX, Y, p.ghostZ);
    const hit = p.hitBall !== null;
    this.obj.visible = hit;
    this.cue.visible = hit && (p.cueDirX !== 0 || p.cueDirZ !== 0);
    if (hit) {
      const ox = p.ghostX + p.objDirX * 2 * R;
      const oz = p.ghostZ + p.objDirZ * 2 * R;
      this.setLine(this.obj, ox, oz, ox + p.objDirX * 0.09, oz + p.objDirZ * 0.09);
      this.setLine(this.cue, p.ghostX, p.ghostZ, p.ghostX + p.cueDirX * 0.06, p.ghostZ + p.cueDirZ * 0.06);
    }
  }
}
