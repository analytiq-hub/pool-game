import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { BODY_BOTTOM, OUTER_X, R } from '../constants';
import { clothTexture, floorTexture } from './textures';

// The room from the photos: pale wood floor, and the toy table sitting on a sage-cloth stand.

const STAND_HEIGHT = 0.7;
export const FLOOR_Y = BODY_BOTTOM - STAND_HEIGHT;

export function setupRenderer(container: HTMLElement): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.85;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);
  return renderer;
}

export function buildRoom(renderer: THREE.WebGLRenderer, scene: THREE.Scene): void {
  scene.background = new THREE.Color('#efe3dc');
  scene.fog = new THREE.Fog('#efe3dc', 2.5, 7);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.35;

  // Bright, soft daylight.
  scene.add(new THREE.HemisphereLight('#fff6ee', '#c9b3a6', 0.55));
  const sun = new THREE.DirectionalLight('#fff3e6', 1.9);
  sun.position.set(-0.6, 1.6, 0.9);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -0.6;
  sun.shadow.camera.right = 0.6;
  sun.shadow.camera.top = 0.6;
  sun.shadow.camera.bottom = -0.6;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 3;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.002;
  sun.shadow.radius = 4;
  scene.add(sun);
  const fill = new THREE.PointLight('#ffffff', 0.6, 2.5);
  fill.position.set(0.3, 0.7, -0.4);
  scene.add(fill);

  // Floor
  const floorTex = floorTexture();
  floorTex.repeat.set(5, 5);
  floorTex.rotation = Math.PI / 5;
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(12, 12),
    new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.45 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = FLOOR_Y;
  floor.receiveShadow = true;
  scene.add(floor);

  // Sage-cloth stand
  const clothTex = clothTexture();
  clothTex.repeat.set(4, 4);
  const clothMat = new THREE.MeshStandardMaterial({ map: clothTex, roughness: 0.95 });
  const standW = 2 * OUTER_X + 0.42;
  const standD = 0.62;
  const stand = new THREE.Mesh(new THREE.BoxGeometry(standW, STAND_HEIGHT, standD), clothMat);
  stand.position.set(0.1, BODY_BOTTOM - STAND_HEIGHT / 2, 0);
  stand.receiveShadow = true;
  stand.castShadow = true;
  scene.add(stand);
  // A soft skirt hem so the cloth reads as draped fabric.
  const hem = new THREE.Mesh(new THREE.BoxGeometry(standW + 0.02, 0.02, standD + 0.02), clothMat);
  hem.position.set(0.1, BODY_BOTTOM - 0.012, 0);
  hem.receiveShadow = true;
  scene.add(hem);

  // Props from the photos: the black plastic triangle and a blue chalk cube.
  const rack = buildRack();
  rack.position.set(OUTER_X + 0.14, BODY_BOTTOM, -0.04);
  rack.rotation.y = 0.5;
  scene.add(rack);

  const chalk = new THREE.Group();
  const chalkBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.022, 0.022, 0.022),
    new THREE.MeshStandardMaterial({ color: '#d9d7cf', roughness: 0.8 }),
  );
  const chalkTop = new THREE.Mesh(
    new THREE.BoxGeometry(0.0222, 0.006, 0.0222),
    new THREE.MeshStandardMaterial({ color: '#3d8fb0', roughness: 1 }),
  );
  chalkTop.position.y = 0.0085;
  chalk.add(chalkBody, chalkTop);
  chalk.position.set(OUTER_X + 0.07, BODY_BOTTOM + 0.011, 0.2);
  chalk.rotation.y = 0.4;
  chalk.traverse((o) => (o.castShadow = true));
  scene.add(chalk);
}

function buildRack(): THREE.Group {
  const g = new THREE.Group();
  const side = 10 * R + 0.012;
  const shape = new THREE.Shape();
  const h = (side * Math.sqrt(3)) / 2;
  shape.moveTo(-side / 2, -h / 3);
  shape.lineTo(side / 2, -h / 3);
  shape.lineTo(0, (2 * h) / 3);
  shape.closePath();
  const inner = new THREE.Path();
  const s2 = side - 0.022;
  const h2 = (s2 * Math.sqrt(3)) / 2;
  inner.moveTo(-s2 / 2, -h2 / 3);
  inner.lineTo(0, (2 * h2) / 3);
  inner.lineTo(s2 / 2, -h2 / 3);
  inner.closePath();
  shape.holes.push(inner);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.014,
    bevelEnabled: true,
    bevelThickness: 0.001,
    bevelSize: 0.001,
    bevelSegments: 2,
  });
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ color: '#141414', roughness: 0.4, clearcoat: 0.3 }));
  mesh.castShadow = true;
  g.add(mesh);
  return g;
}
