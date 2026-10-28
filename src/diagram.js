// 다이어그램 뷰: Quantum Neuron Block Computing 의 3D 조립판.
// No Base(초기 상태) = Topology 자체의 시스템 구조가 조립된 판. 여기서 블록을 꺼내 놓거나 단자를 다시 이어 시스템을 키운다.
// 조립이 바뀌거나 환경 값이 바뀔 때마다 시스템 전체를 계산해(blocks.js) 블록마다 양자 뉴런의 상태를 보여 준다.
// 시스템 구조는 보로노이 영역 개척으로 완성된다(field.js): 블록마다 씨앗에서 자기 영역을 개척하고, 그 영역이 곧
// 양자 아날로그 뉴런 블록이다 — 물리(맞물린 덩어리)와 수학(영역 분할) 사이의 다리. 영역의 크기 배수는 차원 D 를 지수로
// 계산한다(λ^D). 연결은 선이 아니라 두 영역이 맞닿는 접합면이 빛나는 것이다. 영역 중심에 양자 뉴런 핵과 단자가 있다.
// 폴더와 파일도 양자 아날로그 뉴런 블록이다: 블록 영역 안에서 같은 차원 법칙으로 다시 영역을 개척한다(영역 안의 영역).
// 영역 안은 블록의 신호만큼 양자 에너지 장이 찬다. 씨앗은 질량이어서(physics.js) 블록을 끌면 회로가 유기체처럼 따라온다.
// 블록을 끌어 다른 블록에 맞대면 접촉면으로 결합(조립)된다. 조립한 결과가 곧 물리 설계도다 — 재료, 치수(mm), 질량,
// 접촉 패드·브리지, 컨덕턴스, 지연 (Quantum Analog Neuron Core 설계의 바탕).
import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { canvas, registerView, isActive, isTyping, isUi, onViewChange } from './core.js';
import { CONTROLS, NODES, PHYSICAL } from './topology.config.js';
import { BLOCK_TYPES, SIGNALS, createBlock, canConnect, connect, removeBlock, evaluate, emptyProgram, baseProgram, quantumNeuron } from './blocks.js';
import { DIM_LIMIT, DEFAULT_DIM, ratio, toSlider, fromSlider, seeds, pathSeeds, voronoi, inset, inradius, energy, flowOrder } from './field.js';
import { Physics } from './physics.js';

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
const designEl = document.getElementById('design');

// Topology 환경과 잇는 통로 (main.js 가 채운다)
export const hooks = {
  save: () => {},            // 프로그램 저장
  dataPlaces: () => [],      // 데이터 블록이 고를 수 있는 폴더 [{ name, path }]
  folders: () => [],         // 개념 id 에 접목된 폴더 [{ name, path }]
  openFolder: () => {},      // 데스크톱 폴더 층으로 열기
  openNetwork: () => {},
  openTerminal: () => {},
  openSystem: () => {},      // 데스크톱의 QE 시스템 창
  listDir: async () => ({ entries: [], total: 0 }),   // 폴더 안의 항목
  openFile: () => {},        // 파일을 기본 앱으로
  saveDesign: async () => '',   // 물리 설계도 저장 -> 저장한 경로
  changed: () => {},         // 평가 결과가 바뀜 (시스템 창, 작업 표시줄 갱신)
};

// --- 조립판 ---------------------------------------------------------------------
const BOARD = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

let program = emptyProgram();
let env = {};
let result = { state: new Map(), live: new Set(), system: null };

// 시스템 전체의 차원 D. 블록마다가 아니라 구조 하나에 적용된다.
const dim = () => program.dim ?? DEFAULT_DIM;
let measures = new Map();          // blockId -> { k, scale: 선형 축척 λ, size: 크기 배수 λ^D }
const fieldBox = new THREE.Box3();   // 개척된 영역 전체
const phys = new Physics();
let cellPlanes = new Map();          // blockId -> 영역 경계 평면 (안쪽 폴더·파일 영역의 바깥 경계)
let cellInfo = new Map();            // blockId -> { verts, faces, volume, area } — 물리 설계의 바탕
let settling = false;                // 물리가 움직이는 중이면 안쪽 영역은 따라 옮기기만 하고, 멈추면 다시 개척한다

// --- 블록 그리기: 보로노이 셀 + 중심의 양자 뉴런 핵 -----------------------------------------
const coreGeo = new THREE.IcosahedronGeometry(0.42, 0);
const termGeo = new THREE.SphereGeometry(TERM_R, 16, 12);

const views = new Map();   // blockId -> { group, core, body(영역 블록), terms, el, bloch, grow, wait }
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

  // 개척한 영역 = 블록: 씨앗을 중심으로 한 볼록 다면체 덩어리와 그 모서리 (모양은 layoutCells 가 채운다)
  const body = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshPhysicalMaterial({
    color: def.color, emissive: def.color, emissiveIntensity: 0.15, roughness: 0.3, clearcoat: 1, flatShading: true,
    transparent: true, opacity: 0.42, depthWrite: false,
  }));
  body.userData = { kind: 'block', id: b.id };
  body.add(new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xe8fbff, transparent: true, opacity: 0.75 })));
  scene.add(body);
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
  return { group, core, body, terms, el, bloch: def.neuron ? makeBloch(group) : null, grow: 1, wait: 0 };
}

function disposeView(v) {
  scene.remove(v.group, v.body);
  v.group.traverse((o) => { if (o.element) o.element.remove(); });
  pickBodies.splice(pickBodies.indexOf(v.body), 1);
  v.terms.forEach((t) => pickTerms.splice(pickTerms.indexOf(t), 1));
  for (const m of [v.body, v.body.children[0]]) { m.geometry.dispose(); m.material.dispose(); }
  v.core.material.dispose();
}

// 영역 개척: 신호 순서대로 씨앗에서 영역이 자라나 이웃 영역과 만나는 경계까지 넓어진다
function pioneer(ids) {
  const order = flowOrder(program);
  for (const id of ids) {
    const v = views.get(id);
    if (!v) continue;
    v.grow = 0;
    v.wait = ids.length > 1 ? order.indexOf(id) * 0.18 : 0;
    v.born = null;   // 다음 프레임의 시각부터 잰다
  }
}

// --- 접합면: 연결된 두 영역이 맞닿는 보로노이 면 위에서 빛나는 판 -----------------------------
// 이웃한 영역이면 맞닿은 면(수직이등분면) 위에, 떨어져 있으면 구조 속 두 영역 사이에 놓인다. 신호는 구조 속을 빛으로 지나간다.
const seamGeo = new THREE.CylinderGeometry(0.62, 0.62, 0.07, 6);
const seamViews = new Map();   // wireId -> { mesh, type, from, to, curve }
const pickWires = [];

function rebuildSeams() {
  for (const v of seamViews.values()) { scene.remove(v.mesh); v.mesh.material.dispose(); if (v.pad) v.mesh.geometry.dispose(); }
  seamViews.clear();
  pickWires.length = 0;
  for (const w of program.wires) {
    const b = program.blocks.find((x) => x.id === w.from.block);
    const type = BLOCK_TYPES[b.type].outs.find((p) => p.id === w.from.port).type;
    const color = SIGNALS[type].color;
    const mesh = new THREE.Mesh(seamGeo, new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.4, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
    mesh.userData = { kind: 'wire', id: w.id };
    scene.add(mesh);
    pickWires.push(mesh);
    seamViews.set(w.id, { mesh, type, wire: w, from: w.from.block, to: w.to.block, pad: false, curve: new THREE.LineCurve3(new THREE.Vector3(), new THREE.Vector3()) });
  }
}

// --- 영역 다면체 -------------------------------------------------------------------
// 영역은 씨앗 쪽으로 조금 줄여 블록 사이에 틈을 둔다 (맞물린 덩어리로 보이게). 모양은 씨앗 기준 지역 좌표.
function setCell(mesh, seed, verts, shrink) {
  const local = verts.map((q) => new THREE.Vector3((q[0] - seed[0]) * shrink, (q[1] - seed[1]) * shrink, (q[2] - seed[2]) * shrink));
  mesh.geometry.dispose();
  mesh.children[0].geometry.dispose();
  mesh.geometry = local.length >= 4 ? new ConvexGeometry(local) : new THREE.BufferGeometry();
  mesh.children[0].geometry = new THREE.EdgesGeometry(mesh.geometry, 1);
  mesh.position.fromArray(seed);
}

// 수학 자리: 차원 D 의 씨앗 + 사용자가 끌어 옮겨 둔 만큼(b.off). 물리는 이 자리로 당긴다.
// 질량 = 부피 × 밀도, 연결 강성 = 접촉면 넓이 (지난 개척 결과로 잰다). 평균을 1 로 맞춘 상대값.
function computeRest() {
  measures = seeds(program, dim());
  const grams = new Map(program.blocks.map((b) => [b.id, physicalMass(b)]));
  const meanG = [...grams.values()].reduce((a, g) => a + g, 0) / Math.max(grams.size, 1) || 1;
  const areas = program.wires.map((w) => contactFace(w)?.area ?? 0);
  const meanA = areas.filter((a) => a > 0).reduce((a, x, _, l) => a + x / l.length, 0) || 1;
  phys.sync(
    new Map(program.blocks.map((b) => [b.id, measures.get(b.id).p.map((v, i) => v + (b.off?.[i] ?? 0))])),
    program.wires.map((w, i) => [w.from.block, w.to.block, THREE.MathUtils.clamp(areas[i] / meanA, 0.3, 3)]),
    new Map([...grams].map(([id, g]) => [id, THREE.MathUtils.clamp(g / meanG || 1, 0.3, 3)])),
  );
}

// --- 물리 설계: 재료, 치수, 질량, 접촉 ----------------------------------------------------
const CM = PHYSICAL.unitMM / 10;                     // 화면 1 = CM cm
const materialOf = (b) => PHYSICAL.materials[BLOCK_TYPES[b.type].group] ?? { name: '—', density: 1 };
const physicalMass = (b) => (cellInfo.get(b.id)?.volume ?? 0) * CM ** 3 * materialOf(b).density;   // g
const blockIndex = (id) => program.blocks.findIndex((x) => x.id === id);
// 두 블록이 맞닿은 면 (없으면 떨어져 있어 브리지가 필요)
const contactFace = (w) => cellInfo.get(w.from.block)?.faces.find((f) => f.j === blockIndex(w.to.block));

// --- 폴더·파일 블록 ----------------------------------------------------------------
// 블록이 다루는 폴더(데이터 = 고른 폴더의 항목, 그 밖 = 개념에 접목된 폴더)가 블록 영역 안의 영역이 된다.
// 폴더 블록을 펼치면 그 안의 항목이 다시 그 영역 안을 개척한다. 각 항목은 양자 뉴런 하나를 갖는다(크기·항목 수가 입력).
const NODE_LIMIT = 24;
const nodes = new Map();   // key -> { key, owner, parent, path, name, dir, size, total, kids, open, view, local }
const roots = new Map();   // blockId -> [key]
const pickNodes = [];
const KIND = [
  [/\.(png|jpe?g|gif|svg|webp|bmp|mp4|mkv|webm|avi|mov)$/i, 'graphic'],
  [/\.(mp3|wav|flac|ogg|m4a)$/i, 'qe'],
  [/\.(md|txt|pdf|docx?|odt|rtf|csv)$/i, 'instrument'],
  [/\.(js|ts|py|c|cpp|h|java|rs|go|sh|json|html|css)$/i, 'ai'],
  [/\.(zip|tar|gz|xz|7z|rar|deb|iso)$/i, 'bigdata'],
];
const nodeColor = (n) => (n.dir ? 0x9fe8ff : BLOCK_TYPES[KIND.find(([re]) => re.test(n.name))?.[1] ?? 'data'].color);
const nodeValue = (n) => quantumNeuron([Math.min(1, n.dir ? Math.log10((n.total ?? 30) + 1) / 3 : Math.log10(n.size + 1) / 9)]).value;
const shortName = (s) => (s.length > 16 ? `${s.slice(0, 15)}…` : s);

function addNode(owner, parent, e) {
  const key = `${owner}|${e.path}`;
  if (nodes.has(key)) return key;
  const n = { key, owner, parent, path: e.path, name: e.name, dir: e.dir, size: e.size ?? 0, total: null, kids: null, open: false, local: null };
  const color = nodeColor(n);
  const body = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshPhysicalMaterial({
    color, emissive: color, emissiveIntensity: 0.1 + nodeValue(n) * 0.5, roughness: 0.3, clearcoat: 1, flatShading: true,
    transparent: true, opacity: 0.5, depthWrite: false,
  }));
  body.userData = { kind: 'node', key };
  body.add(new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xe8fbff, transparent: true, opacity: 0.45 })));
  const el = document.createElement('div');
  el.className = 'label label-node';
  el.textContent = `${n.dir ? '📁 ' : ''}${shortName(n.name)}`;
  body.add(new CSS2DObject(el));
  body.visible = false;   // 처음 개척될 때 보인다
  scene.add(body);
  pickNodes.push(body);
  n.view = { body, el };
  nodes.set(key, n);
  return key;
}

function dropNode(key) {
  const n = nodes.get(key);
  if (!n) return;
  n.kids?.forEach(dropNode);
  n.view.body.traverse((o) => { if (o.element) o.element.remove(); });
  scene.remove(n.view.body);
  for (const m of [n.view.body, n.view.body.children[0]]) { m.geometry.dispose(); m.material.dispose(); }
  pickNodes.splice(pickNodes.indexOf(n.view.body), 1);
  nodes.delete(key);
  if (selected?.kind === 'node' && selected.key === key) selected = null;
}

async function loadKids(owner, parentKey, path) {
  const res = await hooks.listDir(path, { limit: NODE_LIMIT });
  if (!program.blocks.some((b) => b.id === owner)) return;
  const keys = (res.entries ?? []).map((e) => addNode(owner, parentKey, e));
  const parent = parentKey && nodes.get(parentKey);
  if (parentKey && !parent) return;
  if (parent) { parent.kids = keys; parent.total = res.total; } else roots.set(owner, keys);
  layoutCells(true);
  renderInfo();
}

function ensureRoots() {
  for (const id of [...roots.keys()]) {
    if (!program.blocks.some((b) => b.id === id)) { roots.get(id).forEach(dropNode); roots.delete(id); }
  }
  for (const b of program.blocks) {
    if (roots.has(b.id)) continue;
    roots.set(b.id, []);
    if (b.type === 'data') { if (b.path) loadKids(b.id, null, b.path); }
    else roots.set(b.id, hooks.folders(BLOCK_TYPES[b.type].concept).map((f) => addNode(b.id, null, { name: f.name, path: f.path, dir: true })));
  }
}

function resetRoots(blockId) {
  roots.get(blockId)?.forEach(dropNode);
  roots.delete(blockId);
  ensureRoots();
}

function toggleFolder(key) {
  const n = nodes.get(key);
  if (!n?.dir) return;
  if (n.open) {
    n.kids?.forEach(dropNode);
    n.kids = null;
    n.open = false;
    layoutCells(true);
  } else {
    n.open = true;
    loadKids(n.owner, key, n.path);
  }
  renderInfo();
}

// 부모 영역(씨앗, 경계) 안을 같은 차원 법칙으로 다시 나눈다
function layoutNodes(owner, seed, planes, keys) {
  if (!keys?.length || !planes) return;
  const r = Math.max(0.05, inradius(seed, planes));
  const pts = pathSeeds(keys.length, dim()).points.map((q) => q.map((v, i) => seed[i] + v * r * 0.75));
  const cells = voronoi(pts, inset(planes, Math.min(0.12, r * 0.1)));
  const base = phys.pos(owner);
  keys.forEach((key, k) => {
    const n = nodes.get(key);
    if (!n) return;
    setCell(n.view.body, pts[k], cells[k].verts, 0.9);
    n.local = pts[k].map((v, i) => v - base[i]);   // 블록이 움직이면 이만큼 떨어져 따라간다
    if (n.open) layoutNodes(owner, pts[k], cells[k].planes, n.kids);
  });
}

// --- 양자 에너지 장: 영역마다 그 블록의 신호만큼 찬다 ----------------------------------------
const ENERGY = 6000;
const energyGeo = new THREE.BufferGeometry();
energyGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(ENERGY * 3), 3));
energyGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(ENERGY * 3), 3));
const energyField = new THREE.Points(energyGeo, new THREE.PointsMaterial({ size: 0.13, vertexColors: true, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
energyField.frustumCulled = false;
scene.add(energyField);

function fillEnergy(cells) {
  const pos = energyGeo.attributes.position.array, col = energyGeo.attributes.color.array;
  const weights = program.blocks.map((b, k) => {
    const st = result.state.get(b.id);
    const r = cells[k].planes.length ? Math.max(0.2, inradius(phys.pos(b.id), cells[k].planes)) : 0;
    return r ** 2 * (st?.status === 'ok' ? 0.25 + st.value : 0.1);
  });
  const total = weights.reduce((a, w) => a + w, 0) || 1;
  let at = 0;
  program.blocks.forEach((b, k) => {
    const count = k === program.blocks.length - 1 ? ENERGY - at : Math.floor((ENERGY * weights[k]) / total);
    pos.set(energy(cells[k].verts, count, dim(), k * 7919 + 13), at * 3);
    const st = result.state.get(b.id);
    const c = new THREE.Color(BLOCK_TYPES[b.type].color).multiplyScalar(st?.status === 'ok' ? 0.3 + st.value * 0.7 : 0.12);
    for (let i = at; i < at + count; i++) c.toArray(col, i * 3);
    at += count;
  });
  energyGeo.setDrawRange(0, at);
  energyGeo.attributes.position.needsUpdate = true;
  energyGeo.attributes.color.needsUpdate = true;
}

// --- 지금 씨앗 자리(물리)로 영역을 다시 개척한다 ------------------------------------------
// full = false 면(물리가 움직이는 중) 안쪽 폴더·파일 영역은 다시 나누지 않고 블록을 따라 옮기기만 한다
const UP = new THREE.Vector3(0, 1, 0);
function layoutCells(full) {
  const pts = program.blocks.map((b) => phys.pos(b.id));
  for (const b of program.blocks) views.get(b.id).group.position.fromArray(phys.pos(b.id));
  fieldBox.makeEmpty();
  const cells = pts.length ? voronoi(pts) : [];
  cellInfo = new Map();
  cells.forEach((cell, k) => {
    const id = program.blocks[k].id;
    setCell(views.get(id).body, pts[k], cell.verts, 1 - PHYSICAL.gap);
    cellPlanes.set(id, cell.planes);
    cellInfo.set(id, cell);
    cell.verts.forEach((q) => fieldBox.expandByPoint(new THREE.Vector3(...q)));
  });

  if (full) {
    for (const b of program.blocks) layoutNodes(b.id, phys.pos(b.id), cellPlanes.get(b.id), roots.get(b.id));
  } else {
    for (const n of nodes.values()) {
      if (n.local) n.view.body.position.fromArray(phys.pos(n.owner).map((v, i) => v + n.local[i]));
    }
  }

  // 접합: 맞닿았으면 공유면 모양 그대로 패드, 떨어졌으면 두 영역 사이의 브리지(도체)
  for (const v of seamViews.values()) {
    const a = views.get(v.from).group.position, b = views.get(v.to).group.position;
    v.curve.v1.copy(a);
    v.curve.v2.copy(b);
    const face = contactFace(v.wire);
    if (v.pad) v.mesh.geometry.dispose();
    v.pad = !!face;
    if (face) {
      const [cx, cy, cz] = face.centroid;
      const ring = face.poly.map((q) => [cx + (q[0] - cx) * 0.8, cy + (q[1] - cy) * 0.8, cz + (q[2] - cz) * 0.8]);
      const tri = ring.flatMap((q, i) => [cx, cy, cz, ...q, ...ring[(i + 1) % ring.length]]);
      v.mesh.geometry = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(tri, 3));
      v.mesh.geometry.computeVertexNormals();
      v.mesh.position.set(0, 0, 0);
      v.mesh.quaternion.identity();
      v.mesh.scale.setScalar(1);
    } else {
      v.mesh.geometry = seamGeo;
      v.mesh.position.lerpVectors(a, b, 0.5);
      const dir = b.clone().sub(a);
      if (dir.lengthSq() > 1e-6) v.mesh.quaternion.setFromUnitVectors(UP, dir.normalize());
      v.mesh.scale.set(0.45, 1, 0.45);
    }
  }
  fillEnergy(cells);
  placeDesignMarks();
}

// --- 물리 설계도 ---------------------------------------------------------------------
// 조립한 블록에서 바로 나온다: 블록 = 재료 덩어리(영역 다면체), 접합 = 접촉 패드 또는 브리지.
const C_LIGHT = 299792458;
function designSheet() {
  const u = PHYSICAL.unitMM;
  const mm = (p) => p.map((v) => Math.round(v * u * 100) / 100);
  const blocks = program.blocks.map((b) => {
    const c = cellInfo.get(b.id), mat = materialOf(b);
    return {
      id: b.id, type: b.type, name: b.name, material: mat.name, density_g_cm3: mat.density,
      seed_mm: mm(phys.pos(b.id)),
      volume_cm3: c.volume * CM ** 3, surface_cm2: c.area * CM ** 2, mass_g: physicalMass(b),
      faces: c.faces.map((f) => ({ neighbor: f.j >= 0 ? program.blocks[f.j].id : null, area_mm2: f.area * u * u, normal: f.normal })),
      vertices_mm: c.verts.map(mm),
    };
  });
  const contacts = program.wires.map((w) => {
    const face = contactFace(w);
    const type = BLOCK_TYPES[program.blocks[blockIndex(w.from.block)].type].outs.find((p) => p.id === w.from.port).type;
    const pa = phys.pos(w.from.block), pb = phys.pos(w.to.block);
    const dist = Math.hypot(pa[0] - pb[0], pa[1] - pb[1], pa[2] - pb[2]) * u;   // mm
    const part = face ? PHYSICAL.pad : PHYSICAL.bridge;
    const lengthMM = face ? dist * PHYSICAL.gap : dist;                         // 패드 두께 = 틈, 브리지 길이 = 씨앗 거리
    const areaMM2 = face ? face.area * u * u : PHYSICAL.bridge.sectionMM2;
    return {
      from: w.from, to: w.to, signal: SIGNALS[type].label, kind: face ? 'pad' : 'bridge', material: part.name,
      area_mm2: areaMM2, length_mm: lengthMM,
      conductance_S: (part.conductivity * areaMM2 * 1e-6) / (lengthMM * 1e-3),
      delay_ps: (lengthMM * 1e-3) / (PHYSICAL.signalSpeed * C_LIGHT) * 1e12,
    };
  });
  const total = blocks.reduce((a, b) => a + b.mass_g, 0);
  const com = [0, 1, 2].map((i) => blocks.reduce((a, b) => a + b.seed_mm[i] * b.mass_g, 0) / (total || 1));
  const size = fieldBox.getSize(new THREE.Vector3()).multiplyScalar(u);
  return {
    name: 'Quantum Analog Neuron Core', created: new Date().toISOString(), unit: 'mm', dimension: dim(),
    assumptions: PHYSICAL,
    envelope_mm: { w: size.x, h: size.y, d: size.z },
    total_volume_cm3: blocks.reduce((a, b) => a + b.volume_cm3, 0), total_mass_g: total, center_of_mass_mm: com,
    blocks, contacts,
  };
}

// 외곽 치수 상자와 무게중심 (설계도를 펼쳤을 때만)
let designOpen = false;
const envelope = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), new THREE.LineDashedMaterial({ color: 0xfff1a8, dashSize: 0.04, gapSize: 0.03, transparent: true, opacity: 0.7 }));
envelope.computeLineDistances();
const comMark = new THREE.Mesh(new THREE.OctahedronGeometry(0.45), new THREE.MeshBasicMaterial({ color: 0xfff1a8, wireframe: true }));
const dimLabels = ['w', 'h', 'd', 'com'].map((k) => {
  const el = document.createElement('div');
  el.className = 'label label-dim';
  const o = new CSS2DObject(el);
  scene.add(o);
  return { k, el, o };
});
scene.add(envelope, comMark);

function placeDesignMarks() {
  const show = designOpen && isActive(view) && !fieldBox.isEmpty();
  envelope.visible = comMark.visible = show;
  dimLabels.forEach((l) => { l.o.visible = show; });
  if (!show) return;
  const c = fieldBox.getCenter(new THREE.Vector3()), sz = fieldBox.getSize(new THREE.Vector3());
  envelope.position.copy(c);
  envelope.scale.copy(sz);
  const u = PHYSICAL.unitMM, { max } = fieldBox;
  const at = { w: [c.x, max.y, max.z], h: [max.x, c.y, max.z], d: [max.x, max.y, c.z] };
  for (const l of dimLabels) {
    if (l.k === 'com') continue;
    l.o.position.fromArray(at[l.k]);
    l.el.textContent = `${l.k.toUpperCase()} ${(sz[{ w: 'x', h: 'y', d: 'z' }[l.k]] * u).toFixed(0)} mm`;
  }
  let m = 0;
  const com = new THREE.Vector3();
  for (const b of program.blocks) {
    const g = physicalMass(b);
    com.addScaledVector(new THREE.Vector3().fromArray(phys.pos(b.id)), g);
    m += g;
  }
  com.divideScalar(m || 1);
  comMark.position.copy(com);
  const lc = dimLabels.find((l) => l.k === 'com');
  lc.o.position.copy(com);
  lc.el.textContent = '무게중심';
}

const fmt = (v, d = 1) => (Math.abs(v) >= 1e4 || (Math.abs(v) < 1e-2 && v !== 0) ? v.toExponential(2) : v.toFixed(d));
function renderDesign() {
  designEl.hidden = !designOpen || !isActive(view);
  placeDesignMarks();
  if (designEl.hidden || !program.blocks.length || !cellInfo.size) return;
  const d = designSheet();
  const name = (ref) => program.blocks[blockIndex(ref.block)]?.name;
  const table = (head, rows) => h('table', {}, h('tr', {}, ...head.map((t) => h('th', { textContent: t }))),
    ...rows.map((r) => h('tr', {}, ...r.map((t) => h('td', { textContent: t })))));
  const pads = d.contacts.filter((c) => c.kind === 'pad').length;
  const save = h('button', { textContent: '💾 설계도 저장 (JSON)' });
  const where = h('div', { className: 'dim' });
  save.addEventListener('click', async () => {
    where.textContent = '저장하는 중…';
    try { where.textContent = `저장됨: ${await hooks.saveDesign(designSheet())}`; } catch (err) { where.textContent = `저장 실패: ${err.message}`; }
  });
  const close = h('button', { textContent: '✕' });
  close.addEventListener('click', () => toggleDesign(false));
  designEl.replaceChildren(
    h('div', { className: 'design-head' }, h('strong', { textContent: 'Quantum Analog Neuron Core — 물리 설계' }), close),
    h('div', { className: 'dim', textContent: '블록을 조립한 그대로의 설계. 재료·단위는 topology.config.js 의 PHYSICAL 가정값.' }),
    h('div', { className: 'live', textContent: [
      `외곽 W ${fmt(d.envelope_mm.w, 0)} × H ${fmt(d.envelope_mm.h, 0)} × D ${fmt(d.envelope_mm.d, 0)} mm · 차원 D = ${fmtD(d.dimension)}`,
      `부피 ${fmt(d.total_volume_cm3)} cm³ · 질량 ${fmt(d.total_mass_g)} g · 무게중심 (${d.center_of_mass_mm.map((v) => v.toFixed(0)).join(', ')}) mm`,
      `접합 ${d.contacts.length}: 접촉 패드 ${pads} · 브리지 ${d.contacts.length - pads}${d.contacts.length - pads ? ' (맞대어 조립하면 패드가 된다)' : ''}`,
    ].join('\n') }),
    h('div', { className: 'dim', textContent: '블록 (영역 = 재료 덩어리)' }),
    table(['블록', '재료', '부피 cm³', '질량 g', '이웃 면'], d.blocks.map((b) => [b.name, b.material, fmt(b.volume_cm3), fmt(b.mass_g), String(b.faces.filter((f) => f.neighbor).length)])),
    h('div', { className: 'dim', textContent: '접합 (신호가 지나는 물리 경로)' }),
    table(['연결', '신호', '방식', '면적 mm²', '길이 mm', 'G (S)', '지연 ps'], d.contacts.map((c) => [
      `${name(c.from)} → ${name(c.to)}`, c.signal, c.kind === 'pad' ? '패드' : '브리지', fmt(c.area_mm2, 0), fmt(c.length_mm), fmt(c.conductance_S, 0), fmt(c.delay_ps)])),
    h('div', { className: 'actions' }, save),
    where,
  );
}

export function toggleDesign(open = !designOpen) {
  designOpen = open;
  renderInfo();
  renderDesign();
  overview();
}

// --- 조립: 끌어 온 블록이 맞닿은 이웃과 호환 단자가 있으면 접촉면으로 결합한다 -----------------------
// a 의 출력 → b 의 비어 있는 입력 (양자 출력은 한 곳에만)
function portPair(a, b) {
  const A = program.blocks[blockIndex(a)], B = program.blocks[blockIndex(b)];
  for (const o of BLOCK_TYPES[A.type].outs) {
    if (SIGNALS[o.type].single && program.wires.some((w) => w.from.block === a && w.from.port === o.id)) continue;
    for (const i of BLOCK_TYPES[B.type].ins) {
      if (o.type !== i.type || program.wires.some((w) => w.to.block === b && w.to.port === i.id)) continue;
      return { from: { block: a, port: o.id }, to: { block: b, port: i.id } };
    }
  }
  return null;
}

function dockOptions(id) {
  const out = [];
  for (const f of cellInfo.get(id)?.faces ?? []) {
    if (f.j < 0 || f.area < 0.3) continue;
    const other = program.blocks[f.j].id;
    if (program.wires.some((w) => (w.from.block === id && w.to.block === other) || (w.to.block === id && w.from.block === other))) continue;
    const pair = portPair(id, other) ?? portPair(other, id);
    if (pair) out.push({ face: f, pair });
  }
  return out;
}

// 끄는 동안 결합할 수 있는 접촉면을 빛낸다
const dockMarks = new THREE.Group();
scene.add(dockMarks);
function showDock(options, t) {
  dockMarks.children.forEach((m) => m.geometry.dispose());
  dockMarks.clear();
  for (const { face, pair } of options) {
    const type = BLOCK_TYPES[program.blocks[blockIndex(pair.from.block)].type].outs.find((p) => p.id === pair.from.port).type;
    const line = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(face.poly.map((q) => new THREE.Vector3(...q))),
      new THREE.LineBasicMaterial({ color: SIGNALS[type].color, transparent: true, opacity: 0.6 + 0.4 * Math.sin(t * 8) }));
    dockMarks.add(line);
  }
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
  result = evaluate(program, env);
  computeRest();
  ensureRoots();
  layoutCells(true);
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

  nobaseEl.hidden = !program.nobase || !isActive(view);
  renderDimension();
  renderPaletteStatus();
  renderInfo();
  renderDesign();
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
      pioneer(program.blocks.map((b) => b.id));
      overview();
    }
  });
  const design = h('button', { className: 'clear', textContent: '⚙ 물리 설계도 (Neuron Core)' });
  design.addEventListener('click', () => toggleDesign());
  paletteEl.replaceChildren(
    h('div', { className: 'palette-title', textContent: '양자 뉴런 블록' }),
    h('div', { className: 'palette-sub', textContent: '기능 모듈을 꺼내면 자기 영역을 개척해 블록이 됩니다. 같은 색 단자끼리 이으세요' }),
    ...sections,
    h('div', { className: 'palette-status' }),
    design,
    clear,
  );
}

function renderPaletteStatus() {
  const el = paletteEl.querySelector('.palette-status');
  if (!el) return;
  el.textContent = `블록 ${program.blocks.length} · 연결 ${program.wires.length} · 시스템 `
    + (result.system === null ? '— (Topology 블록에 아직 닿지 않음)' : `${Math.round(result.system * 100)}%`);
}

// --- 차원: 크기 배수를 차원 지수로 계산하고(N = (1/r)^D), 차원은 log 로 잰다 -------------------------
// 슬라이더도 log 눈금: 0 근처는 촘촘하고, 멀어질수록 10 배씩. 음수 차원과 4차원 너머(±10⁴)까지.
const fmtD = (D) => (Math.abs(D) < 10 ? D.toFixed(2) : Math.abs(D) < 1000 ? D.toFixed(1) : D.toFixed(0));
const fmtR = (r) => (r === 0 ? '0' : r < 1e-3 || r > 1e3 ? r.toExponential(2) : r.toFixed(3));
const S_LIMIT = toSlider(DIM_LIMIT);

function buildDimension() {
  const input = h('input', { type: 'range', min: -S_LIMIT, max: S_LIMIT, step: 0.001, value: toSlider(dim()) });
  input.addEventListener('input', () => setDimension(fromSlider(Number(input.value)), false));
  input.addEventListener('change', () => hooks.save(program));
  const ticks = h('div', { className: 'dims-ticks' }, ...[-1000, -100, -10, 0, 4, 10, 100, 1000].map((D) => {
    const t = h('span', { textContent: D === 4 ? '4D' : String(D) });
    t.style.left = `${((toSlider(D) + S_LIMIT) / (2 * S_LIMIT)) * 100}%`;
    return t;
  }));
  dimEl.replaceChildren(
    h('div', { className: 'dims-row' }, h('span', { className: 'dims-d' }), h('div', { className: 'dims-track' }, input, ticks)),
    h('div', { className: 'dims-note' }),
  );
}

function renderDimension() {
  const D = dim(), r = ratio(D);
  const input = dimEl.querySelector('input');
  if (input && document.activeElement !== input) input.value = toSlider(D);
  dimEl.querySelector('.dims-d').textContent = `D = ${fmtD(D)}`;
  const regime = D < 0 ? '음수 차원 — r > 1, 위계가 뒤집혀 하류(Topology)가 바깥의 큰 영역을 개척한다'
    : D === 0 ? '0차원 — 모든 영역이 한 점으로 응축된다'
      : D <= 4 ? '초입방체 안의 프랙탈 — 상류가 넓은 영역을 개척하고 하류로 갈수록 좁아진다'
        : '4차원 너머 — r → 1, 영역들이 고르게 개척된다';
  dimEl.querySelector('.dims-note').textContent =
    `크기 배수 N = (1/r)^D = 16 · r = ${fmtR(r)} · D = log 16 / log(1/r) · log₁₀|D| = ${D ? Math.log10(Math.abs(D)).toFixed(2) : '−∞'}\n${regime}`;
}

export function setDimension(d, save = true) {
  program.dim = THREE.MathUtils.clamp(d, -DIM_LIMIT, DIM_LIMIT);
  computeRest();   // 차원은 조립이 아니라 구조의 사양이다 — No Base 는 그대로. 회로는 물리로 새 자리에 옮겨 간다
  settling = true;
  renderDimension();
  renderInfo();
  if (save) hooks.save(program);
}

// 새 블록은 경로의 다음 걸음에 씨앗을 내리고 자기 영역을 개척한다
function addBlock(type) {
  const b = createBlock(type, program, 0, 0, { path: hooks.dataPlaces()[0]?.path });
  program.blocks.push(b);
  select({ kind: 'block', id: b.id });
  refresh();
  pioneer([b.id]);
}

canvas.addEventListener('dragover', (e) => { if (isActive(view)) e.preventDefault(); });
canvas.addEventListener('drop', (e) => {
  const data = e.dataTransfer.getData('text/plain');
  if (!isActive(view) || !data.startsWith('block:')) return;
  e.preventDefault();
  addBlock(data.slice(6));
});

// --- 선택과 정보 패널 -------------------------------------------------------------
let selected = null;   // { kind: 'block' | 'wire', id } | { kind: 'node', key }

function select(sel) {
  selected = sel;
  renderInfo();
}

function renderInfo() {
  if (!selected || !isActive(view) || designOpen) { infoEl.hidden = true; return; }
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

  if (selected.kind === 'node') {
    const n = nodes.get(selected.key);
    if (!n) { infoEl.hidden = true; return; }
    const owner = program.blocks.find((x) => x.id === n.owner);
    const lines = [n.path, n.dir ? `항목 ${n.total ?? '?'}개` : `${(n.size / 1024).toFixed(1)} KB`,
      `양자 뉴런 ${(nodeValue(n) * 100).toFixed(0)}% (${n.dir ? '항목 수' : '크기'}가 입력)`];
    const actions = n.dir
      ? [button(n.open ? '⊟ 접기' : '⊞ 펼치기 (안쪽 영역 개척)', () => toggleFolder(n.key)), button('📁 폴더 층 열기', () => hooks.openFolder(n.path))]
      : [button('▶ 열기', () => hooks.openFile(n.path), '기본 앱으로 연다')];
    infoEl.hidden = false;
    infoEl.replaceChildren(
      h('div', { className: 'kind', textContent: `${owner?.name ?? ''} 영역 · ${n.dir ? '폴더' : '파일'} 블록` }),
      h('strong', { textContent: n.name }),
      h('div', { className: 'live status-ok', textContent: lines.join('\n') }),
      h('div', { className: 'actions' }, ...actions),
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
    sel.addEventListener('change', () => { b.path = sel.value; hooks.save(program); hooks.needData(b.path); resetRoots(b.id); });
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
  const m = measures.get(b.id);
  if (m) lines.push(`영역 ${m.k + 1}번째 · 선형 축척 λ = ${fmtR(m.scale)} · 크기 배수 λ^D = ${fmtR(m.size)}`);
  if (roots.get(b.id)?.length) lines.push(`안쪽 영역: 폴더·파일 블록 ${roots.get(b.id).length}개 — 영역 안을 클릭`);

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
    h('div', { className: 'actions' },
      button('블록 지우기', () => { removeBlock(program, b.id); select(null); refresh(); }),
      ...(b.off ? [button('⟲ 수학 자리로', () => { delete b.off; refresh(); }, '끌어 옮긴 것을 되돌린다')] : [])),
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
  box.union(fieldBox);
  goal.target.copy(box.getCenter(new THREE.Vector3()));
  goal.sph.radius = Math.max(14, box.getSize(new THREE.Vector3()).length() * 1.25);
  // 왼쪽 팔레트에 가리지 않게 중심을 조금 왼쪽으로 잡아 블록이 화면 오른쪽에 오게 한다 (설계도를 펴면 반대로)
  goal.target.x -= goal.sph.radius * (designOpen ? -0.12 : 0.17);
}

// --- 마우스 ---------------------------------------------------------------------
// 블록 드래그 = 끌어 옮기기(물리: 이어진 회로가 따라온다), 단자 드래그 = 잇기, 빈 곳·Shift 드래그 = 회전,
// 오른쪽 드래그 = 이동, 스크롤 = 다가가기/물러나기, 클릭 = 선택(블록을 고르면 그 안의 폴더·파일 블록을 고를 수 있다),
// 더블클릭 = 폴더 펼치기·파일 열기, Delete = 선택한 블록·연결 지우기.
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
  const node = pickAt(e, focusedNodes());
  if (node) { drag = { mode: 'orbit', moved: 0, node: node.key }; return; }
  // (블록을 끌어 다른 블록에 맞대면 결합한다 — pointerup 의 dockOptions)
  const body = !e.shiftKey && pickAt(e, pickBodies);
  if (body) {
    const at = new THREE.Vector3().fromArray(phys.pos(body.id));
    const normal = camera.getWorldDirection(new THREE.Vector3());
    drag = { mode: 'grab', moved: 0, id: body.id, plane: new THREE.Plane().setFromNormalAndCoplanarPoint(normal, at) };
    return;
  }
  drag = { mode: 'orbit', moved: 0 };
});

// 블록을 고르면 그 영역 안의 폴더·파일 블록을 먼저 집는다 (영역 안으로 들어가기)
function focusedNodes() {
  const owner = selected?.kind === 'block' ? selected.id : selected?.kind === 'node' ? nodes.get(selected.key)?.owner : null;
  return owner ? pickNodes.filter((m) => nodes.get(m.userData.key)?.owner === owner && m.visible) : [];
}

canvas.addEventListener('pointermove', (e) => {
  if (!isActive(view)) return;
  if (!drag) {
    const t = pickAt(e, pickTerms);
    const b = !t && (pickAt(e, focusedNodes()) || (!e.shiftKey && pickAt(e, pickBodies)));
    canvas.style.cursor = t ? 'crosshair' : b ? (b.kind === 'node' ? 'pointer' : 'move') : 'grab';
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
  } else if (drag.mode === 'grab') {
    const p = ray(e).ray.intersectPlane(drag.plane, new THREE.Vector3());
    if (p && drag.moved >= 4) phys.hold(drag.id, p.toArray());
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
  } else if (d.mode === 'grab') {
    if (d.moved < 4) { select({ kind: 'block', id: d.id }); return; }
    // 놓은 자리가 새 자리: 수학 자리에서 옮긴 만큼을 기억한다
    const b = program.blocks.find((x) => x.id === d.id);
    const p = phys.pos(d.id), m = measures.get(d.id).p;
    b.off = p.map((v, i) => Math.round((v - m[i]) * 100) / 100);
    const docked = dockOptions(d.id);   // 맞닿은 호환 이웃과 결합 = 조립
    for (const { pair } of docked) connect(program, pair.from, pair.to);
    phys.release();
    refresh();
    if (docked.length) select({ kind: 'block', id: d.id });
  } else if (d.mode === 'orbit' && d.moved < 4) {
    const w = pickAt(e, pickWires);
    select(d.node ? { kind: 'node', key: d.node } : w ? { kind: 'wire', id: w.id } : null);
  }
});

canvas.addEventListener('dblclick', (e) => {
  if (!isActive(view)) return;
  const node = pickAt(e, focusedNodes());
  if (node) {
    const n = nodes.get(node.key);
    if (n.dir) toggleFolder(n.key);
    else hooks.openFile(n.path);
    return;
  }
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
  if ((e.code === 'Delete' || e.code === 'Backspace') && (selected?.kind === 'block' || selected?.kind === 'wire')) {
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

  // 물리: 움직이는 동안은 영역을 매 프레임 다시 개척하고, 자리를 잡으면 안쪽 영역까지 다시 개척한다
  if (phys.step(dt) > 1e-3) {
    layoutCells(false);
    settling = true;
  } else if (settling) {
    settling = false;
    layoutCells(true);
    computeRest();   // 새 영역으로 질량·접촉 강성을 다시 잰다
    renderDesign();
  }
  if (drag?.mode === 'grab' && drag.moved >= 4) showDock(dockOptions(drag.id), t);
  else if (dockMarks.children.length) showDock([], t);

  // 고른 블록은 투명해져 안쪽 폴더·파일 블록이 보인다. 이름표는 고른 영역 것만.
  const focus = selected?.kind === 'block' ? selected.id : selected?.kind === 'node' ? nodes.get(selected.key)?.owner : null;
  for (const [id, v] of views) v.body.material.opacity = focus === id && roots.get(id)?.length ? 0.14 : 0.42;
  for (const n of nodes.values()) {
    n.view.body.visible = !!n.local && (views.get(n.owner)?.grow ?? 1) >= 1;
    n.view.el.hidden = n.owner !== focus;
    n.view.el.classList.toggle('selected', selected?.kind === 'node' && selected.key === n.key);
  }

  // 영역 개척: 기다렸다가 씨앗에서 경계까지 자라난다
  for (const v of views.values()) {
    if (v.grow >= 1) continue;
    v.born ??= t + v.wait;
    if (t < v.born) { v.body.scale.setScalar(1e-3); v.group.scale.setScalar(1e-3); continue; }
    v.grow = Math.min(1, (t - v.born) / 0.9);   // 프레임이 느려도 실제 시간대로 자란다
    const e = 1 - (1 - v.grow) ** 3;
    v.body.scale.setScalar(Math.max(e, 1e-3));
    v.group.scale.setScalar(Math.max(Math.min(1, e * 2), 1e-3));
  }

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
  energyField.material.opacity = 0.6 + 0.25 * (result.system ?? 0) * (0.5 + 0.5 * Math.sin(t * 2.4));   // 장의 요동

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
  infoEl.hidden = name !== 'diagram' || !selected || designOpen;
  designEl.hidden = name !== 'diagram' || !designOpen;
  placeDesignMarks();
  nobaseEl.hidden = name !== 'diagram' || !program.nobase;
});

// 개발 확인용: 그 종류의 첫 블록을 고른다 (main.js 의 ?focus=)
export function focusType(type) {
  const b = program.blocks.find((x) => x.type === type);
  if (b) select({ kind: 'block', id: b.id });
}

export function build(saved, initialEnv) {
  // 손대지 않은 No Base 는 지금의 초기 구조로 다시 만든다
  program = saved.blocks.length && !saved.nobase ? saved
    : { ...baseProgram({ path: hooks.dataPlaces()[0]?.path }), ...(saved.dim !== undefined ? { dim: saved.dim } : {}) };
  env = initialEnv;
  buildPalette();
  buildDimension();
  refresh(false);
  pioneer(program.blocks.map((b) => b.id));
  overview();
  cur.target.copy(goal.target);
  cur.sph.copy(goal.sph);
}
