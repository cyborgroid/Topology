// 다이어그램 뷰: QE Analog Topology 전체를 하나의 PCB 회로로 보여 준다. 조작은 마우스만 쓴다.
// 층(TIERS)은 겹겹이 쌓인 기판 레이어, 개념은 칩, 관계(LINKS)는 구리 배선이고
// 다른 층끼리는 비아(via)로 이어진다. 배선 위로 신호가 흐른다.
import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { canvas, registerView, isActive, isTyping, isUi, onViewChange } from './core.js';
import { GROUPS, NODES, TIERS, LINKS, CONTROLS } from './topology.config.js';

const WATER = 0x04223a;
const LAYER_STEP = 5.5;
const BOARD_W = 28, BOARD_D = 13;
const CHIP_H = 0.6, CHIP_D = 2.6;

export const scene = new THREE.Scene();
scene.background = new THREE.Color(WATER);
scene.fog = new THREE.FogExp2(WATER, 0.008);
scene.add(new THREE.HemisphereLight(0xbff4ff, 0x021018, 1.3));
const sun = new THREE.DirectionalLight(0xffffff, 1.8);
sun.position.set(15, 40, 25);
scene.add(sun);

export const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 800);

const labels = new CSS2DRenderer();
labels.domElement.className = 'layer labels';
document.getElementById('stage').appendChild(labels.domElement);
labels.setSize(innerWidth, innerHeight);

const infoEl = document.getElementById('info');
const hintEl = document.getElementById('diagram-hint');

export const hooks = {
  folders: () => [],      // 칩에 접목된 실제 폴더 [{ name, path }]
  openFolder: () => {},   // 데스크톱 뷰에서 그 폴더 열기
};

function label(text, className, parent, position, center = [0.5, 0.5]) {
  const el = document.createElement('div');
  el.className = `label ${className}`;
  el.textContent = text;
  const obj = new CSS2DObject(el);
  obj.position.copy(position);
  obj.center.set(...center);
  parent.add(obj);
  return el;
}

// --- 회로 구성 ------------------------------------------------------------------
const chips = new Map();    // id -> { mesh, def, tier, layer, label }
const traces = [];          // { a, b, material, points, cum, length }
const layerY = (i) => -i * LAYER_STEP;
const surfaceY = (i) => layerY(i) - CHIP_H / 2 + 0.02;

const copper = () => new THREE.MeshStandardMaterial({ color: 0xc58b3a, emissive: 0xc58b3a, emissiveIntensity: 0.25, metalness: 0.6, roughness: 0.35 });

function buildBoards() {
  TIERS.forEach((tier, i) => {
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(BOARD_W, 0.22, BOARD_D),
      new THREE.MeshStandardMaterial({ color: 0x0b3d2e, transparent: true, opacity: 0.72, roughness: 0.8, depthWrite: false }),
    );
    board.position.set(0, layerY(i) - CHIP_H / 2 - 0.11, 0);
    board.add(new THREE.LineSegments(
      new THREE.EdgesGeometry(board.geometry),
      new THREE.LineBasicMaterial({ color: 0x2fdc9a, transparent: true, opacity: 0.45 }),
    ));
    scene.add(board);
    // 기판 앞쪽 왼편의 실크스크린 글씨
    label(tier.name, 'label-tier', board, new THREE.Vector3(-BOARD_W / 2 + 0.4, 0.2, BOARD_D / 2 - 0.4), [0, 1]);
  });
}

function buildChips() {
  const defs = Object.fromEntries(NODES.map((n) => [n.id, n]));
  const pins = [];
  TIERS.forEach((tier, i) => {
    const n = tier.blocks.length;
    const spacing = Math.min(8, (BOARD_W - 4) / n);
    tier.blocks.forEach((id, j) => {
      const def = defs[id];
      const w = n > 2 && j > 0 ? 3.2 : 4.6;
      const color = GROUPS[def.group].color;
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(w, CHIP_H, CHIP_D),
        new THREE.MeshStandardMaterial({ color: 0x18222c, emissive: color, emissiveIntensity: 0.05, roughness: 0.45 }),
      );
      mesh.position.set((j - (n - 1) / 2) * spacing, layerY(i), -1);
      // 윗면 앞쪽의 색 띠 = 개념 그룹
      const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(w * 0.92, 0.02, 0.32),
        new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.6 }),
      );
      stripe.position.set(0, CHIP_H / 2 + 0.01, CHIP_D / 2 - 0.3);
      mesh.add(stripe);
      // 양쪽 긴 변의 핀
      for (let x = -w / 2 + 0.3; x <= w / 2 - 0.2; x += 0.4) {
        for (const side of [-1, 1]) pins.push(new THREE.Vector3(mesh.position.x + x, layerY(i) - 0.1, mesh.position.z + side * (CHIP_D / 2 + 0.12)));
      }
      mesh.userData = { id };
      scene.add(mesh);
      const el = label(def.name, 'label-chip', mesh, new THREE.Vector3(0, CHIP_H / 2 + 0.35, -0.1));
      el.style.setProperty('--chip', `#${color.toString(16).padStart(6, '0')}`);
      chips.set(id, { mesh, def, tier: tier.name, layer: i, label: el });
    });
  });

  const pinMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.12, 0.14, 0.26),
    new THREE.MeshStandardMaterial({ color: 0xb8c4cc, metalness: 0.9, roughness: 0.3 }),
    pins.length,
  );
  const m = new THREE.Matrix4();
  pins.forEach((p, k) => pinMesh.setMatrixAt(k, m.makeTranslation(p.x, p.y, p.z)));
  scene.add(pinMesh);
}

// 한 칩의 같은 변에서 여러 배선이 나가면 핀 위치를 조금씩 비켜 준다.
const ports = new Map();
function portX(id, side) {
  const key = `${id}:${side}`;
  const k = ports.get(key) ?? 0;
  ports.set(key, k + 1);
  return chips.get(id).mesh.position.x + ((k % 5) - 2) * 0.45;
}

function buildTraces() {
  const cross = LINKS.filter(([a, b]) => chips.get(a).layer !== chips.get(b).layer);
  const lanes = new Map();
  for (const [a, b] of LINKS) {
    const A = chips.get(a), B = chips.get(b);
    let points;
    if (A.layer === B.layer) {
      // 같은 기판: 칩 앞쪽 레인을 따라 직각으로 잇는다.
      const lane = lanes.get(A.layer) ?? 0;
      lanes.set(A.layer, lane + 1);
      const y = surfaceY(A.layer), z0 = A.mesh.position.z + CHIP_D / 2 + 0.3, zl = 1.4 + lane * 0.6;
      const xa = portX(a, 'front'), xb = portX(b, 'front');
      points = [[xa, y, z0], [xa, y, zl], [xb, y, zl], [xb, y, z0]];
    } else {
      // 다른 기판: 칩 뒤쪽에서 비아 열까지 간 뒤 수직으로 내려가 상대 칩 뒤쪽으로 들어간다.
      const k = cross.findIndex(([x, y]) => x === a && y === b);
      const vx = -BOARD_W / 2 + 2 + (k + 0.5) * ((BOARD_W - 4) / cross.length);
      const vz = -3.4 - (k % 4) * 0.9;
      const ya = surfaceY(A.layer), yb = surfaceY(B.layer);
      const za = A.mesh.position.z - CHIP_D / 2 - 0.3, zb = B.mesh.position.z - CHIP_D / 2 - 0.3;
      const xa = portX(a, 'back'), xb = portX(b, 'back');
      points = [[xa, ya, za], [xa, ya, vz], [vx, ya, vz], [vx, yb, vz], [xb, yb, vz], [xb, yb, zb]];
    }
    traces.push(makeTrace(a, b, points.map((p) => new THREE.Vector3(...p))));
  }
}

function makeTrace(a, b, points) {
  const material = copper();
  const group = new THREE.Group();
  const cum = [0];
  for (let i = 1; i < points.length; i++) {
    const p = points[i - 1], q = points[i];
    const len = p.distanceTo(q);
    cum.push(cum[i - 1] + len);
    const mid = p.clone().add(q).multiplyScalar(0.5);
    let seg;
    if (Math.abs(p.y - q.y) > 1e-6) {
      seg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, len, 8), material);   // 비아
      for (const end of [p, q]) {
        const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 12), material);
        pad.position.copy(end);
        group.add(pad);
      }
    } else {
      const alongX = Math.abs(p.x - q.x) > Math.abs(p.z - q.z);
      seg = new THREE.Mesh(new THREE.BoxGeometry(alongX ? len + 0.14 : 0.14, 0.03, alongX ? 0.14 : len + 0.14), material);
    }
    seg.position.copy(mid);
    group.add(seg);
  }
  scene.add(group);
  return { a, b, material, points, cum, length: cum[cum.length - 1] };
}

// 배선마다 두 개의 신호 펄스가 흐른다.
const PULSES_PER_TRACE = 2;
let pulses;
function buildPulses() {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(traces.length * PULSES_PER_TRACE * 3), 3));
  pulses = new THREE.Points(geo, new THREE.PointsMaterial({
    color: 0xfff1a8, size: 0.32, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  pulses.frustumCulled = false;
  scene.add(pulses);
}

function pointAt(trace, s, out) {
  let i = 1;
  while (i < trace.cum.length - 1 && trace.cum[i] < s) i++;
  const t = (s - trace.cum[i - 1]) / (trace.cum[i] - trace.cum[i - 1] || 1);
  return out.lerpVectors(trace.points[i - 1], trace.points[i], t);
}

// --- 카메라: 마우스로 도는 궤도 -------------------------------------------------------
const OVERVIEW = {
  target: new THREE.Vector3(0, layerY((TIERS.length - 1) / 2), -1),
  offset: new THREE.Vector3(0.6, 0.85, 1.2).normalize().multiplyScalar(50),
};
const goal = { target: new THREE.Vector3(), sph: new THREE.Spherical() };
const cur = { target: new THREE.Vector3(), sph: new THREE.Spherical() };

function aimAt(target, offset) {
  goal.target.copy(target);
  goal.sph.setFromVector3(offset);
}
export const overview = () => aimAt(OVERVIEW.target, OVERVIEW.offset);
function focusChip(id) {
  aimAt(chips.get(id).mesh.position, new THREE.Vector3(0.5, 0.75, 1).normalize().multiplyScalar(13));
}

// --- 선택과 정보 패널 --------------------------------------------------------------
let selectedId = null, hoveredId = null;

function h(tag, props = {}, ...children) {
  const el = Object.assign(document.createElement(tag), props);
  el.append(...children);
  return el;
}

export function select(id) {
  selectedId = id;
  renderInfo();
}

function renderInfo() {
  const chip = chips.get(selectedId);
  if (!chip) { infoEl.hidden = true; return; }
  infoEl.hidden = !isActive(view);
  const linked = LINKS.filter((l) => l.includes(selectedId)).map((l) => (l[0] === selectedId ? l[1] : l[0]));
  const linkButtons = linked.map((id) => {
    const b = h('button', { textContent: chips.get(id).def.name });
    b.addEventListener('click', () => { select(id); focusChip(id); });
    return b;
  });
  const folderButtons = hooks.folders(selectedId).map((f) => {
    const b = h('button', { textContent: `📁 ${f.name}`, title: `${f.path} — 데스크톱에서 열기` });
    b.addEventListener('click', () => hooks.openFolder(f.path));
    return b;
  });
  infoEl.replaceChildren(
    h('div', { className: 'kind', textContent: `칩 · ${chip.tier}` }),
    h('strong', { textContent: chip.def.name }),
    h('p', { textContent: chip.def.desc }),
    h('div', { className: 'dim', textContent: '연결된 칩' }),
    h('div', { className: 'actions' }, ...linkButtons),
    ...(folderButtons.length ? [h('div', { className: 'dim', textContent: '접목된 폴더 (데스크톱에서 열기)' }), h('div', { className: 'actions' }, ...folderButtons)] : []),
  );
}

// --- 마우스 ---------------------------------------------------------------------
// 왼쪽 드래그 = 회전, 오른쪽 드래그 = 이동, 가운데 드래그 = 확대/축소,
// 스크롤 = 회로로 다가가기(↑)/물러나기(↓), Shift+스크롤 = 천천히,
// 클릭 = 칩 선택, 더블클릭 = 칩으로 다가가기(빈 곳이면 전체 보기).
const raycaster = new THREE.Raycaster();
function pick(e) {
  raycaster.setFromCamera(new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1), camera);
  const meshes = [...chips.values()].map((c) => c.mesh);
  return raycaster.intersectObjects(meshes, false)[0]?.object.userData.id ?? null;
}

let drag = null;
canvas.addEventListener('contextmenu', (e) => { if (isActive(view)) e.preventDefault(); });
canvas.addEventListener('pointerdown', (e) => {
  if (!isActive(view)) return;
  drag = { button: e.button, moved: 0 };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!isActive(view)) return;
  if (!drag) {
    hoveredId = pick(e);
    canvas.style.cursor = hoveredId ? 'pointer' : 'grab';
    return;
  }
  drag.moved += Math.abs(e.movementX) + Math.abs(e.movementY);
  if (drag.button === 0) {
    goal.sph.theta -= e.movementX * CONTROLS.orbitSensitivity;
    goal.sph.phi = THREE.MathUtils.clamp(goal.sph.phi - e.movementY * CONTROLS.orbitSensitivity, 0.1, Math.PI - 0.1);
  } else if (drag.button === 2) {
    const k = cur.sph.radius * 0.0016;
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
    goal.target.addScaledVector(right, -e.movementX * k).addScaledVector(up, e.movementY * k);
  } else if (drag.button === 1) {
    goal.sph.radius = THREE.MathUtils.clamp(goal.sph.radius * Math.exp(e.movementY * 0.01), 4, 120);
  }
});
canvas.addEventListener('pointerup', (e) => {
  if (!isActive(view) || !drag) return;
  if (drag.button === 0 && drag.moved < 4) select(pick(e));
  drag = null;
});
addEventListener('wheel', (e) => {
  if (!isActive(view) || isUi(e.target)) return;
  e.preventDefault();
  const delta = THREE.MathUtils.clamp(e.deltaY || e.deltaX, -200, 200);
  goal.sph.radius = THREE.MathUtils.clamp(goal.sph.radius * Math.exp(delta * 0.0012 * (e.shiftKey ? CONTROLS.fineFactor : 1)), 4, 120);
}, { passive: false });

canvas.addEventListener('dblclick', (e) => {
  if (!isActive(view)) return;
  const id = pick(e);
  if (id) { select(id); focusChip(id); } else overview();
});
addEventListener('keydown', (e) => {
  if (!isActive(view) || isTyping(e.target)) return;
  if (e.code === 'Home') overview();
  if (e.code === 'Escape') select(null);
});

// --- 프레임 --------------------------------------------------------------------
const wrap = (a) => ((a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
const tmp = new THREE.Vector3();

function update(dt, t) {
  const k = 1 - Math.exp(-dt * 6);
  cur.target.lerp(goal.target, k);
  cur.sph.radius += (goal.sph.radius - cur.sph.radius) * k;
  cur.sph.phi += (goal.sph.phi - cur.sph.phi) * k;
  cur.sph.theta += wrap(goal.sph.theta - cur.sph.theta) * k;
  camera.position.setFromSpherical(cur.sph).add(cur.target);
  camera.lookAt(cur.target);

  // 고른(또는 가리킨) 칩에 닿는 배선과 칩은 밝게, 나머지는 어둡게
  const active = selectedId ?? hoveredId;
  for (const tr of traces) {
    const on = !active || tr.a === active || tr.b === active;
    const goalI = !active ? 0.3 : on ? 1.1 : 0.06;
    tr.material.emissiveIntensity += (goalI - tr.material.emissiveIntensity) * k;
  }
  for (const [id, c] of chips) {
    const near = !active || id === active || LINKS.some((l) => l.includes(active) && l.includes(id));
    const goalI = id === selectedId ? 0.5 : id === hoveredId ? 0.3 : near ? 0.08 : 0.01;
    c.mesh.material.emissiveIntensity += (goalI - c.mesh.material.emissiveIntensity) * k;
    c.label.classList.toggle('dim-chip', !near);
    c.label.classList.toggle('selected', id === selectedId);
  }

  // 신호 펄스: 선택이 있으면 그 칩의 배선에만 흐른다.
  const arr = pulses.geometry.attributes.position.array;
  traces.forEach((tr, i) => {
    const on = !active || tr.a === active || tr.b === active;
    for (let p = 0; p < PULSES_PER_TRACE; p++) {
      const idx = (i * PULSES_PER_TRACE + p) * 3;
      if (!on) { arr[idx] = arr[idx + 1] = arr[idx + 2] = 1e5; continue; }
      const s = ((t * 3 + (p / PULSES_PER_TRACE) * tr.length + i * 1.7) % tr.length);
      pointAt(tr, s, tmp).toArray(arr, idx);
      arr[idx + 1] += 0.08;
    }
  });
  pulses.geometry.attributes.position.needsUpdate = true;
}

const view = {
  scene, camera,
  layers: [labels.domElement, hintEl],
  update,
  render: () => labels.render(scene, camera),
  resize: () => labels.setSize(innerWidth, innerHeight),
  status: () => (selectedId ? `${chips.get(selectedId).def.name} 선택` : '회로 전체'),
};
registerView('diagram', view);
onViewChange((name) => { infoEl.hidden = name !== 'diagram' || !selectedId; });

export function build() {
  buildBoards();
  buildChips();
  buildTraces();
  buildPulses();
  overview();
  cur.target.copy(goal.target);
  cur.sph.copy(goal.sph);
}
