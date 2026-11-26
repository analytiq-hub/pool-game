import * as THREE from 'three';
import { Game } from './game/game';
import { buildRoom, setupRenderer } from './render/scene';
import { buildTable } from './render/tableMesh';

const app = document.getElementById('app')!;
const renderer = setupRenderer(app);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, app.clientWidth / app.clientHeight, 0.01, 20);

buildRoom(renderer, scene);
scene.add(buildTable());
const game = new Game(scene, camera, renderer.domElement, app);

function resize(): void {
  const w = app.clientWidth;
  const h = app.clientHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  // Keep the whole table in view on narrow (portrait) screens.
  camera.fov = w / h < 1 ? 62 : 42;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 1 / 20);
  game.update(dt);
  renderer.render(scene, camera);
});
