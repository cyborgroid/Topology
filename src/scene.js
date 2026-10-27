// 물속 같은 3D Topology 공간: 장면, 카메라 조작, 노드/링크 그래프.
import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { CSS3DRenderer } from 'three/addons/renderers/CSS3DRenderer.js';
import { CONTROLS } from './topology.config.js';

const WATER = 0x04223a;
const HOME_VIEW = { pos: new THREE.Vector3(0, -4, 36), yaw: 0, pitch: 0 };

// --- scene ---------------------------------------------------------------
export const scene = new THREE.Scene();
scene.background = new THREE.Color(WATER);
scene.fog = new THREE.FogExp2(WATER, 0.018);

export const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 500);
camera.position.copy(HOME_VIEW.pos);

const stage = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
stage.appendChild(renderer.domElement);

const labels = new CSS2DRenderer();
labels.domElement.className = 'layer labels';
stage.appendChild(labels.domElement);

// 데스크톱 창과 아이콘은 실제 HTML 이 3D 공간에 놓이는 CSS3D 레이어에 그린다.
const css3d = new CSS3DRenderer();
css3d.domElement.className = 'layer css3d';
stage.appendChild(css3d.domElement);

for (const r of [labels, css3d]) r.setSize(innerWidth, innerHeight);

scene.add(new THREE.HemisphereLight(0x9fe8ff, 0x021018, 1.2));
const sun = new THREE.DirectionalLight(0xbff4ff, 1.4);
sun.position.set(5, 40, 10);
scene.add(sun);

// --- graph ---------------------------------------------------------------
const nodes = new Map();
const links = [];
const MAX_LINKS = 8192;

const SHAPES = {
  concept: (s) => new THREE.IcosahedronGeometry(s, 2),
  folder: (s) => new THREE.BoxGeometry(s * 1.3, s, s * 0.35),
  file: (s) => new THREE.OctahedronGeometry(s, 0),
  more: (s) => new THREE.SphereGeometry(s, 8, 6),
};

export function addNode({ id, name, kind = 'concept', color, size = 1, pos, data = {} }) {
  const mesh = new THREE.Mesh(
    SHAPES[kind](size),
    new THREE.MeshStandardMaterial({
      color, emissive: color, emissiveIntensity: 0.35,
      roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.9,
    }),
  );
  mesh.position.copy(pos);

  const el = document.createElement('div');
  el.className = `label label-${kind}`;
  el.textContent = name;
  const label = new CSS2DObject(el);
  label.position.set(0, size + 0.6, 0);
  mesh.add(label);

  mesh.userData = { id, name, kind, data, label: el, base: pos.clone(), phase: Math.random() * Math.PI * 2 };
  scene.add(mesh);
  nodes.set(id, mesh);
  return mesh;
}

export function getNode(id) {
  return nodes.get(id);
}

export function removeNode(id) {
  const mesh = nodes.get(id);
  if (!mesh) return;
  for (let i = links.length - 1; i >= 0; i--) {
    if (links[i][0] === mesh || links[i][1] === mesh) links.splice(i, 1);
  }
  mesh.removeFromParent();   // CSS2DObject 는 removed 이벤트로 라벨 DOM 도 정리한다.
  mesh.geometry.dispose();
  mesh.material.dispose();
  nodes.delete(id);
}

export function addLink(a, b) {
  const ma = nodes.get(a), mb = nodes.get(b);
  if (!ma || !mb || links.length >= MAX_LINKS) return;
  if (links.some(([x, y]) => (x === ma && y === mb) || (x === mb && y === ma))) return;
  links.push([ma, mb]);
}

const linkGeo = new THREE.BufferGeometry();
linkGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_LINKS * 6), 3));
const linkLines = new THREE.LineSegments(
  linkGeo,
  new THREE.LineBasicMaterial({ color: 0x7fe7ff, transparent: true, opacity: 0.3 }),
);
linkLines.frustumCulled = false;
scene.add(linkLines);

function updateLinks() {
  const arr = linkGeo.attributes.position.array;
  links.forEach(([a, b], i) => {
    a.position.toArray(arr, i * 6);
    b.position.toArray(arr, i * 6 + 3);
  });
  linkGeo.setDrawRange(0, links.length * 2);
  linkGeo.attributes.position.needsUpdate = true;
}

// --- underwater particles ------------------------------------------------
const PARTICLES = 2000;
const pPos = new Float32Array(PARTICLES * 3);
for (let i = 0; i < PARTICLES * 3; i++) pPos[i] = (Math.random() - 0.5) * 160;
const pGeo = new THREE.BufferGeometry();
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
const particles = new THREE.Points(
  pGeo,
  new THREE.PointsMaterial({ color: 0xbff4ff, size: 0.12, transparent: true, opacity: 0.6 }),
);
scene.add(particles);

// --- controls: scroll / space / shift ------------------------------------
const keys = { space: false, shift: false };
const velocity = new THREE.Vector3();
let yaw = HOME_VIEW.yaw, pitch = HOME_VIEW.pitch, dragging = false, dragDistance = 0, fly = null;

const isTyping = (t) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
// 창, 작업 표시줄, 시작 메뉴 위에서는 스크롤이 그 UI 의 몫이다.
const isUi = (t) => t instanceof Element && t.closest('.win, .taskbar, .start-menu');

addEventListener('keydown', (e) => {
  if (e.key === 'Shift') keys.shift = true;
  if (isTyping(e.target)) return;
  if (e.code === 'Space') { keys.space = true; fly = null; e.preventDefault(); }
  if (e.code === 'Home') flyHome();
});
addEventListener('keyup', (e) => {
  if (e.code === 'Space') keys.space = false;
  if (e.key === 'Shift') keys.shift = false;
});
addEventListener('blur', () => { keys.space = keys.shift = false; });

addEventListener('wheel', (e) => {
  if (isUi(e.target)) return;
  e.preventDefault();
  fly = null;
  // 일부 환경은 Shift+스크롤을 deltaX 로 보낸다.
  const delta = e.deltaY || e.deltaX;
  const amount = -delta * CONTROLS.wheelSpeed * (keys.shift ? CONTROLS.fineFactor : 1);
  const dir = new THREE.Vector3();
  if (e.shiftKey) dir.set(1, 0, 0).applyQuaternion(camera.quaternion);   // Shift+스크롤 = 좌우
  else camera.getWorldDirection(dir);                                      // 스크롤 = 전진/후진
  velocity.addScaledVector(dir, amount * 10);
}, { passive: false });

renderer.domElement.addEventListener('pointerdown', () => { dragging = true; dragDistance = 0; });
addEventListener('pointerup', () => { dragging = false; });
addEventListener('pointermove', (e) => {
  if (!dragging) return;
  fly = null;
  dragDistance += Math.abs(e.movementX) + Math.abs(e.movementY);
  yaw -= e.movementX * CONTROLS.lookSensitivity;
  pitch = THREE.MathUtils.clamp(pitch - e.movementY * CONTROLS.lookSensitivity, -1.4, 1.4);
});

// --- camera flights ------------------------------------------------------
const wrap = (a) => ((a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;

export function flyTo(pos, toYaw, toPitch, dur = 0.9) {
  velocity.set(0, 0, 0);
  fly = { from: camera.position.clone(), to: pos.clone(), y0: yaw, y1: yaw + wrap(toYaw - yaw), p0: pitch, p1: toPitch, t: 0, dur };
}

export function flyHome() {
  flyTo(HOME_VIEW.pos, HOME_VIEW.yaw, HOME_VIEW.pitch);
}

// target 을 distance 만큼 떨어진 현재 방향에서 바라본다.
export function flyToPoint(target, distance = 10) {
  const back = camera.position.clone().sub(target);
  if (back.lengthSq() < 1e-6) back.set(0, 0, 1);
  const pos = target.clone().addScaledVector(back.normalize(), distance);
  const look = target.clone().sub(pos);
  flyTo(pos, Math.atan2(-look.x, -look.z), Math.asin(look.y / look.length()));
}

// pos 위치에서 화면 1px 이 차지하는 월드 길이.
export function worldPerPixel(pos) {
  const dist = pos.distanceTo(camera.position);
  return (2 * dist * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) / innerHeight;
}

// --- picking -------------------------------------------------------------
const raycaster = new THREE.Raycaster();
const handlers = { click: [], dblclick: [] };
let pendingClick = null;

export function onNode(type, fn) {
  handlers[type].push(fn);
}

renderer.domElement.addEventListener('click', (e) => {
  if (dragDistance > 4) return;
  raycaster.setFromCamera(new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1), camera);
  const hit = raycaster.intersectObjects([...nodes.values()], false)[0];
  if (!hit) return;
  const node = hit.object;
  // 같은 노드를 빠르게 두 번 누르면 더블클릭으로 보고, 단일 클릭은 취소한다.
  if (pendingClick && pendingClick.node === node) {
    clearTimeout(pendingClick.timer);
    pendingClick = null;
    handlers.dblclick.forEach((fn) => fn(node.userData, node));
    return;
  }
  if (pendingClick) clearTimeout(pendingClick.timer);
  pendingClick = {
    node,
    timer: setTimeout(() => { pendingClick = null; handlers.click.forEach((fn) => fn(node.userData, node)); }, 260),
  };
});

// --- loop ----------------------------------------------------------------
const tickers = [];
export function onTick(fn) {
  tickers.push(fn);
}

const clock = new THREE.Clock();
const LABEL_RANGE = { concept: Infinity, folder: 60, file: 28, more: 28 };

function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  if (fly) {
    fly.t += dt;
    const k = Math.min(1, fly.t / fly.dur);
    const s = k * k * (3 - 2 * k);
    camera.position.lerpVectors(fly.from, fly.to, s);
    yaw = THREE.MathUtils.lerp(fly.y0, fly.y1, s);
    pitch = THREE.MathUtils.lerp(fly.p0, fly.p1, s);
    if (k >= 1) fly = null;
  } else {
    if (keys.space) velocity.y += CONTROLS.riseSpeed * (keys.shift ? -1 : 1) * dt * 4;   // Shift+Space = 하강
    camera.position.addScaledVector(velocity, dt);
    velocity.multiplyScalar(Math.exp(-CONTROLS.damping * dt));    // 물의 저항
  }
  camera.quaternion.setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));

  for (const mesh of nodes.values()) {
    const { base, phase, kind, label } = mesh.userData;
    mesh.position.y = base.y + Math.sin(t * 0.6 + phase) * 0.3;
    mesh.rotation.y += dt * 0.2;
    label.style.opacity = mesh.position.distanceTo(camera.position) < LABEL_RANGE[kind] ? '' : '0';
  }
  updateLinks();

  particles.rotation.y = t * 0.01;
  particles.position.y = Math.sin(t * 0.2) * 0.5;

  tickers.forEach((fn) => fn(dt, t));

  renderer.render(scene, camera);
  labels.render(scene, camera);
  css3d.render(scene, camera);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  for (const r of [labels, css3d]) r.setSize(innerWidth, innerHeight);
});
