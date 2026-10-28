// 다이어그램 뷰: Quantum Neuron Block Computing 의 3D 조립판.
// No Base(초기 상태) = Topology 자체의 시스템 구조가 조립된 판. 여기서 블록을 꺼내 놓거나 단자를 다시 이어 시스템을 키운다.
// 조립이 바뀌거나 환경 값이 바뀔 때마다 시스템 전체를 계산해(blocks.js) 블록마다 양자 뉴런의 상태를 보여 준다.
// 시스템은 하나의 양자장으로 완성된다(field.js): 프랙탈 차원 D(0~4, 볼륨처럼 연속)가 장의 모양을 정하고,
// 블록을 씨앗으로 한 보로노이 다이어그램이 장을 블록들의 결정 셀로 나눈다. 연결은 선이 아니라 셀 사이 접합면이 빛나는 것이다.
// 블록 중심에는 양자 뉴런(핵과 블로흐 구)과 단자가 있다.
import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { canvas, registerView, isActive, isTyping, isUi, onViewChange } from './core.js';
import { CONTROLS, NODES } from './topology.config.js';
import { BLOCK_TYPES, SIGNALS, createBlock, canConnect, connect, removeBlock, evaluate, emptyProgram, baseProgram } from './blocks.js';
import { DIM_MIN, DIM_MAX, DEFAULT_DIM, ratio, seeds, quanta, voronoi } from './field.js';

const WATER = 0x04223a;
const TERM_R = 0.17;

export const scene = new THREE.Scene();
scene.background = new THREE.Color(WATER);
scene.fog = new THREE.FogExp2(WATER, 0.012);
scene.add(new THREE.HemisphereLight(0xbff4ff, 0x021018, 1.3));
const sun = new THREE.DirectionalLight(0xffffff, 1.5);
sun.position.set(-8, 25, 15);
scene.add(sun);

export const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 500);

const labels = new CSS2DRenderer();
labels.domElement.className = 'layer labels';
document.getElementById('stage').appendChild(labels.domElement);
labels.setSize(innerWidth, innerHeight);

const infoEl = document.getElementById('info');
const hintEl = document.getElementById('diagram-hint');
const paletteEl = document.getElementById('palette');
const nobaseEl = document.getElementById('nobase');
const dimEl = document.getElementById('dimension');

// Topology 환경과 잇는 통로 (main.js 가 채운다)
export const hooks = {
  save: () => {},            // 프로그램 저장
  dataPlaces: () => [],      // 데이터 블록이 고를 수 있는 폴더 [{ name, path }]
  folders: () => [],         // 개념 id 에 접목된 폴더 [{ name, path }]
  openFolder: () => {},      // 데스크톱 폴더 층으로 열기
  openNetwork: () => {},
  openTerminal: () => {},
  openSystem: () => {},      // 데스크톱의 QE 시스템 창
  changed: () => {},         // 평가 결과가 바뀜 (시스템 창, 작업 표시줄 갱신)
};

// --- 조립판 ---------------------------------------------------------------------
const BOARD = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

let program = emptyProgram();
let env = {};
let result = { state: new Map(), live: new Set(), system: null };

// 시스템 전체의 프랙탈 차원 D. 블록마다가 아니라 장 하나에 적용된다.
const dim = () => program.dim ?? DEFAULT_DIM;

// --- 블록 그리기: 보로노이 셀 + 중심의 양자 뉴런 핵 -----------------------------------------
const coreGeo = new THREE.IcosahedronGeometry(0.42, 0);
const termGeo = new THREE.SphereGeometry(TERM_R, 16, 12);

const views = new Map();   // blockId -> { group, core, body(셀), edges, terms, el, bloch }
const pickBodies = [];
const pickTerms = [];

// 단자 = 핵 둘레의 돌기. 입력은 왼쪽, 출력은 오른쪽
function portOffset(def, side, portId) {
  const list = def[side];
  const i = list.findIndex((p) => p.id === portId);
  const z = list.length === 1 ? 0 : (i - (list.length - 1) / 2) * 0.45;
  return new THREE.Vector3(side === 'ins' ? -0.95 : 0.95, 0, z);
}

function makeBloch(group) {
  const holder = new THREE.Group();
  holder.scale.setScalar(1.6);
  holder.add(new THREE.Mesh(new THREE.SphereGeometry(0.45, 16, 10), new THREE.MeshBasicMaterial({ color: 0x9fe8ff, wireframe: true, transparent: true, opacity: 0.22 })));
  const arrow = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1, 6).translate(0, 0.5, 0), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.16, 10), new THREE.MeshBasicMaterial({ color: 0xfff1a8 }));
  arrow.add(shaft, head);
  holder.add(arrow);
  group.add(holder);
  return { holder, arrow, shaft, head };
}

function buildBlockView(b) {
  const def = BLOCK_TYPES[b.type];
  const group = new THREE.Group();
  const core = new THREE.Mesh(coreGeo, new THREE.MeshStandardMaterial({ color: def.color, emissive: def.color, emissiveIntensity: 0.3, flatShading: true }));
  group.add(core);

  // 보로노이 셀: 반투명 결정 면 + 모서리 (모양은 shapeField 가 채운다)
  const body = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshPhysicalMaterial({
    color: def.color, emissive: def.color, emissiveIntensity: 0.15, roughness: 0.2, clearcoat: 1,
    transparent: true, opacity: 0.13, depthWrite: false, side: THREE.DoubleSide,
  }));
  body.userData = { kind: 'block', id: b.id };
  const edges = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: def.color, transparent: true, opacity: 0.7 }));
  scene.add(body, edges);
  pickBodies.push(body);

  const terms = [];
  for (const side of ['ins', 'outs']) {
    for (const p of def[side]) {
      const color = SIGNALS[p.type].color;
      const mesh = new THREE.Mesh(termGeo, new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.5 }));
      mesh.position.copy(portOffset(def, side, p.id));
      mesh.userData = { kind: 'term', id: b.id, side, port: p.id, type: p.type };
      group.add(mesh);
      pickTerms.push(mesh);
      terms.push(mesh);
    }
  }

  const el = document.createElement('div');
  el.className = 'label label-block';
  el.innerHTML = '<span class="name"></span><span class="out"></span>';
  const label = new CSS2DObject(el);
  label.position.set(0, -0.85, 0);
  label.center.set(0.5, 0);
  group.add(label);

  scene.add(group);
  return { group, core, body, edges, terms, el, bloch: def.neuron ? makeBloch(group) : null };
}

function disposeView(v) {
  scene.remove(v.group, v.body, v.edges);
  v.group.traverse((o) => { if (o.element) o.element.remove(); });
  pickBodies.splice(pickBodies.indexOf(v.body), 1);
  v.terms.forEach((t) => pickTerms.splice(pickTerms.indexOf(t), 1));
  for (const m of [v.body, v.edges]) { m.geometry.dispose(); m.material.dispose(); }
  v.core.material.dispose();
}

// --- 양자장: 프랙탈 끌개 위의 양자. 가장 가까운 블록의 셀에 속해 그 블록의 색과 신호로 빛난다 ------------
const QUANTA = 9000;
const quantaGeo = new THREE.BufferGeometry();
quantaGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(QUANTA * 3), 3));
quantaGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(QUANTA * 3), 3));
const field = new THREE.Points(quantaGeo, new THREE.PointsMaterial({ size: 0.2, vertexColors: true, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
field.frustumCulled = false;
scene.add(field);
let owners = new Int32Array(QUANTA);   // 양자 -> program.blocks 의 번호 (-1 = 블록 없음)

function paintQuanta() {
  const col = quantaGeo.attributes.color.array;
  const tint = program.blocks.map((b) => {
    const st = result.state.get(b.id);
    return new THREE.Color(BLOCK_TYPES[b.type].color).multiplyScalar(st?.status === 'ok' ? 0.45 + st.value * 0.75 : 0.18);
  });
  for (let i = 0; i < QUANTA; i++) (tint[owners[i]] ?? new THREE.Color(0x335566)).toArray(col, i * 3);
  quantaGeo.attributes.color.needsUpdate = true;
}

// --- 접합면: 연결된 두 셀이 맞닿는 보로노이 면 위에서 빛나는 판 ------------------------------
// 이웃한 셀이면 맞닿은 면(수직이등분면) 위에, 떨어져 있으면 장 속 두 셀 사이에 놓인다. 신호는 장 속을 빛으로 지나간다.
const seamGeo = new THREE.CylinderGeometry(0.62, 0.62, 0.07, 6);
const seamViews = new Map();   // wireId -> { mesh, type, from, to, curve }
const pickWires = [];

function rebuildSeams() {
  for (const v of seamViews.values()) { scene.remove(v.mesh); v.mesh.material.dispose(); }
  seamViews.clear();
  pickWires.length = 0;
  for (const w of program.wires) {
    const b = program.blocks.find((x) => x.id === w.from.block);
    const type = BLOCK_TYPES[b.type].outs.find((p) => p.id === w.from.port).type;
    const color = SIGNALS[type].color;
    const mesh = new THREE.Mesh(seamGeo, new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.4, transparent: true, opacity: 0.9 }));
    mesh.userData = { kind: 'wire', id: w.id };
    scene.add(mesh);
    pickWires.push(mesh);
    seamViews.set(w.id, { mesh, type, from: w.from.block, to: w.to.block, curve: new THREE.LineCurve3(new THREE.Vector3(), new THREE.Vector3()) });
  }
}

// D 에 따라 장 전체를 다시 세운다: 블록 씨앗, 양자, 보로노이 셀, 접합면
const UP = new THREE.Vector3(0, 1, 0);
function shapeField() {
  const D = dim();
  const pos = seeds(program, D);
  for (const [id, v] of views) v.group.position.fromArray(pos.get(id));

  const q = quanta(D, QUANTA);
  quantaGeo.attributes.position.array.set(q);
  quantaGeo.attributes.position.needsUpdate = true;
  quantaGeo.computeBoundingBox();
  const pts = program.blocks.map((b) => pos.get(b.id));
  owners = new Int32Array(QUANTA).fill(-1);
  for (let i = 0; i < QUANTA; i++) {
    let best = Infinity;
    pts.forEach((p, k) => {
      const d = (q[i * 3] - p[0]) ** 2 + (q[i * 3 + 1] - p[1]) ** 2 + (q[i * 3 + 2] - p[2]) ** 2;
      if (d < best) { best = d; owners[i] = k; }
    });
  }

  // 셀은 씨앗 쪽으로 조금 줄여 결정 알갱이 사이에 틈을 둔다
  voronoi(pts, q).forEach((verts, k) => {
    const v = views.get(program.blocks[k].id);
    v.body.geometry.dispose();
    v.edges.geometry.dispose();
    const s = pts[k];
    const shrunk = verts.map((p) => new THREE.Vector3(s[0] + (p[0] - s[0]) * 0.96, s[1] + (p[1] - s[1]) * 0.96, s[2] + (p[2] - s[2]) * 0.96));
    v.body.geometry = shrunk.length >= 4 ? new ConvexGeometry(shrunk) : new THREE.BufferGeometry();
    v.edges.geometry = new THREE.EdgesGeometry(v.body.geometry, 1);
  });

  for (const v of seamViews.values()) {
    const a = views.get(v.from).group.position, b = views.get(v.to).group.position;
    v.curve.v1.copy(a);
    v.curve.v2.copy(b);
    v.mesh.position.lerpVectors(a, b, 0.5);
    const dir = b.clone().sub(a);
    if (dir.lengthSq() > 1e-6) v.mesh.quaternion.setFromUnitVectors(UP, dir.normalize());
  }
  paintQuanta();
}

function termWorld(blockId, side, portId) {
  const b = program.blocks.find((x) => x.id === blockId);
  return portOffset(BLOCK_TYPES[b.type], side, portId).add(views.get(blockId).group.position);
}

// 신호가 흐르는 접합을 지나는 빛
const PULSES = 3, MAX_PULSES = 1800;
const pulseGeo = new THREE.BufferGeometry();
pulseGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_PULSES * 3), 3));
const pulses = new THREE.Points(pulseGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.24, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false }));
pulses.frustumCulled = false;
pulses.renderOrder = 2;
scene.add(pulses);

// 단자를 끌 때 따라오는 임시 선 (잇는 동안만 보인다)
const ghost = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 }));
ghost.visible = false;
scene.add(ghost);

// --- 조립이나 환경이 바뀔 때마다 ----------------------------------------------------
function refresh(save = true) {
  const ids = new Set(program.blocks.map((b) => b.id));
  for (const [id, v] of views) if (!ids.has(id)) { disposeView(v); views.delete(id); }
  for (const b of program.blocks) {
    if (!views.has(b.id)) views.set(b.id, buildBlockView(b));
  }
  rebuildSeams();
  shapeField();
  result = evaluate(program, env);
  if (save) delete program.nobase;   // 손대면 더 이상 초기 상태가 아니다

  for (const b of program.blocks) {
    const v = views.get(b.id);
    const st = result.state.get(b.id) ?? { status: 'idle' };
    v.el.querySelector('.name').textContent = b.name;
    v.el.dataset.status = st.status;
    v.el.querySelector('.out').textContent = st.status === 'ok' ? `${Math.round(st.value * 100)}%` : st.status === 'idle' ? '대기' : '오류';
    v.body.material.emissiveIntensity = st.status === 'ok' ? 0.1 + st.value * 0.6 : 0.02;
    v.body.material.color.set(st.status === 'error' ? 0xa83a3a : st.status === 'idle' ? 0x4a5866 : BLOCK_TYPES[b.type].color);
    v.core.material.color.copy(v.body.material.color);
    v.core.material.emissiveIntensity = st.status === 'ok' ? 0.2 + st.value * 0.9 : 0.05;
    if (v.bloch) {
      v.bloch.holder.visible = !!st.bloch;
      if (st.bloch) {
        const d = new THREE.Vector3(st.bloch[0], st.bloch[2], st.bloch[1]);   // 블로흐 z → 위
        const len = d.length() * 0.45;
        v.bloch.arrow.visible = len > 0.03;
        if (v.bloch.arrow.visible) {
          v.bloch.arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
          v.bloch.shaft.scale.y = Math.max(len - 0.1, 0.01);
          v.bloch.head.position.y = Math.max(len - 0.05, 0.05);
        }
      }
    }
  }

  paintQuanta();
  nobaseEl.hidden = !program.nobase || !isActive(view);
  renderDimension();
  renderPaletteStatus();
  renderInfo();
  hooks.changed(snapshot());
  if (save) hooks.save(program);
}

export function setEnv(next) {
  env = next;
  refresh(false);
}

// 데스크톱의 QE 시스템 창과 작업 표시줄이 읽는 요약
export function snapshot() {
  return {
    system: result.system,
    blocks: program.blocks.map((b) => {
      const st = result.state.get(b.id) ?? { status: 'idle' };
      return { name: b.name, type: BLOCK_TYPES[b.type].label, status: st.status, value: st.value, msg: st.msg };
    }),
  };
}

// --- 팔레트 (블록 꺼내기) ----------------------------------------------------------
function h(tag, props = {}, ...children) {
  const el = Object.assign(document.createElement(tag), props);
  el.append(...children);
  return el;
}
const hex = (c) => `#${c.toString(16).padStart(6, '0')}`;
const termDots = (ports) => (ports.length ? ports.map((p) => {
  const dot = h('span', { className: 'sig', textContent: p.label + (p.optional ? '?' : '') });
  dot.style.setProperty('--sig', hex(SIGNALS[p.type].color));
  return dot;
}) : [h('span', { className: 'sig none', textContent: '—' })]);

function buildPalette() {
  const groups = [...new Set(Object.values(BLOCK_TYPES).map((d) => d.group))];
  const sections = groups.map((g) => h('div', { className: 'palette-group' },
    h('div', { className: 'palette-group-name', textContent: g }),
    ...Object.entries(BLOCK_TYPES).filter(([, d]) => d.group === g).map(([type, def]) => {
      const item = h('div', { className: 'palette-item', draggable: true, title: `${def.help}\n\n클릭하거나 판 위로 끌어다 놓기` },
        h('span', { className: 'chip' }),
        h('div', { className: 'palette-body' },
          h('strong', { textContent: def.label }),
          h('div', { className: 'terms' }, ...termDots(def.ins), h('span', { className: 'arrow', textContent: '→' }), ...termDots(def.outs))));
      item.querySelector('.chip').style.background = hex(def.color);
      item.addEventListener('click', () => addBlock(type));
      item.addEventListener('dragstart', (e) => e.dataTransfer.setData('text/plain', `block:${type}`));
      return item;
    })));
  const clear = h('button', { className: 'clear', textContent: '↺ 초기 구조로 (No Base)' });
  clear.addEventListener('click', () => {
    if (!program.nobase && confirm('지금 조립을 지우고 Topology 초기 시스템 구조(No Base)로 돌아갈까요?')) {
      program = { ...baseProgram({ path: hooks.dataPlaces()[0]?.path }), dim: dim() };
      select(null);
      refresh(false);
      hooks.save(program);
      overview();
    }
  });
  paletteEl.replaceChildren(
    h('div', { className: 'palette-title', textContent: '양자 뉴런 블록' }),
    h('div', { className: 'palette-sub', textContent: '기능 모듈을 꺼내면 결정에 맞물립니다. 윗면의 같은 색 단자끼리 이으세요' }),
    ...sections,
    h('div', { className: 'palette-status' }),
    clear,
  );
}

function renderPaletteStatus() {
  const el = paletteEl.querySelector('.palette-status');
  if (!el) return;
  el.textContent = `블록 ${program.blocks.length} · 연결 ${program.wires.length} · 시스템 `
    + (result.system === null ? '— (Topology 블록에 아직 닿지 않음)' : `${Math.round(result.system * 100)}%`);
}

// --- 프랙탈 차원: 볼륨처럼 0 ~ 4 를 연속으로 올리고 내린다 ------------------------------------
function buildDimension() {
  const input = h('input', { type: 'range', min: DIM_MIN, max: DIM_MAX, step: 0.01, value: dim() });
  input.addEventListener('input', () => setDimension(Number(input.value), false));
  input.addEventListener('change', () => hooks.save(program));
  dimEl.replaceChildren(
    h('div', { className: 'dims-row' }, h('span', { className: 'dims-d' }), input),
    h('div', { className: 'dims-ticks' }, ...['0 점', '1', '2', '3', '4 초입방체'].map((t) => h('span', { textContent: t }))),
    h('div', { className: 'dims-note' }),
  );
}

function renderDimension() {
  const D = dim(), r = ratio(D);
  const input = dimEl.querySelector('input');
  if (input && document.activeElement !== input) input.value = D;
  dimEl.querySelector('.dims-d').textContent = `D = ${D.toFixed(2)}`;
  dimEl.querySelector('.dims-note').textContent =
    `프랙탈 — 초입방체 16조각 자기복제 · 축척 r = ${r.toFixed(3)} · D = log16 / log(1/r)\n보로노이 — 양자장을 블록 셀로 나눈다`;
}

export function setDimension(d, save = true) {
  program.dim = THREE.MathUtils.clamp(d, DIM_MIN, DIM_MAX);
  shapeField();   // 차원은 조립이 아니라 장의 사양이다 — No Base 는 그대로
  renderDimension();
  if (save) hooks.save(program);
}

// 새 블록은 결정이 알아서 빈 격자점에 맞물린다
function addBlock(type) {
  const b = createBlock(type, program, 0, 0, { path: hooks.dataPlaces()[0]?.path });
  program.blocks.push(b);
  select({ kind: 'block', id: b.id });
  refresh();
}

canvas.addEventListener('dragover', (e) => { if (isActive(view)) e.preventDefault(); });
canvas.addEventListener('drop', (e) => {
  const data = e.dataTransfer.getData('text/plain');
  if (!isActive(view) || !data.startsWith('block:')) return;
  e.preventDefault();
  addBlock(data.slice(6));
});

// --- 선택과 정보 패널 -------------------------------------------------------------
let selected = null;   // { kind: 'block' | 'wire', id }

function select(sel) {
  selected = sel;
  renderInfo();
}

function renderInfo() {
  if (!selected || !isActive(view)) { infoEl.hidden = true; return; }
  const button = (text, fn, title = '') => {
    const b = h('button', { textContent: text, title });
    b.addEventListener('click', fn);
    return b;
  };

  if (selected.kind === 'wire') {
    const w = program.wires.find((x) => x.id === selected.id);
    if (!w) { infoEl.hidden = true; return; }
    const name = (id) => program.blocks.find((b) => b.id === id).name;
    infoEl.hidden = false;
    infoEl.replaceChildren(
      h('div', { className: 'kind', textContent: `접합 · ${SIGNALS[seamViews.get(w.id)?.type ?? 'data'].label} 신호` }),
      h('strong', { textContent: `${name(w.from.block)} → ${name(w.to.block)}` }),
      h('p', { className: 'dim', textContent: result.live.has(w.id) ? '신호가 흐르는 중' : '앞쪽 블록이 대기 중이라 아직 신호가 없다' }),
      h('div', { className: 'actions' }, button('연결 끊기', () => { program.wires = program.wires.filter((x) => x !== w); select(null); refresh(); })),
    );
    return;
  }

  const b = program.blocks.find((x) => x.id === selected.id);
  if (!b) { infoEl.hidden = true; return; }
  const def = BLOCK_TYPES[b.type];
  const st = result.state.get(b.id) ?? { status: 'idle' };
  infoEl.hidden = false;

  const name = h('input', { value: b.name, spellcheck: false });
  name.addEventListener('change', () => { b.name = name.value.trim() || def.label; refresh(); });

  // 데이터 블록: 실제 폴더 고르기
  const params = [];
  if (b.type === 'data') {
    const sel = h('select', {}, ...hooks.dataPlaces().map((p) => h('option', { value: p.path, textContent: `${p.name} — ${p.path}`, selected: p.path === b.path })));
    sel.addEventListener('change', () => { b.path = sel.value; hooks.save(program); hooks.needData(b.path); });
    params.push(h('label', { className: 'param' }, h('span', { className: 'dim', textContent: '데이터 폴더' }), sel));
  }

  const lines = [];
  if (st.status === 'ok') lines.push(`신호 세기 ${(st.value * 100).toFixed(0)}%`);
  for (const i of st.inputs ?? []) lines.push(`  ← ${i.label} ${(i.value * 100).toFixed(0)}%`);
  if (st.bloch) {
    const r = Math.hypot(...st.bloch);
    lines.push(`양자 뉴런 블로흐 (${st.bloch.map((v) => v.toFixed(2)).join(', ')})${r < 0.95 ? `  얽힘 ${((1 - r) * 100).toFixed(0)}%` : ''}`);
  }
  if (st.msg) lines.push(st.msg);

  // Topology 환경으로 가는 통로
  const links = [];
  if (b.type === 'data' && b.path) links.push(button('📁 폴더 층 열기', () => hooks.openFolder(b.path), '데스크톱에서 이 폴더 층을 연다'));
  if (['wifi', 'vpn', 'network', 'bigdata'].includes(b.type)) links.push(button('📶 네트워크 창', () => hooks.openNetwork()));
  if (b.type === 'instrument') links.push(button('⌨ 터미널', () => hooks.openTerminal()));
  if (b.type === 'topology') links.push(button('▣ 데스크톱에서 시스템 보기', () => hooks.openSystem()));
  for (const f of hooks.folders(def.concept)) links.push(button(`📁 ${f.name}`, () => hooks.openFolder(f.path), f.path));
  const desc = NODES.find((n) => n.id === def.concept)?.desc;

  // 이 셀의 접합: 누르면 끊는다
  const blockName = (id) => program.blocks.find((x) => x.id === id)?.name;
  const joins = program.wires.filter((w) => w.from.block === b.id || w.to.block === b.id).map((w) => {
    const out = w.from.block === b.id;
    return button(`${out ? '→' : '←'} ${blockName(out ? w.to.block : w.from.block)} ✕`,
      () => { program.wires = program.wires.filter((x) => x !== w); refresh(); }, '이 접합 끊기');
  });

  infoEl.replaceChildren(
    h('div', { className: 'kind', textContent: `${def.group} · ${def.label} 블록` }),
    name,
    h('div', { className: 'terms' }, h('span', { className: 'dim', textContent: '단자 ' }), ...termDots(def.ins), h('span', { className: 'arrow', textContent: '→' }), ...termDots(def.outs)),
    h('p', { textContent: def.help }),
    ...(desc ? [h('p', { className: 'dim', textContent: desc })] : []),
    ...params,
    h('div', { className: `live status-${st.status}`, textContent: lines.join('\n') }),
    ...(joins.length ? [h('div', { className: 'dim', textContent: '접합 (누르면 끊기)' }), h('div', { className: 'actions' }, ...joins)] : []),
    ...(links.length ? [h('div', { className: 'dim', textContent: 'Topology 환경' }), h('div', { className: 'actions' }, ...links)] : []),
    h('div', { className: 'actions' }, button('블록 지우기', () => { removeBlock(program, b.id); select(null); refresh(); })),
  );
}

// --- 카메라 -------------------------------------------------------------------
const HOME = { target: new THREE.Vector3(0, 0, 0), offset: new THREE.Vector3(0, 0.55, 1).normalize().multiplyScalar(26) };
const goal = { target: HOME.target.clone(), sph: new THREE.Spherical().setFromVector3(HOME.offset) };
const cur = { target: HOME.target.clone(), sph: goal.sph.clone() };

export function overview() {
  goal.sph.setFromVector3(HOME.offset);
  if (!program.blocks.length) { goal.target.copy(HOME.target); return; }
  const box = new THREE.Box3();
  views.forEach((v) => box.expandByPoint(v.group.position));
  box.union(quantaGeo.boundingBox);
  goal.target.copy(box.getCenter(new THREE.Vector3()));
  goal.sph.radius = Math.max(14, box.getSize(new THREE.Vector3()).length() * 1.6);
  // 왼쪽 팔레트에 가리지 않게 중심을 조금 왼쪽으로 잡아 블록이 화면 오른쪽에 오게 한다
  goal.target.x -= goal.sph.radius * 0.17;
}

// --- 마우스 ---------------------------------------------------------------------
// 블록 자리는 결정이 정한다. 단자 드래그 = 잇기, 왼쪽 드래그 = 회전, 오른쪽 드래그 = 이동,
// 스크롤 = 다가가기/물러나기, 클릭 = 선택, Delete = 선택한 블록·연결 지우기.
const raycaster = new THREE.Raycaster();
function ray(e) {
  raycaster.setFromCamera(new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1), camera);
  return raycaster;
}
function boardPoint(e, y = 0) {
  return ray(e).ray.intersectPlane(y ? new THREE.Plane(BOARD.normal, -y) : BOARD, new THREE.Vector3());
}
function pickAt(e, list) {
  return ray(e).intersectObjects(list, false)[0]?.object.userData ?? null;
}

let drag = null;
let hoverTerm = null;

function compatible(from, t) {
  if (!t || t.side === from.side || t.id === from.id) return false;
  const [o, i] = from.side === 'outs' ? [from, t] : [t, from];
  return canConnect(program, { block: o.id, port: o.port }, { block: i.id, port: i.port });
}

function highlightTerms(from) {
  for (const m of pickTerms) {
    const ok = from && compatible(from, m.userData);
    m.scale.setScalar(ok ? 1.7 : 1);
    m.material.emissiveIntensity = ok ? 1.5 : from ? 0.1 : 0.5;
  }
}

canvas.addEventListener('contextmenu', (e) => { if (isActive(view)) e.preventDefault(); });
canvas.addEventListener('pointerdown', (e) => {
  if (!isActive(view)) return;
  canvas.setPointerCapture(e.pointerId);
  if (e.button === 2) { drag = { mode: 'pan', moved: 0 }; return; }
  if (e.button === 1) { drag = { mode: 'zoom', moved: 0 }; return; }
  const term = pickAt(e, pickTerms);
  if (term) {
    drag = { mode: 'wire', from: term, moved: 0 };
    highlightTerms(term);
    return;
  }
  drag = { mode: 'orbit', moved: 0, block: pickAt(e, pickBodies)?.id };
});

canvas.addEventListener('pointermove', (e) => {
  if (!isActive(view)) return;
  if (!drag) {
    const t = pickAt(e, pickTerms);
    const b = !t && pickAt(e, pickBodies);
    canvas.style.cursor = t ? 'crosshair' : b ? 'pointer' : 'grab';
    return;
  }
  drag.moved += Math.abs(e.movementX) + Math.abs(e.movementY);
  if (drag.mode === 'orbit') {
    goal.sph.theta -= e.movementX * CONTROLS.orbitSensitivity;
    goal.sph.phi = THREE.MathUtils.clamp(goal.sph.phi - e.movementY * CONTROLS.orbitSensitivity, 0.15, Math.PI / 2 - 0.05);
  } else if (drag.mode === 'pan') {
    const k = cur.sph.radius * 0.0016;
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).setY(0).normalize();
    goal.target.addScaledVector(right, -e.movementX * k).addScaledVector(fwd, e.movementY * k);
  } else if (drag.mode === 'zoom') {
    goal.sph.radius = THREE.MathUtils.clamp(goal.sph.radius * Math.exp(e.movementY * 0.01), 5, 120);
  } else if (drag.mode === 'wire') {
    const t = pickAt(e, pickTerms);
    hoverTerm = compatible(drag.from, t) ? t : null;
    const a = termWorld(drag.from.id, drag.from.side, drag.from.port);
    const b = hoverTerm ? termWorld(hoverTerm.id, hoverTerm.side, hoverTerm.port) : (boardPoint(e, a.y) ?? a.clone());
    const [s, d] = drag.from.side === 'outs' ? [a, b] : [b, a];
    ghost.geometry.dispose();
    ghost.geometry = new THREE.TubeGeometry(new THREE.LineCurve3(s, d), 1, 0.05, 6, false);
    ghost.material.color.set(SIGNALS[drag.from.type].color);
    ghost.visible = true;
  }
});

canvas.addEventListener('pointerup', (e) => {
  if (!isActive(view) || !drag) return;
  const d = drag;
  drag = null;
  if (d.mode === 'wire') {
    ghost.visible = false;
    highlightTerms(null);
    if (hoverTerm) {
      const [o, i] = d.from.side === 'outs' ? [d.from, hoverTerm] : [hoverTerm, d.from];
      connect(program, { block: o.id, port: o.port }, { block: i.id, port: i.port });
      refresh();
    } else if (d.moved < 4) {
      select({ kind: 'block', id: d.from.id });
    }
    hoverTerm = null;
  } else if (d.mode === 'orbit' && d.moved < 4) {
    const w = pickAt(e, pickWires);
    select(d.block ? { kind: 'block', id: d.block } : w ? { kind: 'wire', id: w.id } : null);
  }
});

canvas.addEventListener('dblclick', (e) => {
  if (!isActive(view)) return;
  const body = pickAt(e, pickBodies);
  if (body) {
    goal.target.copy(views.get(body.id).group.position);
    goal.sph.radius = 10;
  } else overview();
});

addEventListener('wheel', (e) => {
  if (!isActive(view) || isUi(e.target)) return;
  e.preventDefault();
  const delta = THREE.MathUtils.clamp(e.deltaY || e.deltaX, -200, 200);
  goal.sph.radius = THREE.MathUtils.clamp(goal.sph.radius * Math.exp(delta * 0.0012 * (e.shiftKey ? CONTROLS.fineFactor : 1)), 5, 120);
}, { passive: false });

addEventListener('keydown', (e) => {
  if (!isActive(view) || isTyping(e.target)) return;
  if ((e.code === 'Delete' || e.code === 'Backspace') && selected) {
    if (selected.kind === 'block') removeBlock(program, selected.id);
    else program.wires = program.wires.filter((w) => w.id !== selected.id);
    select(null);
    refresh();
  }
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

  // 양자장은 시스템 값만큼 요동한다
  field.material.opacity = 0.55 + 0.25 * (result.system ?? 0) * (0.5 + 0.5 * Math.sin(t * 2.4));

  const arr = pulseGeo.attributes.position.array;
  let n = 0;
  for (const [id, v] of seamViews) {
    if (!result.live.has(id)) continue;
    for (let p = 0; p < PULSES && n < MAX_PULSES; p++, n++) {
      v.curve.getPointAt((t * 0.45 + p / PULSES) % 1, tmp).toArray(arr, n * 3);
    }
  }
  pulseGeo.setDrawRange(0, n);
  pulseGeo.attributes.position.needsUpdate = true;

  for (const [id, v] of views) v.el.classList.toggle('selected', selected?.kind === 'block' && selected.id === id);
  for (const [id, v] of seamViews) {
    v.mesh.material.emissiveIntensity = selected?.kind === 'wire' && selected.id === id ? 1.6 : result.live.has(id) ? 0.6 + 0.3 * Math.sin(t * 3) : 0.08;
  }
}

const view = {
  scene, camera,
  layers: [labels.domElement, hintEl, paletteEl, dimEl],
  update,
  render: () => labels.render(scene, camera),
  resize: () => labels.setSize(innerWidth, innerHeight),
  status: () => (program.nobase ? `No Base · D ${dim().toFixed(2)}`
    : `D ${dim().toFixed(2)} · 블록 ${program.blocks.length} · 시스템 ${result.system === null ? '—' : `${Math.round(result.system * 100)}%`}`),
};
registerView('diagram', view);
onViewChange((name) => {
  infoEl.hidden = name !== 'diagram' || !selected;
  nobaseEl.hidden = name !== 'diagram' || !program.nobase;
});

export function build(saved, initialEnv) {
  // 손대지 않은 No Base 는 지금의 초기 구조로 다시 만든다
  program = saved.blocks.length && !saved.nobase ? saved
    : { ...baseProgram({ path: hooks.dataPlaces()[0]?.path }), ...(saved.dim !== undefined ? { dim: saved.dim } : {}) };
  env = initialEnv;
  buildPalette();
  buildDimension();
  refresh(false);
  overview();
  cur.target.copy(goal.target);
  cur.sph.copy(goal.sph);
}
