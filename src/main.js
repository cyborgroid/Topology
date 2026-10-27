import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { GROUPS, NODES, LINKS, CONTROLS } from './topology.config.js';

const WATER = 0x04223a;

// --- scene ---------------------------------------------------------------
const scene = new THREE.Scene();
scene.background = new THREE.Color(WATER);
scene.fog = new THREE.FogExp2(WATER, 0.022);

const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 500);
camera.position.set(0, -4, 36);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
document.getElementById('app').appendChild(renderer.domElement);

const labels = new CSS2DRenderer();
labels.setSize(innerWidth, innerHeight);
labels.domElement.className = 'labels';
document.getElementById('app').appendChild(labels.domElement);

scene.add(new THREE.HemisphereLight(0x9fe8ff, 0x021018, 1.2));
const sun = new THREE.DirectionalLight(0xbff4ff, 1.4);
sun.position.set(5, 40, 10);
scene.add(sun);

// --- nodes ---------------------------------------------------------------
const nodeById = new Map();
for (const n of NODES) {
  const color = GROUPS[n.group].color;
  const mesh = new THREE.Mesh(
    new THREE.IcosahedronGeometry(n.size, 2),
    new THREE.MeshStandardMaterial({
      color, emissive: color, emissiveIntensity: 0.35,
      roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.9,
    }),
  );
  mesh.position.fromArray(n.pos);
  mesh.userData = { ...n, base: mesh.position.clone(), phase: Math.random() * Math.PI * 2 };

  const el = document.createElement('div');
  el.className = 'label';
  el.textContent = n.name;
  const label = new CSS2DObject(el);
  label.position.set(0, n.size + 0.8, 0);
  mesh.add(label);

  scene.add(mesh);
  nodeById.set(n.id, mesh);
}

// --- links ---------------------------------------------------------------
const linkGeo = new THREE.BufferGeometry();
linkGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(LINKS.length * 6), 3));
const links = new THREE.LineSegments(
  linkGeo,
  new THREE.LineBasicMaterial({ color: 0x7fe7ff, transparent: true, opacity: 0.35 }),
);
scene.add(links);

function updateLinks() {
  const arr = linkGeo.attributes.position.array;
  LINKS.forEach(([a, b], i) => {
    nodeById.get(a).position.toArray(arr, i * 6);
    nodeById.get(b).position.toArray(arr, i * 6 + 3);
  });
  linkGeo.attributes.position.needsUpdate = true;
}

// --- underwater particles ------------------------------------------------
const PARTICLES = 1500;
const pGeo = new THREE.BufferGeometry();
const pPos = new Float32Array(PARTICLES * 3);
for (let i = 0; i < PARTICLES * 3; i++) pPos[i] = (Math.random() - 0.5) * 120;
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
const particles = new THREE.Points(
  pGeo,
  new THREE.PointsMaterial({ color: 0xbff4ff, size: 0.12, transparent: true, opacity: 0.6 }),
);
scene.add(particles);

// --- controls: scroll / space / shift ------------------------------------
const keys = { space: false, shift: false };
const velocity = new THREE.Vector3();
let yaw = 0, pitch = 0, dragging = false;

addEventListener('keydown', (e) => {
  if (e.code === 'Space') { keys.space = true; e.preventDefault(); }
  if (e.key === 'Shift') keys.shift = true;
});
addEventListener('keyup', (e) => {
  if (e.code === 'Space') keys.space = false;
  if (e.key === 'Shift') keys.shift = false;
});
addEventListener('blur', () => { keys.space = keys.shift = false; });

addEventListener('wheel', (e) => {
  e.preventDefault();
  // 일부 브라우저는 Shift+스크롤을 deltaX 로 보낸다.
  const delta = e.deltaY || e.deltaX;
  const amount = -delta * CONTROLS.wheelSpeed * (keys.shift ? CONTROLS.fineFactor : 1);
  const dir = new THREE.Vector3();
  if (e.shiftKey) {
    dir.set(1, 0, 0).applyQuaternion(camera.quaternion);   // Shift+스크롤 = 좌우
  } else {
    camera.getWorldDirection(dir);                           // 스크롤 = 전진/후진
  }
  velocity.addScaledVector(dir, amount * 10);
}, { passive: false });

renderer.domElement.addEventListener('pointerdown', () => { dragging = true; });
addEventListener('pointerup', () => { dragging = false; });
addEventListener('pointermove', (e) => {
  if (!dragging) return;
  yaw -= e.movementX * CONTROLS.lookSensitivity;
  pitch = THREE.MathUtils.clamp(pitch - e.movementY * CONTROLS.lookSensitivity, -1.4, 1.4);
});

// --- picking -------------------------------------------------------------
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const info = document.getElementById('info');
renderer.domElement.addEventListener('click', (e) => {
  pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects([...nodeById.values()])[0];
  if (!hit) { info.hidden = true; return; }
  const d = hit.object.userData;
  info.innerHTML = `<strong>${d.name}</strong><span>${GROUPS[d.group].label}</span><p>${d.desc}</p>`;
  info.hidden = false;
});

// --- loop ----------------------------------------------------------------
const hud = document.getElementById('hud-pos');
const clock = new THREE.Clock();

function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  if (keys.space) {
    const rise = CONTROLS.riseSpeed * (keys.shift ? -1 : 1);   // Shift+Space = 하강
    velocity.y += rise * dt * 4;
  }
  camera.position.addScaledVector(velocity, dt);
  velocity.multiplyScalar(Math.exp(-CONTROLS.damping * dt));    // 물의 저항
  camera.quaternion.setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));

  for (const mesh of nodeById.values()) {
    const { base, phase } = mesh.userData;
    mesh.position.y = base.y + Math.sin(t * 0.6 + phase) * 0.4;
    mesh.rotation.y += dt * 0.2;
  }
  updateLinks();

  particles.rotation.y = t * 0.01;
  particles.position.y = Math.sin(t * 0.2) * 0.5;

  const p = camera.position;
  hud.textContent = `x ${p.x.toFixed(1)}  y ${p.y.toFixed(1)}  z ${p.z.toFixed(1)}`;

  renderer.render(scene, camera);
  labels.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  labels.setSize(innerWidth, innerHeight);
});
