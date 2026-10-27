// 다이어그램 뷰: Quantum Brain — QE(양자)로 짠 AI 구조(양자 신경망)를 3D 로 보여 준다.
// 큐비트(개념)는 원형 고리로 놓이고, 신경망의 층(LAYERS)이 그 고리를 따라 앞으로 이어져 원통을 이룬다.
// 게이트는 블록이고, 얽힘(CX)은 원통 안쪽을 가로지르는 연결선이다.
// 상태는 실제로 계산하며(quantum.js), 순전파 커서가 지나갈 때마다 블로흐 구가 바뀐다.
import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { canvas, registerView, isActive, isTyping, isUi, onViewChange } from './core.js';
import { GROUPS, NODES, QUBITS, ROLES, LAYERS, GATES, CONTROLS } from './topology.config.js';
import { QuantumState } from './quantum.js';

const WATER = 0x04223a;
const RING = 7;          // 큐비트 고리의 반지름
const COL = 1.7;         // 게이트 열 간격
const LAYER_GAP = 3.2;   // 층 사이 간격
const SPEED = 2.5;       // 순전파 속도(게이트/초)

export const scene = new THREE.Scene();
scene.background = new THREE.Color(WATER);
scene.fog = new THREE.FogExp2(WATER, 0.007);
scene.add(new THREE.HemisphereLight(0xbff4ff, 0x021018, 1.3));
const sun = new THREE.DirectionalLight(0xffffff, 1.6);
sun.position.set(-10, 30, 25);
scene.add(sun);

export const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 800);

const labels = new CSS2DRenderer();
labels.domElement.className = 'layer labels';
document.getElementById('stage').appendChild(labels.domElement);
labels.setSize(innerWidth, innerHeight);

const infoEl = document.getElementById('info');
const hintEl = document.getElementById('diagram-hint');

export const hooks = {
  folders: () => [],      // 큐비트(개념)에 접목된 실제 폴더 [{ name, path }]
  openFolder: () => {},   // 데스크톱 뷰에서 그 폴더 열기
};

const defs = Object.fromEntries(NODES.map((n) => [n.id, n]));
const qIndex = Object.fromEntries(QUBITS.map((id, i) => [id, i]));
const N = QUBITS.length;
const colorOf = (id) => GROUPS[defs[id].group].color;
const hex = (c) => `#${c.toString(16).padStart(6, '0')}`;

// 고리 위 큐비트 q 의 x 위치에서의 점 (QE 가 맨 위)
function ringPos(q, x, r = RING) {
  const a = Math.PI / 2 - (q / N) * Math.PI * 2;
  return new THREE.Vector3(x, r * Math.sin(a), r * Math.cos(a));
}

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

const involved = (g) => [...(g.controls ?? []), ...g.targets];

// --- 순전파 계산: frames[g] = 게이트 g 직전의 블로흐 벡터들 ----------------------------
const frames = [];
function simulate() {
  const s = new QuantumState(N);
  const snap = () => frames.push(QUBITS.map((_, q) => s.bloch(q)));
  snap();
  for (const g of GATES) {
    const ts = g.targets.map((id) => qIndex[id]);
    if (g.kind === 'H') ts.forEach((q) => s.h(q));
    if (g.kind === 'RX') ts.forEach((q) => s.rx(q, g.angle));
    if (g.kind === 'RY') ts.forEach((q) => s.ry(q, g.angle));
    if (g.kind === 'CX') for (const c of g.controls) for (const t of g.targets) s.cx(qIndex[c], qIndex[t]);
    snap();
  }
}

// --- 배치: 층마다 겹치지 않는 게이트는 같은 열에 놓는다 -----------------------------------
const gateX = [];
const layerSpan = [];
let xStart = 0, xEnd = 0;
function layout() {
  let x = 0;
  for (const layer of LAYERS) {
    const busy = new Array(N).fill(0);
    let cols = 1;
    GATES.forEach((g, i) => {
      if (g.layer !== layer.id) return;
      const qs = involved(g).map((id) => qIndex[id]);
      const col = Math.max(...qs.map((q) => busy[q]));
      qs.forEach((q) => { busy[q] = col + 1; });
      gateX[i] = x + col * COL;
      cols = Math.max(cols, col + 1);
    });
    layerSpan.push({ layer, from: x - COL / 2, to: x + (cols - 1) * COL + COL / 2, first: GATES.findIndex((g) => g.layer === layer.id) });
    x += (cols - 1) * COL + LAYER_GAP;
  }
  xStart = -2;
  xEnd = x - LAYER_GAP + 2;
}

// --- 그리기 ---------------------------------------------------------------------
const pickables = [];       // 고를 수 있는 메시 (userData: { type, index })
const gateParts = [];       // gateParts[g] = 그 게이트의 재질들
const bloch = [];           // bloch[q] = { arrow, shaft, head, dot }
const readouts = new Map(); // 출력 큐비트 -> 확률 막대 라벨
let cursor;

const material = (color, intensity = 0.25, extra = {}) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.4, ...extra });

function buildWires() {
  QUBITS.forEach((id, q) => {
    const color = colorOf(id);
    const a = ringPos(q, xStart - 1.5), b = ringPos(q, xEnd + 1);
    const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, a.distanceTo(b), 8), material(color, 0.5));
    wire.position.copy(a).add(b).multiplyScalar(0.5);
    wire.rotation.z = Math.PI / 2;
    wire.userData = { type: 'qubit', index: q };
    scene.add(wire);
    pickables.push(wire);

    // 시작점의 블로흐 구
    const center = ringPos(q, xStart - 4);
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.95, 20, 14),
      new THREE.MeshBasicMaterial({ color, wireframe: true, transparent: true, opacity: 0.22 }),
    );
    sphere.position.copy(center);
    sphere.userData = { type: 'qubit', index: q };
    scene.add(sphere);
    pickables.push(sphere);
    const arrow = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1, 8).translate(0, 0.5, 0), material(0xffffff, 0.6));
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.32, 12), material(color, 0.9));
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), material(color, 0.9));
    arrow.add(shaft, head);
    arrow.position.copy(center);
    dot.position.copy(center);
    scene.add(arrow, dot);
    bloch.push({ arrow, shaft, head, dot });

    const out = center.clone().sub(new THREE.Vector3(center.x, 0, 0)).setLength(1.9);
    const el = label(`|0⟩ ${defs[id].name}`, 'label-qubit', sphere, out);
    el.style.setProperty('--q', hex(color));
    el.dataset.role = ROLES[id];
  });
}

function gateBlock(kind, pos, g, color) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.95, 0.95), material(color, 0.3));
  mesh.position.copy(pos);
  mesh.userData = { type: 'gate', index: g };
  scene.add(mesh);
  pickables.push(mesh);
  // 블록에는 종류만 쓰고, 회전 각도는 정보 패널에서 보여 준다.
  label({ H: 'H', M: 'M', RX: 'Rx', RY: 'Ry' }[kind], 'label-gate', mesh, new THREE.Vector3(0, 0, 0));
  return mesh.material;
}

function buildGates() {
  GATES.forEach((g, i) => {
    const x = gateX[i];
    const mats = [];
    if (g.kind === 'CX') {
      // 제어 = 점, 대상 = ⊕ 고리, 둘을 원통 안쪽을 가로지르는 선으로 잇는다.
      for (const c of g.controls) {
        const p = ringPos(qIndex[c], x);
        const dot = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 10), material(0x7fe7ff, 0.6));
        dot.position.copy(p);
        dot.userData = { type: 'gate', index: i };
        scene.add(dot);
        pickables.push(dot);
        mats.push(dot.material);
        for (const t of g.targets) {
          const q = ringPos(qIndex[t], x);
          const link = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, p.distanceTo(q), 6), material(0x7fe7ff, 0.4, { transparent: true, opacity: 0.8 }));
          link.position.copy(p).add(q).multiplyScalar(0.5);
          link.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), q.clone().sub(p).normalize());
          scene.add(link);
          mats.push(link.material);
        }
      }
      for (const t of g.targets) {
        const p = ringPos(qIndex[t], x);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.07, 8, 24), material(0x7fe7ff, 0.6));
        ring.position.copy(p);
        ring.rotation.y = Math.PI / 2;
        ring.userData = { type: 'gate', index: i };
        scene.add(ring);
        pickables.push(ring);
        mats.push(ring.material);
      }
    } else {
      const color = g.kind === 'H' ? 0xe0b341 : g.kind === 'M' ? 0x3a4b5c : g.layer === 'input' ? 0x2fd6a0 : 0xd55fbf;
      for (const t of g.targets) mats.push(gateBlock(g.kind, ringPos(qIndex[t], x), i, color));
    }
    gateParts[i] = mats;
  });

  // 출력 큐비트의 측정값: 마지막 열 바깥에 확률 막대
  const m = GATES.length - 1;
  for (const id of GATES[m].targets) {
    const pos = ringPos(qIndex[id], gateX[m] + 2.2);
    const el = label('', 'label-readout', scene, pos, [0, 0.5]);
    el.innerHTML = '<span class="name"></span><span class="bar"><i></i></span><span class="value"></span>';
    el.querySelector('.name').textContent = defs[id].name;
    readouts.set(id, el);
  }
}

function buildLayers() {
  layerSpan.forEach((span, i) => {
    const len = span.to - span.from;
    const shell = new THREE.Mesh(
      new THREE.CylinderGeometry(RING + 1.3, RING + 1.3, len, 48, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x7fe7ff, transparent: true, opacity: 0.035, side: THREE.DoubleSide, depthWrite: false }),
    );
    shell.rotation.z = Math.PI / 2;
    shell.position.set((span.from + span.to) / 2, 0, 0);
    scene.add(shell);
    for (const x of [span.from, span.to]) {
      const edge = new THREE.Mesh(new THREE.TorusGeometry(RING + 1.3, 0.03, 6, 64), new THREE.MeshBasicMaterial({ color: 0x7fe7ff, transparent: true, opacity: 0.35 }));
      edge.position.set(x, 0, 0);
      edge.rotation.y = Math.PI / 2;
      scene.add(edge);
    }
    // 짧은 층이 이어지면 이름이 겹치므로 높이를 번갈아 둔다.
    const el = label(span.layer.name, 'label-layer', scene, new THREE.Vector3((span.from + span.to) / 2, RING + 2.4 + (i % 2) * 1.6, 0));
    el.title = span.layer.desc;
    el.addEventListener('click', () => { time = span.first; playing = false; selectLayer(span); });
  });

  // 순전파 커서: 지금 계산 중인 위치를 가로지르는 원판
  cursor = new THREE.Mesh(
    new THREE.CircleGeometry(RING + 1.3, 64),
    new THREE.MeshBasicMaterial({ color: 0xfff1a8, transparent: true, opacity: 0.07, side: THREE.DoubleSide, depthWrite: false }),
  );
  cursor.rotation.y = Math.PI / 2;
  cursor.add(new THREE.Mesh(new THREE.TorusGeometry(RING + 1.3, 0.06, 6, 64), new THREE.MeshBasicMaterial({ color: 0xfff1a8 })));
  scene.add(cursor);
}

// --- 순전파 재생 -------------------------------------------------------------------
let time = 0, playing = true, holdUntil = 0;
const gateIndex = () => Math.min(Math.floor(time), GATES.length - 1);
const cursorX = () => {
  const i = Math.floor(time), f = time - i;
  if (i >= GATES.length - 1) return gateX[GATES.length - 1] + f * 2;
  return THREE.MathUtils.lerp(gateX[i], gateX[i + 1], f);
};

// 지금 시점의 큐비트 q 블로흐 벡터 (게이트를 지나는 동안 부드럽게 바뀐다)
function blochNow(q) {
  const i = Math.min(Math.floor(time), GATES.length);
  const f = THREE.MathUtils.smoothstep(time - i, 0, 1);
  const a = frames[i][q], b = frames[Math.min(i + 1, GATES.length)][q];
  return a.map((v, k) => THREE.MathUtils.lerp(v, b[k], f));
}

// --- 카메라: 마우스로 도는 궤도 -------------------------------------------------------
const goal = { target: new THREE.Vector3(), sph: new THREE.Spherical() };
const cur = { target: new THREE.Vector3(), sph: new THREE.Spherical() };
let overviewView;

function aimAt(target, offset) {
  goal.target.copy(target);
  goal.sph.setFromVector3(offset);
}
export const overview = () => aimAt(overviewView.target, overviewView.offset);
const focusOn = (pos) => aimAt(pos, new THREE.Vector3(-0.4, 0.45, 1).normalize().multiplyScalar(14));

// --- 선택과 정보 패널 --------------------------------------------------------------
let selected = null, hovered = null;   // { type: 'gate' | 'qubit' | 'layer', index }
let liveEl = null;

function h(tag, props = {}, ...children) {
  const el = Object.assign(document.createElement(tag), props);
  el.append(...children);
  return el;
}

const KIND = { H: 'H · 중첩', RX: 'Rx · 회전', RY: 'Ry · 회전', CX: 'CX · 얽힘', M: 'M · 측정' };
const layerOf = (id) => LAYERS.find((l) => l.id === id);

function select(sel) {
  selected = sel;
  liveEl = null;
  if (!sel) { infoEl.hidden = true; return; }
  infoEl.hidden = !isActive(view);
  if (sel.type === 'gate') {
    const g = GATES[sel.index];
    const go = h('button', { textContent: '이 단계로 이동' });
    go.addEventListener('click', () => { time = sel.index; playing = false; });
    infoEl.replaceChildren(
      h('div', { className: 'kind', textContent: `게이트 ${KIND[g.kind]} · ${layerOf(g.layer).name}` }),
      h('strong', { textContent: involved(g).map((id) => defs[id].name).join(g.kind === 'CX' ? ' → ' : ', ') }),
      h('p', { textContent: g.note }),
      ...(g.angle !== undefined ? [h('div', { className: 'dim', textContent: `회전 각 ${g.angle.toFixed(2)} rad` })] : []),
      h('div', { className: 'actions' }, go),
    );
  } else if (sel.type === 'qubit') {
    const id = QUBITS[sel.index];
    liveEl = h('div', { className: 'live' });
    const folders = hooks.folders(id).map((f) => {
      const b = h('button', { textContent: `📁 ${f.name}`, title: `${f.path} — 데스크톱에서 열기` });
      b.addEventListener('click', () => hooks.openFolder(f.path));
      return b;
    });
    infoEl.replaceChildren(
      h('div', { className: 'kind', textContent: `큐비트 · ${ROLES[id]}` }),
      h('strong', { textContent: defs[id].name }),
      h('p', { textContent: defs[id].desc }),
      liveEl,
      ...(folders.length ? [h('div', { className: 'dim', textContent: '접목된 폴더 (데스크톱에서 열기)' }), h('div', { className: 'actions' }, ...folders)] : []),
    );
  }
}

function selectLayer(span) {
  selected = { type: 'layer', index: LAYERS.indexOf(span.layer) };
  liveEl = null;
  infoEl.hidden = !isActive(view);
  infoEl.replaceChildren(
    h('div', { className: 'kind', textContent: '층' }),
    h('strong', { textContent: span.layer.name }),
    h('p', { textContent: span.layer.desc }),
  );
}

function updateLive() {
  if (!liveEl || selected?.type !== 'qubit') return;
  const [x, y, z] = blochNow(selected.index);
  const r = Math.hypot(x, y, z);
  liveEl.textContent = `블로흐 (x ${x.toFixed(2)}, y ${y.toFixed(2)}, z ${z.toFixed(2)})\n`
    + `1 이 나올 확률 ${((1 - z) / 2 * 100).toFixed(0)}%\n`
    + (r < 0.95 ? `얽힘 ${((1 - r) * 100).toFixed(0)}% — 다른 큐비트와 얽혀 있다` : '순수 상태 — 아직 얽히지 않았다');
}

// --- 마우스 · 키보드 ---------------------------------------------------------------
// 왼쪽 드래그 = 회전, 오른쪽 드래그 = 이동, 스크롤/가운데 드래그 = 다가가기·물러나기,
// 클릭 = 게이트/큐비트 선택, 더블클릭 = 다가가기(빈 곳이면 전체 보기),
// Space = 순전파 재생/멈춤, ← → = 한 단계씩, 층 이름 클릭 = 그 층으로.
const raycaster = new THREE.Raycaster();
function pick(e) {
  raycaster.setFromCamera(new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1), camera);
  const hit = raycaster.intersectObjects(pickables, false)[0];
  return hit ? { ...hit.object.userData, point: hit.object.position } : null;
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
    hovered = pick(e);
    canvas.style.cursor = hovered ? 'pointer' : 'grab';
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
    goal.sph.radius = THREE.MathUtils.clamp(goal.sph.radius * Math.exp(e.movementY * 0.01), 4, 140);
  }
});
canvas.addEventListener('pointerup', (e) => {
  if (!isActive(view) || !drag) return;
  if (drag.button === 0 && drag.moved < 4) {
    const p = pick(e);
    select(p ? { type: p.type, index: p.index } : null);
  }
  drag = null;
});
canvas.addEventListener('dblclick', (e) => {
  if (!isActive(view)) return;
  const p = pick(e);
  if (p) focusOn(p.point); else overview();
});
addEventListener('wheel', (e) => {
  if (!isActive(view) || isUi(e.target)) return;
  e.preventDefault();
  const delta = THREE.MathUtils.clamp(e.deltaY || e.deltaX, -200, 200);
  goal.sph.radius = THREE.MathUtils.clamp(goal.sph.radius * Math.exp(delta * 0.0012 * (e.shiftKey ? CONTROLS.fineFactor : 1)), 4, 140);
}, { passive: false });
addEventListener('keydown', (e) => {
  if (!isActive(view) || isTyping(e.target)) return;
  if (e.code === 'Space') { e.preventDefault(); playing = !playing; }
  if (e.code === 'ArrowRight') { playing = false; time = Math.min(Math.floor(time) + 1, GATES.length); }
  if (e.code === 'ArrowLeft') { playing = false; time = Math.max(Math.ceil(time) - 1, 0); }
  if (e.code === 'Home') overview();
  if (e.code === 'Escape') select(null);
});

// --- 프레임 --------------------------------------------------------------------
const wrap = (a) => ((a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
const UP = new THREE.Vector3(0, 1, 0);

function update(dt) {
  const k = 1 - Math.exp(-dt * 6);
  cur.target.lerp(goal.target, k);
  cur.sph.radius += (goal.sph.radius - cur.sph.radius) * k;
  cur.sph.phi += (goal.sph.phi - cur.sph.phi) * k;
  cur.sph.theta += wrap(goal.sph.theta - cur.sph.theta) * k;
  camera.position.setFromSpherical(cur.sph).add(cur.target);
  camera.lookAt(cur.target);

  // 순전파: 끝까지 가면 잠시 멈췄다가 |0…0⟩ 부터 다시
  const now = performance.now();
  if (playing && now > holdUntil) {
    if (time >= GATES.length) time = 0;
    else {
      time = Math.min(time + dt * SPEED, GATES.length);
      if (time >= GATES.length) holdUntil = now + 3000;
    }
  }
  cursor.position.x = cursorX();

  // 블로흐 화살표: 길이 = 순수도(짧을수록 많이 얽힘). 블로흐 z → 위, x → 앞(+x), y → 옆(+z)
  bloch.forEach((b, q) => {
    const [x, y, z] = blochNow(q);
    const v = new THREE.Vector3(x, z, y);
    const len = v.length() * 0.95;
    b.arrow.visible = len > 0.08;
    if (b.arrow.visible) {
      b.arrow.quaternion.setFromUnitVectors(UP, v.normalize());
      b.shaft.scale.y = Math.max(len - 0.3, 0.01);
      b.head.position.y = Math.max(len - 0.15, 0.15);
    }
  });

  // 지금 지나는 게이트와 고른/가리킨 게이트를 밝게
  const active = gateIndex();
  gateParts.forEach((mats, i) => {
    const on = i === active && time < GATES.length;
    const pickedHere = (selected?.type === 'gate' && selected.index === i) || (hovered?.type === 'gate' && hovered.index === i);
    const goalI = on ? 1.4 : pickedHere ? 0.9 : i < time ? 0.35 : 0.15;
    for (const m of mats) m.emissiveIntensity += (goalI - m.emissiveIntensity) * k;
  });

  // 측정값: 측정 열을 지난 뒤에 확률을 보여 준다
  const measured = time >= GATES.length - 1;
  for (const [id, el] of readouts) {
    const p1 = (1 - frames[GATES.length][qIndex[id]][2]) / 2;
    el.classList.toggle('pending', !measured);
    el.querySelector('i').style.width = measured ? `${(p1 * 100).toFixed(0)}%` : '0%';
    el.querySelector('.value').textContent = measured ? `P(1) ${(p1 * 100).toFixed(0)}%` : '측정 전';
  }
  updateLive();
}

const view = {
  scene, camera,
  layers: [labels.domElement, hintEl],
  update,
  render: () => labels.render(scene, camera),
  resize: () => labels.setSize(innerWidth, innerHeight),
  status: () => `${layerOf(GATES[gateIndex()].layer).name} · ${Math.min(Math.floor(time) + 1, GATES.length)}/${GATES.length}${playing ? '' : ' ⏸'}`,
};
registerView('diagram', view);
onViewChange((name) => { infoEl.hidden = name !== 'diagram' || !selected; });

export function build() {
  simulate();
  layout();
  buildWires();
  buildGates();
  buildLayers();
  // 블로흐 구부터 측정값까지 전체 길이가 가로 시야에 들어오는 거리
  const len = xEnd + 6 - (xStart - 6);
  const hfov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect);
  const dist = (len / 2) / Math.tan(hfov / 2) + RING;
  overviewView = {
    target: new THREE.Vector3((xStart - 6 + xEnd + 6) / 2, 0, 0),
    offset: new THREE.Vector3(-0.12, 0.38, 1).normalize().multiplyScalar(dist * 1.15),
  };
  overview();
  cur.target.copy(goal.target);
  cur.sph.copy(goal.sph);
}
