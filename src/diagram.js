// 다이어그램 뷰: QE Analog Topology 의 본 화면.
// 개념은 블록 코딩처럼 층층이 쌓인 블록 탑이고, 폴더 내용은 한 단계 뒤·아래의 판(plate)에 블록으로 놓인다.
// 마우스 = 구조 파악(회전, 선택), 스크롤 = 가리킨 폴더로 들어가기(앞) / 나오기(뒤).
import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { canvas, registerView, isActive, isTyping, isUi, onViewChange } from './core.js';
import { CONTROLS } from './topology.config.js';

const WATER = 0x04223a;
export const ROOT = 'topology';

export const scene = new THREE.Scene();
scene.background = new THREE.Color(WATER);
scene.fog = new THREE.FogExp2(WATER, 0.012);
scene.add(new THREE.HemisphereLight(0xbff4ff, 0x021018, 1.4));
const sun = new THREE.DirectionalLight(0xffffff, 1.6);
sun.position.set(12, 30, 20);
scene.add(sun);

export const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 800);

const labels = new CSS2DRenderer();
labels.domElement.className = 'layer labels';
document.getElementById('stage').appendChild(labels.domElement);
labels.setSize(innerWidth, innerHeight);

const crumbsEl = document.getElementById('crumbs');
const infoEl = document.getElementById('info');
const hintEl = document.getElementById('diagram-hint');

// --- 물속 입자 -------------------------------------------------------------
const PARTICLES = 2500;
const pPos = new Float32Array(PARTICLES * 3);
for (let i = 0; i < PARTICLES; i++) {
  pPos[i * 3] = (Math.random() - 0.5) * 200;
  pPos[i * 3 + 1] = (Math.random() - 0.5) * 160 - 20;
  pPos[i * 3 + 2] = (Math.random() - 0.5) * 200 - 40;
}
const pGeo = new THREE.BufferGeometry();
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
const particles = new THREE.Points(pGeo, new THREE.PointsMaterial({ color: 0xbff4ff, size: 0.12, transparent: true, opacity: 0.5 }));
scene.add(particles);

// --- 블록 형상 ----------------------------------------------------------------
// 스크래치 블록처럼 윗면에 홈(notch), 아랫면에 돌기(tab)가 있어 위아래 블록이 맞물린다.
function blockShape(w, h, notch) {
  const s = new THREE.Shape();
  const r = Math.min(0.18, h / 4);
  const x0 = -w / 2, x1 = w / 2, y0 = -h / 2, y1 = h / 2;
  const nx = x0 + 0.5, nw = 0.7, nd = 0.2;
  s.moveTo(x0 + r, y0);
  if (notch) { s.lineTo(nx, y0); s.lineTo(nx + 0.15, y0 - nd); s.lineTo(nx + nw - 0.15, y0 - nd); s.lineTo(nx + nw, y0); }
  s.lineTo(x1 - r, y0);
  s.quadraticCurveTo(x1, y0, x1, y0 + r);
  s.lineTo(x1, y1 - r);
  s.quadraticCurveTo(x1, y1, x1 - r, y1);
  if (notch) { s.lineTo(nx + nw, y1); s.lineTo(nx + nw - 0.15, y1 - nd); s.lineTo(nx + 0.15, y1 - nd); s.lineTo(nx, y1); }
  s.lineTo(x0 + r, y1);
  s.quadraticCurveTo(x0, y1, x0, y1 - r);
  s.lineTo(x0, y0 + r);
  s.quadraticCurveTo(x0, y0, x0 + r, y0);
  return s;
}

const geometries = new Map();
function blockGeometry(w, h, d, notch) {
  const key = `${w}:${h}:${d}:${notch}`;
  if (!geometries.has(key)) {
    const g = new THREE.ExtrudeGeometry(blockShape(w, h, notch), {
      depth: d, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 2, curveSegments: 5,
    });
    g.translate(0, 0, -d / 2);
    geometries.set(key, g);
  }
  return geometries.get(key);
}

export const BLOCKS = {
  concept: { w: 4.4, h: 1.5, d: 1.4, notch: true },
  member:  { w: 3.2, h: 1.5, d: 1.4, notch: true },
  folder:  { w: 2.8, h: 1.0, d: 0.8, notch: true },
  file:    { w: 2.8, h: 0.7, d: 0.25, notch: false },
  more:    { w: 2.8, h: 0.7, d: 0.25, notch: false },
};

// --- 그래프: 블록 노드, 판, 연결선 ---------------------------------------------
const nodes = new Map();
const plates = new Map();
const links = [];
const MAX_LINKS = 4096;

export function addNode({ id, name, kind, color, pos, parentId = null, data = {}, shape = BLOCKS[kind] }) {
  const mesh = new THREE.Mesh(
    blockGeometry(shape.w, shape.h, shape.d, shape.notch),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.15, roughness: 0.45, metalness: 0.05 }),
  );
  mesh.position.copy(pos);

  const el = document.createElement('div');
  el.className = `label label-${kind}`;
  el.textContent = name;
  const label = new CSS2DObject(el);
  label.position.set(0, 0, shape.d / 2 + 0.1);
  mesh.add(label);

  mesh.userData = { id, name, kind, data, parentId, shape, label: el };
  scene.add(mesh);
  nodes.set(id, mesh);
  return mesh;
}

export const getNode = (id) => nodes.get(id);

export function removeNode(id) {
  const mesh = nodes.get(id);
  if (!mesh) return;
  unlink(mesh);
  mesh.removeFromParent();   // CSS2DObject 는 removed 이벤트로 라벨 DOM 도 정리한다.
  mesh.material.dispose();
  nodes.delete(id);
  if (selectedId === id) selectedId = null;
  if (hoveredId === id) hoveredId = null;
}

// 판: 한 폴더의 내용이 놓이는 반투명 바닥. 위쪽 왼편에 폴더 이름표가 붙는다.
export function setPlate(id, { center, w, h, title }) {
  let plate = plates.get(id);
  if (!plate) {
    plate = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: 0x7fe7ff, transparent: true, opacity: 0.07, roughness: 1, depthWrite: false }),
    );
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(plate.geometry),
      new THREE.LineBasicMaterial({ color: 0x7fe7ff, transparent: true, opacity: 0.35 }),
    );
    plate.add(edges);
    const el = document.createElement('div');
    el.className = 'label label-plate';
    plate.userData = { id, title: el, titleObj: new CSS2DObject(el) };
    plate.add(plate.userData.titleObj);
    scene.add(plate);
    plates.set(id, plate);
  }
  plate.position.copy(center);
  plate.scale.set(w, h, 0.15);
  plate.userData.title.textContent = title;
  plate.userData.titleObj.position.set(-0.5, 0.5, 0);   // 판의 왼쪽 위 모서리 (판 크기로 스케일됨)
  plate.userData.titleObj.center.set(0, 1);
  return plate;
}

export function removePlate(id) {
  const plate = plates.get(id);
  if (!plate) return;
  unlink(plate);
  plate.removeFromParent();
  plate.geometry.dispose();
  plates.delete(id);
}

// 층 바닥판처럼 고르지 않는 장식용 메시. 폴더 안에 들어가면 개념 블록과 함께 흐려진다.
const decor = [];
export function addDecor(mesh) {
  mesh.material.transparent = true;
  mesh.userData.baseOpacity = mesh.material.opacity;
  decor.push(mesh);
  scene.add(mesh);
  return mesh;
}

export function addLink(a, b) {
  const ma = nodes.get(a) ?? plates.get(a), mb = nodes.get(b) ?? plates.get(b);
  if (!ma || !mb || links.length >= MAX_LINKS) return;
  if (links.some(([x, y]) => (x === ma && y === mb) || (x === mb && y === ma))) return;
  links.push([ma, mb]);
}

function unlink(obj) {
  for (let i = links.length - 1; i >= 0; i--) {
    if (links[i][0] === obj || links[i][1] === obj) links.splice(i, 1);
  }
}

const linkGeo = new THREE.BufferGeometry();
linkGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_LINKS * 6), 3));
const linkLines = new THREE.LineSegments(linkGeo, new THREE.LineBasicMaterial({ color: 0x7fe7ff, transparent: true, opacity: 0.4 }));
linkLines.frustumCulled = false;
scene.add(linkLines);

// 흐려졌거나 숨은 블록·판으로 이어지는 선은 그리지 않는다.
// (판은 원래 반투명하므로 visible 만 본다)
const shown = (o) => o.visible && (!o.userData.kind || o.material.opacity > 0.45);

function updateLinks() {
  const arr = linkGeo.attributes.position.array;
  let n = 0;
  for (const [a, b] of links) {
    if (!shown(a) || !shown(b)) continue;
    a.position.toArray(arr, n * 6);
    b.position.toArray(arr, n * 6 + 3);
    n++;
  }
  linkGeo.setDrawRange(0, n * 2);
  linkGeo.attributes.position.needsUpdate = true;
}

// --- 카메라: 목표점을 중심으로 도는 궤도 ------------------------------------------
const overview = { target: new THREE.Vector3(), offset: new THREE.Vector3(0.55, 0.35, 1).normalize().multiplyScalar(36) };
const goal = { target: new THREE.Vector3(), sph: new THREE.Spherical(46, 1.2, 0.7) };
const cur = { target: new THREE.Vector3(), sph: new THREE.Spherical(46, 1.2, 0.7) };

export function setOverview(target, distance) {
  overview.target.copy(target);
  overview.offset.setLength(distance);
}

// 노드마다 그 아래 구조가 잘 보이는 시점을 hooks.frame 이 정한다 (target, offset).
function aim(id) {
  const view = id === ROOT ? overview : hooks.frame(nodes.get(id).userData);
  goal.target.copy(view.target);
  goal.sph.setFromVector3(view.offset);
  goal.sph.phi = THREE.MathUtils.clamp(goal.sph.phi, 0.15, Math.PI - 0.15);
}

// --- 탐색 상태 -----------------------------------------------------------------
let focusId = ROOT, selectedId = null, hoveredId = null;
let pull = 0, lastWheel = 0;

export const hooks = {
  enter: async () => {},          // 폴더에 들어갈 때(펼치기 등)
  frame: () => overview,          // 노드의 시점
  describe: async () => '',       // 정보 패널의 세부 정보
  open: () => {},                 // 파일 열기
  terminal: () => {},             // 여기서 터미널
};

const enterable = (u) => u && (u.kind === 'concept' || u.kind === 'folder' || u.kind === 'more');

function chain(id = focusId) {
  const out = [];
  for (let n = nodes.get(id); n; n = nodes.get(n.userData.parentId)) out.unshift(n.userData);
  return out;
}

export async function enter(id) {
  const node = nodes.get(id);
  if (!node || !enterable(node.userData)) return;
  if (node.userData.data.alias) return enter(node.userData.data.alias);   // 바로가기 블록
  pull = 0;
  if (node.userData.kind === 'more') {
    // "더 보기" 블록은 같은 판에 다음 묶음을 이어 붙인다.
    await hooks.enter(node.userData);
    aim(focusId);
    return;
  }
  focusId = id;
  selectedId = id;
  aim(id);
  renderCrumbs();
  renderInfo();
  await hooks.enter(node.userData);
  if (focusId === id) aim(id);   // 펼친 뒤 판 크기에 맞춰 시점을 다시 잡는다.
}

export function exit() {
  const parent = nodes.get(focusId)?.userData.parentId;
  if (parent) enter(parent);
}

export const focusedId = () => focusId;
export const ancestorsOf = (id) => chain(id);

function select(id) {
  selectedId = id;
  renderInfo();
}

// --- 정보 패널과 경로 표시 --------------------------------------------------------
function h(tag, props = {}, ...children) {
  const el = Object.assign(document.createElement(tag), props);
  el.append(...children);
  return el;
}

function renderCrumbs() {
  const items = chain();
  crumbsEl.replaceChildren(...items.flatMap((u, i) => {
    const b = h('button', { textContent: u.name, className: i === items.length - 1 ? 'current' : '' });
    b.addEventListener('click', () => enter(u.id));
    return i ? [h('span', { className: 'sep', textContent: '›' }), b] : [b];
  }));
}

const KIND_LABEL = { concept: '개념 블록', folder: '폴더', file: '파일', more: '더 보기' };

async function renderInfo() {
  const u = nodes.get(selectedId)?.userData;
  if (!u) { infoEl.hidden = true; return; }
  infoEl.hidden = !isActive(view);
  const detail = h('div', { className: 'dim' });
  const actions = h('div', { className: 'actions' });
  const button = (text, fn) => { const b = h('button', { textContent: text }); b.addEventListener('click', fn); actions.append(b); };

  if (enterable(u) && u.id !== focusId) button('들어가기 (스크롤 ↑)', () => enter(u.id));
  if (u.id === focusId && u.parentId) button('나가기 (스크롤 ↓)', exit);
  if (u.kind === 'file') button('열기', () => hooks.open(u));
  if (u.kind === 'folder') button('여기서 터미널', () => hooks.terminal(u.data.path));

  infoEl.replaceChildren(
    h('div', { className: 'kind', textContent: u.data.tier ? `${KIND_LABEL[u.kind]} · ${u.data.tier}` : KIND_LABEL[u.kind] }),
    h('strong', { textContent: u.name }),
    ...(u.data.path ? [h('div', { className: 'path', textContent: u.data.path })] : []),
    ...(u.data.desc ? [h('p', { textContent: u.data.desc })] : []),
    detail,
    actions,
  );
  const text = await hooks.describe(u);
  if (selectedId === u.id) detail.textContent = text;
}

// --- 입력 ----------------------------------------------------------------------
const raycaster = new THREE.Raycaster();
function pick(e) {
  raycaster.setFromCamera(new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1), camera);
  // 흐려진 상위 단계·개념 탑 블록은 앞에 있어도 고르지 않는다.
  return raycaster.intersectObjects([...nodes.values()].filter(shown), false)[0]?.object.userData.id ?? null;
}

const keys = { space: false, shift: false };
let dragging = false, dragDistance = 0;

canvas.addEventListener('pointerdown', () => {
  if (!isActive(view)) return;
  dragging = true;
  dragDistance = 0;
});
addEventListener('pointerup', () => { dragging = false; });
addEventListener('pointermove', (e) => {
  if (!isActive(view)) return;
  if (dragging) {
    // 드래그 = 구조를 돌려 보기
    dragDistance += Math.abs(e.movementX) + Math.abs(e.movementY);
    goal.sph.theta -= e.movementX * CONTROLS.orbitSensitivity;
    goal.sph.phi = THREE.MathUtils.clamp(goal.sph.phi - e.movementY * CONTROLS.orbitSensitivity, 0.15, Math.PI - 0.15);
    cur.sph.theta = goal.sph.theta;
    cur.sph.phi = goal.sph.phi;
    return;
  }
  if (e.target !== canvas) { hoveredId = null; return; }
  hoveredId = pick(e);
  canvas.style.cursor = hoveredId ? (enterable(nodes.get(hoveredId).userData) ? 'zoom-in' : 'pointer') : '';
});

canvas.addEventListener('click', (e) => {
  if (!isActive(view) || dragDistance > 4) return;
  const id = pick(e);
  if (id) select(id);
});
canvas.addEventListener('dblclick', (e) => {
  if (!isActive(view)) return;
  const u = nodes.get(pick(e))?.userData;
  if (!u) return;
  if (enterable(u)) enter(u.id);
  else if (u.kind === 'file') hooks.open(u);
});

// 스크롤 앞(↑) = 가리킨(없으면 선택한) 폴더로 들어가기, 뒤(↓) = 상위로 나가기.
// 몇 칸 굴려야 넘어가며, 그동안 카메라가 그쪽으로 다가가거나 물러나 미리 보여 준다.
function candidate() {
  for (const id of [hoveredId, selectedId]) {
    const u = nodes.get(id)?.userData;
    if (enterable(u) && id !== focusId) return nodes.get(id);
  }
  return null;
}

addEventListener('wheel', (e) => {
  if (!isActive(view) || isUi(e.target)) return;
  e.preventDefault();
  if (e.target === canvas) hoveredId = pick(e);
  const delta = e.deltaY || e.deltaX;
  const step = THREE.MathUtils.clamp(delta / 100, -1, 1) * 0.34 * (e.shiftKey ? CONTROLS.fineFactor : 1);
  pull = THREE.MathUtils.clamp(pull - step, -1, 1);
  lastWheel = performance.now();
  if (pull >= 1) {
    const c = candidate();
    if (c) enter(c.userData.id);
    else pull = 0.6;
  } else if (pull <= -1) {
    if (nodes.get(focusId)?.userData.parentId) exit();
    else pull = -0.6;
  }
}, { passive: false });

addEventListener('keydown', (e) => {
  if (e.key === 'Shift') keys.shift = true;
  if (!isActive(view) || isTyping(e.target)) return;
  if (e.code === 'Space') { keys.space = true; e.preventDefault(); }
  if (e.code === 'Home') enter(ROOT);
  if (e.code === 'Backspace') exit();
  if (e.code === 'Enter' && selectedId) enter(selectedId);
});
addEventListener('keyup', (e) => {
  if (e.code === 'Space') keys.space = false;
  if (e.key === 'Shift') keys.shift = false;
});
addEventListener('blur', () => { keys.space = keys.shift = false; });

// --- 프레임 --------------------------------------------------------------------
const wrap = (a) => ((a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
const LABEL_RANGE = 24;

function update(dt, t) {
  // Space = 위에서 내려다보기, Shift+Space = 아래에서 올려다보기
  if (keys.space) goal.sph.phi = THREE.MathUtils.clamp(goal.sph.phi + CONTROLS.riseSpeed * dt * (keys.shift ? 1 : -1), 0.15, Math.PI - 0.15);
  if (performance.now() - lastWheel > 350) pull *= Math.exp(-dt * 6);

  const target = goal.target.clone();
  let radius = goal.sph.radius;
  const c = pull > 0 ? candidate() : null;
  if (c) target.lerp(c.position, pull * 0.45);
  radius *= pull > 0 ? 1 - 0.35 * pull : 1 - 0.5 * pull;

  const k = 1 - Math.exp(-dt * 5);
  cur.target.lerp(target, k);
  cur.sph.radius += (radius - cur.sph.radius) * k;
  cur.sph.phi += (goal.sph.phi - cur.sph.phi) * k;
  cur.sph.theta += wrap(goal.sph.theta - cur.sph.theta) * k;
  camera.position.setFromSpherical(cur.sph).add(cur.target);
  camera.lookAt(cur.target);

  // 폴더 안에서는 지금 판보다 앞(카메라 쪽)에 있는 상위 단계와 개념 탑이 시야를 가리므로 흐리게 한다.
  const inFolder = nodes.get(focusId)?.userData.kind === 'folder';
  const cutZ = goal.target.z + 3;
  const fadeOf = (obj) => (inFolder && obj.position.z > cutZ ? 0.08 : 1);
  for (const mesh of nodes.values()) {
    const { id, kind, parentId, label } = mesh.userData;
    const emphasis = id === selectedId ? 0.65 : id === hoveredId ? 0.4 : id === focusId ? 0.3 : 0.12;
    mesh.material.emissiveIntensity += (emphasis - mesh.material.emissiveIntensity) * k;
    // 지금 폴더 블록은 판의 머리말로 남기되 반투명하게 둔다.
    const fade = id === focusId ? (inFolder ? 0.5 : 1) : fadeOf(mesh);
    mesh.material.transparent = true;
    mesh.material.opacity += (fade - mesh.material.opacity) * k;
    mesh.material.depthWrite = mesh.material.opacity > 0.9;
    const show = (fade === 1 || id === focusId) && (kind === 'concept' || id === focusId || id === selectedId || id === hoveredId
      || parentId === focusId || mesh.position.distanceTo(camera.position) < LABEL_RANGE);
    label.style.opacity = show ? '' : '0';
  }
  for (const plate of plates.values()) {
    // CSS2D 이름표는 부모의 visible 을 따르지 않으므로 함께 끈다.
    plate.visible = plate.userData.titleObj.visible = fadeOf(plate) === 1;
  }
  for (const mesh of decor) {
    const fade = fadeOf(mesh);
    mesh.material.opacity += (mesh.userData.baseOpacity * fade - mesh.material.opacity) * k;
    mesh.children.forEach((c) => { if (c.element) c.element.style.opacity = fade === 1 ? '' : '0'; });
  }
  updateLinks();
  particles.position.y = Math.sin(t * 0.2) * 0.6;
}

const view = {
  scene, camera,
  layers: [labels.domElement, crumbsEl, hintEl],
  update,
  render: () => labels.render(scene, camera),
  resize: () => labels.setSize(innerWidth, innerHeight),
  status: () => `깊이 ${chain().length - 1} · ${nodes.get(focusId)?.userData.name ?? ''}`,
};
registerView('diagram', view);

// 처음에는 전체를 내려다보는 자리에서 시작한다.
export function start() {
  aim(ROOT);
  cur.target.copy(goal.target);
  cur.sph.copy(goal.sph);
  renderCrumbs();
}

// 정보 패널은 선택이 있을 때만 다이어그램 뷰에서 보인다.
onViewChange((name) => { infoEl.hidden = name !== 'diagram' || !selectedId; });
