// 다이어그램 뷰: Quantum Neuron Block Computing 의 3D 조립판.
// No Base(초기 상태) = Topology 자체의 시스템 구조가 조립된 판. 여기서 블록을 꺼내 놓거나 단자를 다시 이어 시스템을 키운다.
// 조립이 바뀌거나 환경 값이 바뀔 때마다 시스템 전체를 계산해(blocks.js) 블록마다 양자 뉴런의 상태를 보여 준다.
// 시스템 구조는 보로노이 영역 개척으로 완성된다(field.js): 블록마다 씨앗에서 자기 영역을 개척하고, 그 영역이 곧
// 양자 아날로그 뉴런 블록이다 — 물리(맞물린 덩어리)와 수학(영역 분할) 사이의 다리. 영역의 크기 배수는 차원 D 를 지수로
// 계산한다(λ^D). 연결은 선이 아니라 두 영역이 맞닿는 접합면이 빛나는 것이다. 영역 중심에 양자 뉴런 핵과 단자가 있다.
// 폴더와 파일도 양자 아날로그 뉴런 블록이다: 블록 영역 안에서 같은 차원 법칙으로 다시 영역을 개척한다(영역 안의 영역).
// 영역 안은 블록의 신호만큼 양자 에너지 장이 찬다. 씨앗은 질량이어서(physics.js) 블록을 끌면 회로가 유기체처럼 따라온다.
// 블록 = 기기를 구동하고 회로를 완성하는 단위. 부품을 가져오지 않고 부품을 블록으로 짠다: 같은 단위 블록을 엮는 패턴이
// 그 모듈의 기능을 드러낸다(parts.js) — 물리 모형도, 수학 다면체도 아닌 개념적인 블록 구조. 모듈마다 부품 번호(QM-xx). 양자 코어(하나의 컴퓨터) 형태에서는
// 하나의 코어가 모든 것을 품는다: 가운데 양자 핵(QE 코어), 그 주위를 빈틈없이 채우는 모듈 조각(코어 외피 안의 보로노이 영역),
// 맞닿은 면의 핀–소켓 결합부, 맞닿지 않은 연결의 내부 채널. 조립 상태는 절개도로 안을, 분해 보기는 조각이 끼워지는 방식을 보여 준다.
// 블록을 끌어 다른 블록에 맞대면 접촉면으로 결합(조립)된다. 큐브 조립안(build.js)에서는 영역이 규격 큐브로 양자화되어
// 손으로 쌓을 수 있다: 큐브 = 부품, 맞닿은 큐브 면 = 구리 패드, 커넥터 핀, 떨어진 연결 = 큐브 사이 배선(브리지).
// 조립한 결과가 곧 Quantum Analog Neuron Core 의 물리 설계도다 — 층별 배치, 부품표, 치수(mm), 질량, 컨덕턴스, 지연.
import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { canvas, renderer, registerView, isActive, isTyping, isUi, onViewChange } from './core.js';
import { CONTROLS, NODES, PHYSICAL } from './topology.config.js';
import { BLOCK_TYPES, SIGNALS, createBlock, canConnect, connect, removeBlock, evaluate, emptyProgram, baseProgram, quantumNeuron } from './blocks.js';
import { DIM_LIMIT, DEFAULT_DIM, ratio, toSlider, fromSlider, seeds, pathSeeds, voronoi, inset, inradius, energy, flowOrder, coreBounds } from './field.js';
import { Physics } from './physics.js';
import { voxelize, contacts, facesBetween, route, layers, key as cellKey } from './build.js';
import { PATTERNS } from './parts.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

renderer.localClippingEnabled = true;   // 코어 절개도

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
  return { id: b.id, group, core, body, terms, el, bloch: def.neuron ? makeBloch(group) : null, grow: 1, wait: 0 };
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
const CUBE_CM3 = () => (PHYSICAL.voxelMM / 10) ** 3;
// 질량: 조립 큐브가 있으면 큐브 수 × 큐브 부피 × 밀도, 없으면 영역 부피 × 밀도 (g)
const physicalMass = (b) => {
  const k = blockIndex(b.id);
  const cm3 = vox && k >= 0 && k < vox.counts.length ? vox.counts[k] * CUBE_CM3() : (cellInfo.get(b.id)?.volume ?? 0) * CM ** 3;
  return cm3 * materialOf(b).density;
};
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
  // 코어 형태: 핵을 중심으로 한 하나의 외피 안을 영역들이 빈틈없이 채운다
  const nid = nucleusOf();
  const cells = !pts.length ? [] : coreForm() && nid ? voronoi(pts, coreBounds(phys.pos(nid), pts)) : voronoi(pts);
  cellInfo = new Map();
  cells.forEach((cell, k) => {
    const id = program.blocks[k].id;
    setCell(views.get(id).body, pts[k], cell.verts, coreForm() ? 0.985 : 1 - PHYSICAL.gap);   // 코어는 한 덩어리
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

  // 접합: 맞닿았으면 공유면 모양 그대로 패드, 떨어졌으면 두 영역 사이의 브리지(도체) (수학 형태에서만 보인다)
  for (const v of seamViews.values()) {
    v.mesh.visible = mathForm();
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
  buildVoxels();
  renderVoxels();
  buildCoreBlocks();
  renderCore();
  placeDesignMarks();
}

// --- 조립용 물리 형태: 규격 큐브 ---------------------------------------------------------
// 영역을 한 변 PHYSICAL.voxelMM 큐브로 양자화한다 (build.js). 설계도는 형태와 상관없이 늘 큐브 기준이다.
// 형태: core = 양자 핵과 그 주위의 부품(기본), math = 영역·에너지 장, cube = 규격 큐브 조립안
const formOf = () => ({ physical: 'cube' })[program.form] ?? program.form ?? 'core';
const coreForm = () => formOf() === 'core';
const mathForm = () => formOf() === 'math';
const cubeForm = () => formOf() === 'cube';
const VOX = () => PHYSICAL.voxelMM / PHYSICAL.unitMM;   // 큐브 한 변 (화면 단위)
const MAX_VOX = 8000;
const voxMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.15 }), MAX_VOX);
const padMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0.7, emissive: 0xffffff, emissiveIntensity: 0.15 }), MAX_VOX);
voxMesh.count = padMesh.count = 0;
voxMesh.frustumCulled = padMesh.frustumCulled = false;
const parts = new THREE.Group();   // 커넥터 핀, 브리지 도선
scene.add(voxMesh, padMesh, parts);
const pickPins = [];
let vox = null, voxLayers = [], voxOrder = [], joints = [];
let buildStep = Infinity;          // 조립 단계: 이 층(0 부터)까지 보인다

const signalOf = (w) => BLOCK_TYPES[program.blocks[blockIndex(w.from.block)].type].outs.find((p) => p.id === w.from.port).type;

// 큐브, 층, 접합(패드 면·커넥터·배선 경로)을 계산한다
function buildVoxels() {
  if (!program.blocks.length || fieldBox.isEmpty()) { vox = null; voxLayers = []; voxOrder = []; joints = []; return; }
  const seedsArr = program.blocks.map((b) => phys.pos(b.id));
  vox = voxelize(seedsArr, VOX(), fieldBox);
  voxLayers = layers(vox);
  voxOrder = voxLayers.flatMap((l) => l.cells);
  const faces = contacts(vox);
  joints = program.wires.map((w) => {
    const a = blockIndex(w.from.block), b = blockIndex(w.to.block);
    const fs = facesBetween(faces, a, b);
    if (!fs.length) return { wire: w, kind: 'bridge', path: route(vox, a, b) };
    // 커넥터 핀: 두 씨앗의 가운데에 가장 가까운 패드 면
    const mid = seedsArr[a].map((v, i) => (v + seedsArr[b][i]) / 2);
    const pin = fs.reduce((best, f) => (Math.hypot(...f.c.map((v, i) => v - mid[i])) < Math.hypot(...best.c.map((v, i) => v - mid[i])) ? f : best));
    return { wire: w, kind: 'pad', faces: fs, pin };
  });
}

function renderVoxels() {
  parts.children.forEach((o) => { o.geometry.dispose(); o.material.dispose(); });
  parts.clear();
  pickPins.length = 0;
  const on = cubeForm() && !!vox;
  voxMesh.visible = padMesh.visible = parts.visible = on;
  if (!on) return;
  const size = VOX(), m = new THREE.Matrix4(), col = new THREE.Color();
  const tint = program.blocks.map((b) => {
    const st = result.state.get(b.id);
    return new THREE.Color(st?.status === 'error' ? 0xa83a3a : st?.status === 'ok' ? BLOCK_TYPES[b.type].color : 0x4a5866);
  });
  voxOrder.slice(0, MAX_VOX).forEach((n, k) => {
    const cell = vox.cells[n];
    voxMesh.setMatrixAt(k, m.makeScale(size * 0.94, size * 0.94, size * 0.94).setPosition(...cell.c));
    voxMesh.setColorAt(k, tint[cell.owner]);
  });
  voxMesh.instanceMatrix.needsUpdate = true;
  if (voxMesh.instanceColor) voxMesh.instanceColor.needsUpdate = true;

  let pads = 0;
  const seedsArr = program.blocks.map((b) => phys.pos(b.id));
  for (const j of joints) {
    const color = SIGNALS[signalOf(j.wire)].color;
    const mat = () => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.7, metalness: 0.6, roughness: 0.3 });
    if (j.kind === 'pad') {
      for (const f of j.faces) {   // 구리 패드: 큐브 면 위의 얇은 판
        if (pads >= MAX_VOX) break;
        const sc = [size * 0.8, size * 0.8, size * 0.8];
        sc[f.axis] = size * 0.08;
        padMesh.setMatrixAt(pads, m.makeScale(...sc).setPosition(...f.c));
        padMesh.setColorAt(pads++, col.set(color));
      }
      const pin = new THREE.Mesh(new THREE.CylinderGeometry(size * 0.14, size * 0.14, size * 0.5, 12), mat());
      pin.position.fromArray(j.pin.c);
      if (j.pin.axis === 0) pin.rotation.z = Math.PI / 2;
      if (j.pin.axis === 2) pin.rotation.x = Math.PI / 2;
      pin.userData = { kind: 'wire', id: j.wire.id };
      parts.add(pin);
      pickPins.push(pin);
    } else if (j.path) {   // 브리지 도선: 큐브 중심을 따라 가는 배선 (구조 속이라 비쳐 보인다)
      const a = blockIndex(j.wire.from.block), b = blockIndex(j.wire.to.block);
      const pts = [seedsArr[a], ...j.path.map((n) => vox.cells[n].c), seedsArr[b]].map((q) => new THREE.Vector3(...q));
      const curve = new THREE.CurvePath();
      for (let i = 1; i < pts.length; i++) curve.add(new THREE.LineCurve3(pts[i - 1], pts[i]));
      const wireMat = mat();
      Object.assign(wireMat, { transparent: true, opacity: 0.85, depthTest: false });
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, pts.length * 4, size * 0.07, 6, false), wireMat);
      tube.renderOrder = 1;
      tube.userData = { kind: 'wire', id: j.wire.id };
      parts.add(tube);
      pickPins.push(tube);
    }
  }
  padMesh.count = pads;
  padMesh.instanceMatrix.needsUpdate = true;
  if (padMesh.instanceColor) padMesh.instanceColor.needsUpdate = true;
  applyBuildStep();
}

// 조립 단계: 아래층부터 k 층까지만 보인다. 다 쌓기 전에는 패드·핀·배선을 숨긴다.
function applyBuildStep() {
  const upto = Math.min(buildStep, voxLayers.length - 1);
  voxMesh.count = Math.min(MAX_VOX, voxLayers.slice(0, upto + 1).reduce((a, l) => a + l.cells.length, 0));
  const done = upto >= voxLayers.length - 1;
  padMesh.visible = parts.visible = cubeForm() && !!vox && done;
}

// 형태마다 보이는 것: 영역(수학), 부품과 배선(코어), 큐브(조립안). 단자는 큐브 조립안에서만 숨는다.
function applyForm() {
  const nid = nucleusOf();
  for (const v of views.values()) {
    v.body.visible = mathForm();   // 코어는 블록으로 짠다 (영역 다면체는 수학 형태에서만)
    v.core.visible = mathForm();
    v.terms.forEach((t) => { t.visible = mathForm(); });   // 단자를 끌어 잇는 것은 수학 형태에서
    // 코어: 모듈은 꽉 찬 조각(조립 상태는 절개도로 안이 보인다), 핵 영역은 투명해 핵이 보인다. 수학: 유리 같은 영역
    const m = v.body.material, edge = v.body.children[0].material;
    const solid = coreForm() && v.id !== nid;
    Object.assign(m, { opacity: coreForm() ? (solid ? 0.92 : 0.18) : 0.42, depthWrite: solid, side: coreForm() ? THREE.DoubleSide : THREE.FrontSide,
      metalness: coreForm() ? 0.3 : 0, roughness: coreForm() ? 0.4 : 0.3,   // 코어: 가공한 부품 마감
      clippingPlanes: cutOn() ? CUT : null, clipIntersection: true });
    Object.assign(edge, { clippingPlanes: cutOn() ? CUT : null, clipIntersection: true });
    m.needsUpdate = edge.needsUpdate = true;
  }
  energyField.visible = mathForm();
  cutWasOn = cutOn();
}

const FORMS = ['core', 'math', 'cube'];
const FORM_NAMES = { core: '양자 코어 (블록으로 짠 모듈)', math: '수학 (영역)', cube: '큐브 조립안' };
function toggleForm() {
  program.form = FORMS[(FORMS.indexOf(formOf()) + 1) % FORMS.length];
  hooks.save(program);
  refresh(false);
  buildPalette();
}

// --- 양자 코어 형태: 블록으로 짠 하나의 코어 -------------------------------------------
// 핵을 중심으로 한 코어 외피 안을 단위 블록 칸으로 나누고(칸은 가장 가까운 모듈 씨앗에 속한다), 모듈마다 자기 패턴(parts.js)에
// 맞는 칸에만 블록을 놓아 부품을 짠다. 연결된 모듈이 맞닿은 곳에는 신호 색 결합 블록, 떨어진 연결은 신호 색 블록을 줄지어 이은 채널.
// 조립 상태는 카메라 쪽 1/8 의 블록을 빼 안을 보이고, 분해 보기는 모듈을 핵에서 떼어 낸다.
const UNIT = () => PHYSICAL.blockMM / PHYSICAL.unitMM;   // 단위 블록 한 변 (화면 단위)
const MAX_UNITS = 16000;
const unitGeo = new RoundedBoxGeometry(1, 1, 1, 2, 0.16);
const unitMesh = new THREE.InstancedMesh(unitGeo, new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0.15 }), MAX_UNITS);
const glowMesh = new THREE.InstancedMesh(unitGeo, new THREE.MeshBasicMaterial(), MAX_UNITS);   // 핵·결합·채널: 스스로 빛나는 블록
unitMesh.count = glowMesh.count = 0;
unitMesh.frustumCulled = glowMesh.frustumCulled = false;
const coreGroup = new THREE.Group();   // 코어 외피 테두리
scene.add(unitMesh, glowMesh, coreGroup);
let unitOwner = [], glowOwner = [];   // 인스턴스 -> 모듈 id (집기)
let coreBlocks = null;                 // { size, units, joints, counts }
let coreInfo = new Map();              // blockId -> { dist }
let coreSkin = null;                   // { area, box }
let explode = 0, explodeGoal = 0;       // 분해 보기: 0 = 조립, 1 = 분해
let explodeAnim = null;                 // { from, t0 } — 프레임이 느려도 실제 시간대로 움직인다
let cutWasOn = null;
const cutOn = () => coreForm() && explode < 0.02;   // 절개도는 조립 상태에서만
const nucleusOf = () => program.blocks.find((b) => b.type === 'qe')?.id ?? null;
// 부품 번호: 신호 순서대로 QM-01, QM-02 …
const moduleCode = (id) => `QM-${String(flowOrder(program).indexOf(id) + 1).padStart(2, '0')}`;
const CUT = [new THREE.Plane(), new THREE.Plane(), new THREE.Plane()];   // 절개 (세 평면의 교집합 쪽을 잘라 낸다)
const AXIS = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
const DIRS = AXIS.flatMap((e) => [e, e.map((v) => -v)]);

// 절개는 늘 카메라 쪽 1/8 — 핵을 지나는 세 평면
function aimCut() {
  const nid = nucleusOf();
  if (!nid) return;
  const c = new THREE.Vector3().fromArray(phys.pos(nid));
  const to = camera.position.clone().sub(c);
  ['x', 'y', 'z'].forEach((axis, i) => {
    const s = Math.sign(to[axis]) || 1;
    const n = new THREE.Vector3();
    n[axis] = -s;
    CUT[i].setFromNormalAndCoplanarPoint(n, c);
  });
}
const inCut = (p) => cutOn() && CUT.every((pl) => pl.distanceToPoint(p) < 0);

// 분해 보기: 모듈이 핵에서 바깥으로 떨어져 나간다 (핵은 제자리)
function explodeOffset(id, center) {
  if (explode < 1e-3 || id === nucleusOf()) return new THREE.Vector3();
  const d = new THREE.Vector3().fromArray(phys.pos(id)).sub(center);
  const L = d.length() || 1;
  return d.multiplyScalar((explode * (0.6 * L + 3)) / L);
}

// 칸을 나누고 패턴대로 블록을 고른다 (배치가 바뀔 때마다)
function buildCoreBlocks() {
  coreBlocks = null;
  const nid = nucleusOf();
  if (!coreForm() || !nid || !program.blocks.length || fieldBox.isEmpty()) return;
  const pts = program.blocks.map((b) => phys.pos(b.id));
  const center = phys.pos(nid);
  const size = UNIT();
  const grid = voxelize(pts, size, fieldBox, coreBounds(center, pts));
  const cellAt = (p) => grid.at.get(cellKey(p.map((v) => Math.floor(v / size))));

  // 연결: 맞닿았으면 두 씨앗 가운데에 가장 가까운 맞닿은 면 양쪽 칸 = 결합 블록, 아니면 칸을 따라 이은 채널 블록
  const forced = new Map();   // 칸 번호 -> { kind, color }
  const faces = contacts(grid);
  const joints = program.wires.map((w) => {
    const a = blockIndex(w.from.block), b = blockIndex(w.to.block);
    const type = signalOf(w), color = SIGNALS[type].color;
    const fs = facesBetween(faces, a, b);
    if (fs.length) {
      const mid = pts[a].map((v, i) => (v + pts[b][i]) / 2);
      const f = fs.reduce((best, x) => (Math.hypot(...x.c.map((v, i) => v - mid[i])) < Math.hypot(...best.c.map((v, i) => v - mid[i])) ? x : best));
      const e = AXIS[f.axis].map((v) => (v * size) / 2);
      for (const p of [f.c.map((v, i) => v - e[i]), f.c.map((v, i) => v + e[i])]) {
        const n = cellAt(p);
        if (n !== undefined) forced.set(n, { kind: 'joint', color });
      }
      return { wire: w, kind: 'joint', type, at: f.c, units: 2 };
    }
    const path = route(grid, a, b) ?? [];
    path.forEach((n) => forced.set(n, { kind: 'channel', color }));
    return { wire: w, kind: 'channel', type, path: path.map((n) => grid.cells[n].c), units: path.length };
  });

  // 모듈마다 패턴에 맞는 칸에만 블록
  const seedCell = pts.map((p) => p.map((v) => Math.floor(v / size)));
  const outDir = pts.map((p) => {
    const d = p.map((v, i) => v - center[i]);
    const L = Math.hypot(...d);
    return L > 1e-6 ? d.map((v) => v / L) : [0, 1, 0];
  });
  const units = [];
  const counts = new Map(program.blocks.map((b) => [b.id, { body: 0, joint: 0 }]));
  grid.cells.forEach((cell, n) => {
    const b = program.blocks[cell.owner];
    const f = forced.get(n);
    if (f) {
      units.push({ c: cell.c, owner: b.id, kind: f.kind, color: f.color });
      counts.get(b.id).joint++;
      return;
    }
    const d = cell.i.map((v, i) => v - seedCell[cell.owner][i]);
    const r = Math.hypot(...d);
    let surface = false, border = false;
    for (const e of DIRS) {
      const m = grid.at.get(cellKey(cell.i.map((v, i) => v + e[i])));
      if (m === undefined) surface = true;
      else if (grid.cells[m].owner !== cell.owner) border = true;
    }
    const axial = d[0] * outDir[cell.owner][0] + d[1] * outDir[cell.owner][1] + d[2] * outDir[cell.owner][2];
    const c = { d, r, surface, border, axial, radial: Math.sqrt(Math.max(0, r * r - axial * axial)) };
    const pat = PATTERNS[b.type];
    if (pat && !pat.keep(c) && r > 0.5) return;   // 씨앗 칸은 늘 남긴다
    units.push({ c: cell.c, owner: b.id, kind: pat?.glow?.(c) ? 'glow' : 'body' });
    counts.get(b.id).body++;
  });
  coreBlocks = { size, units, joints, counts };
}

// 블록을 놓는다 (분해 보기·절개도·상태 색)
function renderCore() {
  coreGroup.traverse((o) => { if (o.geometry) { o.geometry.dispose(); o.material.dispose(); } });
  coreGroup.clear();
  coreInfo = new Map();
  coreSkin = null;
  for (const sv of seamViews.values()) sv.cable = null;
  for (const v of views.values()) { v.core.scale.setScalar(1); if (v.bloch) v.bloch.holder.scale.setScalar(1.6); }
  const on = coreForm() && !!coreBlocks;
  unitMesh.visible = glowMesh.visible = on;
  if (!on) { unitMesh.count = glowMesh.count = 0; return; }
  const nid = nucleusOf();
  const center = new THREE.Vector3().fromArray(phys.pos(nid));
  const off = new Map(program.blocks.map((b) => [b.id, explodeOffset(b.id, center)]));
  for (const b of program.blocks) {
    coreInfo.set(b.id, { dist: center.distanceTo(new THREE.Vector3().fromArray(phys.pos(b.id))) });
    views.get(b.id).group.position.fromArray(phys.pos(b.id)).add(off.get(b.id));   // 이름표는 모듈을 따라
  }
  const nv = views.get(nid);
  if (nv.bloch) nv.bloch.holder.scale.setScalar(coreBlocks.size * 2.2);   // 핵의 양자 상태

  const tint = new Map(program.blocks.map((b) => {
    const st = result.state.get(b.id);
    return [b.id, new THREE.Color(st?.status === 'error' ? 0xa83a3a : st?.status === 'ok' ? BLOCK_TYPES[b.type].color : 0x4a5866)];
  }));
  const m = new THREE.Matrix4(), p = new THREE.Vector3(), col = new THREE.Color();
  const s = coreBlocks.size * 0.92;
  let nu = 0, ng = 0;
  unitOwner = [];
  glowOwner = [];
  for (const u of coreBlocks.units) {
    p.fromArray(u.c);
    if (inCut(p)) continue;
    p.add(off.get(u.owner));
    m.makeScale(s, s, s).setPosition(p);
    if (u.kind === 'body') {
      if (nu >= MAX_UNITS) continue;
      unitMesh.setMatrixAt(nu, m);
      unitMesh.setColorAt(nu, tint.get(u.owner));
      unitOwner[nu++] = u.owner;
    } else {
      if (ng >= MAX_UNITS) continue;
      glowMesh.setMatrixAt(ng, m);
      glowMesh.setColorAt(ng, u.kind === 'glow' ? col.copy(tint.get(u.owner)).lerp(new THREE.Color(0xffffff), 0.35) : col.set(u.color));
      glowOwner[ng++] = u.owner;
    }
  }
  unitMesh.count = nu;
  glowMesh.count = ng;
  for (const im of [unitMesh, glowMesh]) {
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
  }

  // 외피: 하나의 코어를 감싸는 테두리 (조립 상태에서만)
  const all = [...cellInfo.values()].flatMap((c) => c.verts).map((q) => new THREE.Vector3(...q));
  if (all.length >= 4) {
    const hull = new ConvexGeometry(all);
    const pos = hull.attributes.position.array;
    let area = 0;
    for (let i = 0; i < pos.length; i += 9) {
      const a = new THREE.Vector3(pos[i], pos[i + 1], pos[i + 2]), b = new THREE.Vector3(pos[i + 3], pos[i + 4], pos[i + 5]), c = new THREE.Vector3(pos[i + 6], pos[i + 7], pos[i + 8]);
      area += b.sub(a).cross(c.sub(a)).length() / 2;
    }
    hull.computeBoundingBox();
    coreSkin = { area, box: hull.boundingBox.clone() };
    if (explode < 0.02) {
      coreGroup.add(new THREE.LineSegments(new THREE.EdgesGeometry(hull, 1),
        new THREE.LineBasicMaterial({ color: 0xe8fbff, transparent: true, opacity: 0.35, clippingPlanes: CUT, clipIntersection: true })));
    }
    hull.dispose();
  }

  // 신호가 흐르는 길: 결합 블록 또는 채널 블록을 따라
  for (const j of coreBlocks.joints) {
    const sv = seamViews.get(j.wire.id);
    if (!sv) continue;
    const A = new THREE.Vector3().fromArray(phys.pos(j.wire.from.block)).add(off.get(j.wire.from.block));
    const B = new THREE.Vector3().fromArray(phys.pos(j.wire.to.block)).add(off.get(j.wire.to.block));
    const mids = j.kind === 'joint' ? [new THREE.Vector3(...j.at)] : j.path.map((q) => new THREE.Vector3(...q));
    const path = new THREE.CurvePath();
    [A, ...mids, B].reduce((a, b) => { if (a.distanceTo(b) > 1e-4) path.add(new THREE.LineCurve3(a, b)); return b; });
    sv.cable = path.curves.length ? path : null;
  }
}

// 코어 설계도: 블록으로 짠 하나의 코어 — 모듈(패턴·블록 수), 결합, 조립 순서
function coreSheet() {
  const u = PHYSICAL.unitMM, unitCM3 = (PHYSICAL.blockMM / 10) ** 3;
  const nid = nucleusOf();
  const name = (id) => program.blocks[blockIndex(id)]?.name;
  const joints = (coreBlocks?.joints ?? []).map((j) => ({
    from: j.wire.from, to: j.wire.to, from_name: name(j.wire.from.block), to_name: name(j.wire.to.block),
    signal: SIGNALS[j.type].label, kind: j.kind === 'joint' ? '결합 블록' : '채널 블록', units: j.units,
    at_mm: j.at ? j.at.map((v) => Math.round(v * u)) : null,
  }));
  const modules = program.blocks.map((b) => {
    const mat = materialOf(b), cnt = coreBlocks?.counts.get(b.id) ?? { body: 0, joint: 0 };
    const blocks = cnt.body + cnt.joint;
    return {
      id: b.id, code: moduleCode(b.id), type: b.type, name: b.name, role: b.id === nid ? 'nucleus' : 'module',
      pattern: PATTERNS[b.type]?.name ?? '—', concept: NODES.find((n) => n.id === BLOCK_TYPES[b.type].concept)?.desc ?? '',
      material: mat.name, blocks, joint_blocks: cnt.joint, volume_cm3: blocks * unitCM3, mass_g: blocks * unitCM3 * mat.density,
      center_mm: phys.pos(b.id).map((v) => Math.round(v * u)), distance_from_nucleus_mm: (coreInfo.get(b.id)?.dist ?? 0) * u,
    };
  });
  // 조립 순서: 핵에서 가까운 모듈부터. 단계마다 이미 짠 모듈과 결합하는 곳
  const order = [...modules].sort((a, b) => a.distance_from_nucleus_mm - b.distance_from_nucleus_mm);
  const placed = new Set();
  const assembly = order.map((m, i) => {
    const mates = joints.filter((j) => (j.from.block === m.id && placed.has(j.to.block)) || (j.to.block === m.id && placed.has(j.from.block)))
      .map((j) => `${j.from.block === m.id ? j.to_name : j.from_name} (${j.signal}${j.kind === '채널 블록' ? ' 채널' : ''})`);
    placed.add(m.id);
    return { step: i + 1, module: `${m.code} ${m.name}`, mates };
  });
  const box = designBox(), size = box.getSize(new THREE.Vector3()).multiplyScalar(u);
  const mass = modules.reduce((a, z) => a + z.mass_g, 0);
  const com = [0, 1, 2].map((i) => modules.reduce((a, z) => a + z.center_mm[i] * z.mass_g, 0) / (mass || 1));
  return {
    name: 'Quantum Analog Neuron Core', version: 6, form: 'core', created: new Date().toISOString(), unit: 'mm', dimension: dim(),
    assumptions: PHYSICAL, unit_block_mm: PHYSICAL.blockMM,
    core: { envelope_mm: { w: size.x, h: size.y, d: size.z }, blocks: modules.reduce((a, m) => a + m.blocks, 0),
      volume_cm3: modules.reduce((a, m) => a + m.volume_cm3, 0), mass_g: mass, center_of_mass_mm: com },
    nucleus: nid ? { block: nid, name: name(nid), pattern: PATTERNS.qe.name } : null,
    envelope_mm: { w: size.x, h: size.y, d: size.z }, center_of_mass_mm: com,
    modules, joints, assembly,
  };
}

function renderCoreDesign() {
  const d = coreSheet();
  const table = (head, rows) => h('table', {}, h('tr', {}, ...head.map((t) => h('th', { textContent: t }))),
    ...rows.map((r) => h('tr', {}, ...r.map((t) => h('td', { textContent: t })))));
  const save = h('button', { textContent: '💾 설계도 저장 (JSON)' });
  const where = h('div', { className: 'dim' });
  save.addEventListener('click', async () => {
    where.textContent = '저장하는 중…';
    try { where.textContent = `저장됨: ${await hooks.saveDesign(coreSheet())}`; } catch (err) { where.textContent = `저장 실패: ${err.message}`; }
  });
  const close = h('button', { textContent: '✕' });
  close.addEventListener('click', () => toggleDesign(false));
  const jb = d.joints.filter((j) => j.kind === '결합 블록').length;
  designEl.replaceChildren(
    h('div', { className: 'design-head' }, h('strong', { textContent: '양자 코어 — 블록으로 짠 모듈' }), close),
    h('div', { className: 'dim', textContent: `부품을 가져오지 않고 블록으로 짠다: 한 변 ${d.unit_block_mm} mm 단위 블록을 모듈마다 고유한 패턴으로 엮어 기능을 드러낸다. 맞닿은 곳은 결합 블록, 떨어진 곳은 채널 블록. 가정값은 topology.config.js 의 PHYSICAL.` }),
    h('div', { className: 'live', textContent: [
      `코어: 블록 ${d.core.blocks}개 · W ${fmt(d.core.envelope_mm.w, 0)} × H ${fmt(d.core.envelope_mm.h, 0)} × D ${fmt(d.core.envelope_mm.d, 0)} mm · 질량 ${fmt(d.core.mass_g)} g`,
      d.nucleus ? `양자 핵: ${d.nucleus.name} — ${d.nucleus.pattern}` : '양자 핵 없음 — QE 코어 블록을 꺼내면 코어의 핵이 된다',
      `모듈 ${d.modules.length} · 연결 ${d.joints.length}: 결합 블록 ${jb} · 채널 블록 ${d.joints.length - jb}`,
    ].join('\n') }),
    h('div', { className: 'dim', textContent: '조립 순서 (핵부터 바깥으로 짠다)' }),
    h('ol', { className: 'assembly' }, ...d.assembly.map((x) => h('li', { textContent: `${x.module}${x.mates.length ? ` — ${x.mates.join(', ')} 와 결합` : x.step === 1 ? ' — 중심' : ''}` }))),
    h('div', { className: 'dim', textContent: '모듈 (블록을 엮는 패턴)' }),
    table(['부품 번호', '모듈', '패턴', '블록', '결합', '재료', '질량 g'], d.modules.map((m) => [m.code, m.role === 'nucleus' ? `◉ ${m.name}` : m.name, m.pattern, String(m.blocks), String(m.joint_blocks), m.material, fmt(m.mass_g)])),
    h('div', { className: 'dim', textContent: '연결' }),
    table(['연결', '신호', '방식', '블록', '위치 mm'], d.joints.map((j) => [`${j.from_name} → ${j.to_name}`, j.signal, j.kind, String(j.units), j.at_mm ? `(${j.at_mm.join(', ')})` : '—'])),
    h('div', { className: 'actions' }, save),
    where,
  );
}

// --- 물리 설계도: 조립 큐브 기준 ------------------------------------------------------
const C_LIGHT = 299792458;
// 설계 외곽: 코어 = 외피, 큐브 = 큐브들, 수학 = 영역
function designBox() {
  if (coreForm()) return coreSkin ? coreSkin.box.clone() : new THREE.Box3().copy(fieldBox);
  return voxBox();
}

function voxBox() {
  const box = new THREE.Box3();
  if (!vox) return box.copy(fieldBox);
  const half = new THREE.Vector3().setScalar(vox.size / 2);
  for (const c of vox.cells) {
    const p = new THREE.Vector3(...c.c);
    box.expandByPoint(p.clone().sub(half)).expandByPoint(p.add(half));
  }
  return box;
}

function designSheet() {
  const u = PHYSICAL.unitMM, cube = PHYSICAL.voxelMM;
  const mm = (p) => p.map((v) => Math.round(v * u * 10) / 10);
  const name = (id) => program.blocks[blockIndex(id)]?.name;
  const blocks = program.blocks.map((b, k) => {
    const mat = materialOf(b);
    return {
      id: b.id, type: b.type, name: b.name, material: mat.name, density_g_cm3: mat.density,
      cubes: vox.counts[k], volume_cm3: vox.counts[k] * CUBE_CM3(), mass_g: physicalMass(b), seed_mm: mm(phys.pos(b.id)),
    };
  });
  const contactsOut = joints.map((j) => {
    const base = { from: j.wire.from, to: j.wire.to, from_name: name(j.wire.from.block), to_name: name(j.wire.to.block), signal: SIGNALS[signalOf(j.wire)].label };
    if (j.kind === 'pad') {
      const area = j.faces.length * cube * cube, len = PHYSICAL.padMM;
      return {
        ...base, kind: 'pad', material: PHYSICAL.pad.name, pad_faces: j.faces.length, area_mm2: area, length_mm: len,
        connector: { at_mm: mm(j.pin.c), axis: 'xyz'[j.pin.axis] },
        conductance_S: (PHYSICAL.pad.conductivity * area * 1e-6) / (len * 1e-3),
        delay_ps: (len * 1e-3) / (PHYSICAL.signalSpeed * C_LIGHT) * 1e12,
      };
    }
    const len = j.path ? (j.path.length + 1) * cube : null;
    const through = j.path ? [...new Set(j.path.map((n) => name(program.blocks[vox.cells[n].owner].id)))] : [];
    return {
      ...base, kind: 'bridge', material: PHYSICAL.bridge.name, length_mm: len, through,
      route_cells: j.path?.map((n) => vox.cells[n].i) ?? null,
      conductance_S: len ? (PHYSICAL.bridge.conductivity * PHYSICAL.bridge.sectionMM2 * 1e-6) / (len * 1e-3) : null,
      delay_ps: len ? (len * 1e-3) / (PHYSICAL.signalSpeed * C_LIGHT) * 1e12 : null,
    };
  });
  const box = voxBox(), size = box.getSize(new THREE.Vector3()).multiplyScalar(u);
  const total = blocks.reduce((a, b) => a + b.mass_g, 0);
  const com = [0, 1, 2].map((i) => vox.cells.reduce((a, c) => a + c.c[i] * u * materialOf(program.blocks[c.owner]).density, 0)
    / (vox.cells.reduce((a, c) => a + materialOf(program.blocks[c.owner]).density, 0) || 1));
  const bom = {};
  for (const b of blocks) {
    const k = `${b.material} 큐브 ${cube} mm`;
    bom[k] = (bom[k] ?? 0) + b.cubes;
  }
  const pads = contactsOut.filter((c) => c.kind === 'pad');
  const bridges = contactsOut.filter((c) => c.kind === 'bridge');
  bom[`${PHYSICAL.pad.name} (큐브 면)`] = pads.reduce((a, c) => a + c.pad_faces, 0);
  bom['커넥터 핀'] = pads.length;
  if (bridges.length) bom[`${PHYSICAL.bridge.name} ${PHYSICAL.bridge.sectionMM2} mm² (mm)`] = bridges.reduce((a, c) => a + (c.length_mm ?? 0), 0);
  const lo = vox.cells.reduce((a, c) => a.map((v, i) => Math.min(v, c.i[i])), [Infinity, Infinity, Infinity]);
  return {
    name: 'Quantum Analog Neuron Core', version: 2, created: new Date().toISOString(), unit: 'mm', dimension: dim(),
    assumptions: PHYSICAL,
    cube_mm: cube, cube_count: vox.cells.length, layer_count: voxLayers.length,
    envelope_mm: { w: size.x, h: size.y, d: size.z },
    total_volume_cm3: blocks.reduce((a, b) => a + b.volume_cm3, 0), total_mass_g: total, center_of_mass_mm: com,
    bom, blocks, contacts: contactsOut,
    // 조립 순서: 아래층부터. 격자 좌표는 가장 낮은 큐브를 (0,0,0) 으로
    layers: voxLayers.map((l, k) => ({
      layer: k + 1,
      cubes: l.cells.map((n) => ({ x: vox.cells[n].i[0] - lo[0], z: vox.cells[n].i[2] - lo[2], block: name(program.blocks[vox.cells[n].owner].id) })),
    })),
  };
}

// 외곽 치수 상자와 무게중심 (설계도를 펼쳤을 때만)
let designOpen = false;
const envelope = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), new THREE.LineDashedMaterial({ color: 0xfff1a8, dashSize: 0.04, gapSize: 0.03, transparent: true, opacity: 0.7 }));
envelope.computeLineDistances();
const comMark = new THREE.Mesh(new THREE.OctahedronGeometry(0.45), new THREE.MeshBasicMaterial({ color: 0xfff1a8, wireframe: true, depthTest: false }));
comMark.renderOrder = 2;
const dimLabels = ['w', 'h', 'd', 'com'].map((k) => {
  const el = document.createElement('div');
  el.className = 'label label-dim';
  const o = new CSS2DObject(el);
  scene.add(o);
  return { k, el, o };
});
scene.add(envelope, comMark);

function placeDesignMarks() {
  const show = designOpen && isActive(view) && !!vox && !mathForm();
  envelope.visible = comMark.visible = show;
  dimLabels.forEach((l) => { l.o.visible = show; });
  if (!show) return;
  const box = designBox(), c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
  envelope.position.copy(c);
  envelope.scale.copy(sz);
  const u = PHYSICAL.unitMM, { max } = box;
  const at = { w: [c.x, max.y, max.z], h: [max.x, c.y, max.z], d: [max.x, max.y, c.z] };
  for (const l of dimLabels) {
    if (l.k === 'com') continue;
    l.o.position.fromArray(at[l.k]);
    l.el.textContent = `${l.k.toUpperCase()} ${(sz[{ w: 'x', h: 'y', d: 'z' }[l.k]] * u).toFixed(0)} mm`;
  }
  const com = (coreForm() ? coreSheet() : designSheet()).center_of_mass_mm.map((v) => v / u);
  comMark.position.fromArray(com);
  const lc = dimLabels.find((l) => l.k === 'com');
  lc.o.position.fromArray(com);
  lc.el.textContent = '무게중심';
}

const fmt = (v, d = 1) => (v === null ? '—' : Math.abs(v) >= 1e4 || (Math.abs(v) < 1e-2 && v !== 0) ? v.toExponential(2) : v.toFixed(d));
const hexCol = (c) => `#${c.toString(16).padStart(6, '0')}`;

// 층 배치도: 위에서 내려다본 한 층. 칸 = 큐브, 색 = 블록
function layerMap(d, layer, on) {
  const all = d.layers.flatMap((l) => l.cubes);
  const W = Math.max(...all.map((c) => c.x)) + 1, Hh = Math.max(...all.map((c) => c.z)) + 1, s = 9;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${W * s} ${Hh * s}`);
  svg.setAttribute('width', W * s);
  svg.setAttribute('height', Hh * s);
  for (const c of layer.cubes) {
    const r = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    Object.entries({ x: c.x * s, y: c.z * s, width: s - 1, height: s - 1, fill: hexCol(BLOCK_TYPES[program.blocks.find((b) => b.name === c.block)?.type ?? 'data'].color) })
      .forEach(([k, v]) => r.setAttribute(k, v));
    const t = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    t.textContent = c.block;
    r.append(t);
    svg.append(r);
  }
  const fig = h('figure', { className: `layer-map${on ? ' on' : ''}` }, svg, h('figcaption', { textContent: `${layer.layer}층 · ${layer.cubes.length}` }));
  return fig;
}

function renderDesign() {
  designEl.hidden = !designOpen || !isActive(view);
  placeDesignMarks();
  if (designEl.hidden || !vox) return;
  if (!cubeForm()) { renderCoreDesign(); return; }   // 수학 형태에서도 설계도는 코어 기준
  const d = designSheet();
  const table = (head, rows) => h('table', {}, h('tr', {}, ...head.map((t) => h('th', { textContent: t }))),
    ...rows.map((r) => h('tr', {}, ...r.map((t) => h('td', { textContent: t })))));
  const save = h('button', { textContent: '💾 설계도 저장 (JSON)' });
  const where = h('div', { className: 'dim' });
  save.addEventListener('click', async () => {
    where.textContent = '저장하는 중…';
    try { where.textContent = `저장됨: ${await hooks.saveDesign(designSheet())}`; } catch (err) { where.textContent = `저장 실패: ${err.message}`; }
  });
  const close = h('button', { textContent: '✕' });
  close.addEventListener('click', () => toggleDesign(false));

  // 조립 단계: 슬라이더로 아래층부터 쌓아 본다
  const L = d.layers.length;
  const step = Math.min(buildStep, L - 1);
  const stepInput = h('input', { type: 'range', min: 1, max: L, step: 1, value: step + 1 });
  const stepText = h('div', { className: 'live' });
  const maps = h('div', { className: 'layer-maps' });
  const showStep = () => {
    const k = Number(stepInput.value) - 1;
    buildStep = k >= L - 1 ? Infinity : k;
    applyBuildStep();
    const count = {};
    d.layers[k].cubes.forEach((c) => { count[c.block] = (count[c.block] ?? 0) + 1; });
    stepText.textContent = `${k + 1} / ${L}층 쌓기: ${Object.entries(count).map(([n, c]) => `${n} ×${c}`).join(', ')}`
      + (k === L - 1 ? '\n다 쌓은 뒤 커넥터 핀을 꽂고 브리지 도선을 잇는다' : '');
    maps.replaceChildren(...d.layers.map((l, i) => layerMap(d, l, i === k)));
  };
  stepInput.addEventListener('input', showStep);
  showStep();

  const pads = d.contacts.filter((c) => c.kind === 'pad').length;
  designEl.replaceChildren(
    h('div', { className: 'design-head' }, h('strong', { textContent: 'Quantum Analog Neuron Core — 조립 설계' }), close),
    h('div', { className: 'dim', textContent: `영역을 ${d.cube_mm} mm 규격 큐브로 쌓는다. 재료·치수 가정값은 topology.config.js 의 PHYSICAL.` }),
    h('div', { className: 'live', textContent: [
      `큐브 ${d.cube_count}개 · ${L}층 · 외곽 W ${fmt(d.envelope_mm.w, 0)} × H ${fmt(d.envelope_mm.h, 0)} × D ${fmt(d.envelope_mm.d, 0)} mm`,
      `부피 ${fmt(d.total_volume_cm3)} cm³ · 질량 ${fmt(d.total_mass_g)} g · 무게중심 (${d.center_of_mass_mm.map((v) => v.toFixed(0)).join(', ')}) mm`,
      `접합 ${d.contacts.length}: 패드 ${pads} · 브리지 ${d.contacts.length - pads}${d.contacts.length - pads ? ' (맞대어 조립하면 패드가 된다)' : ''}`,
    ].join('\n') }),
    h('div', { className: 'dim', textContent: '부품표' }),
    table(['부품', '수량'], Object.entries(d.bom).map(([k, v]) => [k, fmt(v, 0)])),
    h('div', { className: 'dim', textContent: '조립 단계 (아래층부터)' }),
    stepInput, stepText, maps,
    h('div', { className: 'dim', textContent: '블록' }),
    table(['블록', '재료', '큐브', '부피 cm³', '질량 g'], d.blocks.map((b) => [b.name, b.material, String(b.cubes), fmt(b.volume_cm3), fmt(b.mass_g)])),
    h('div', { className: 'dim', textContent: '접합 (커넥터 위치 mm · 브리지 경로)' }),
    table(['연결', '신호', '방식', '패드 면 / 길이', '커넥터·경유', 'G (S)', '지연 ps'], d.contacts.map((c) => [
      `${c.from_name} → ${c.to_name}`, c.signal, c.kind === 'pad' ? '패드' : '브리지',
      c.kind === 'pad' ? `${c.pad_faces}면` : `${fmt(c.length_mm, 0)} mm`,
      c.kind === 'pad' ? `(${c.connector.at_mm.map((v) => v.toFixed(0)).join(', ')}) ${c.connector.axis}` : c.through.join('·'),
      fmt(c.conductance_S, 0), fmt(c.delay_ps)])),
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


// 단자(커넥터)의 지금 위치
function termWorld(blockId, side, portId) {
  const t = views.get(blockId).terms.find((m) => m.userData.side === side && m.userData.port === portId);
  return t.getWorldPosition(new THREE.Vector3());
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
  applyForm();
  layoutCells(true);
  if (save) delete program.nobase;   // 손대면 더 이상 초기 상태가 아니다

  for (const b of program.blocks) {
    const v = views.get(b.id);
    const st = result.state.get(b.id) ?? { status: 'idle' };
    v.el.querySelector('.name').textContent = coreForm() ? `${moduleCode(b.id)} ${b.name}` : b.name;
    v.el.dataset.status = st.status;
    v.el.querySelector('.out').textContent = st.status === 'ok' ? `${Math.round(st.value * 100)}%` : st.status === 'idle' ? '대기' : '오류';
    v.body.material.emissiveIntensity = st.status === 'ok' ? 0.1 + st.value * 0.6 : 0.02;
    v.body.material.color.set(st.status === 'error' ? 0xa83a3a : st.status === 'idle' ? 0x4a5866 : BLOCK_TYPES[b.type].color);
    v.core.material.color.copy(v.body.material.color);
    v.core.material.emissiveIntensity = st.status === 'ok' ? 0.2 + st.value * 0.9 : 0.05;
    if (v.bloch) {
      v.bloch.holder.visible = !!st.bloch && (mathForm() || (coreForm() && b.id === nucleusOf()));   // 코어에서는 핵의 양자 상태만
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
      program = { ...baseProgram({ path: hooks.dataPlaces()[0]?.path }), dim: dim(), form: program.form };
      select(null);
      refresh(false);
      hooks.save(program);
      pioneer(program.blocks.map((b) => b.id));
      overview();
    }
  });
  const design = h('button', { className: 'clear', textContent: '⚙ 조립 설계도 (Neuron Core)' });
  design.addEventListener('click', () => toggleDesign());
  const form = h('button', { className: 'clear', textContent: `◧ 형태: ${FORM_NAMES[formOf()]}`, title: '양자 코어 → 수학 → 큐브 조립안 순서로 바꾼다' });
  form.addEventListener('click', () => toggleForm());
  const apart = h('button', { className: 'clear', textContent: explodeGoal ? '⇲ 조립 보기' : '⇱ 분해 보기 (모듈이 끼워지는 방식)' });
  apart.hidden = !coreForm();
  apart.addEventListener('click', () => {
    explodeGoal = explodeGoal ? 0 : 1;
    explodeAnim = null;
    goal.sph.radius *= explodeGoal ? 1.8 : 1 / 1.8;   // 분해하면 물러나 전체를 본다
    apart.textContent = explodeGoal ? '⇲ 조립 보기' : '⇱ 분해 보기 (모듈이 끼워지는 방식)';
  });
  paletteEl.replaceChildren(
    h('div', { className: 'palette-title', textContent: '양자 뉴런 블록' }),
    h('div', { className: 'palette-sub', textContent: '기능 모듈을 꺼내면 자기 영역을 개척해 블록이 됩니다. 같은 색 단자끼리 이으세요' }),
    ...sections,
    h('div', { className: 'palette-status' }),
    form,
    apart,
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
  return ray(e).intersectObjects(list.filter((o) => o.visible), false)[0]?.object.userData ?? null;
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
  const body = !e.shiftKey && pickBlock(e);
  if (body) {
    const at = new THREE.Vector3().fromArray(phys.pos(body.id));
    const normal = camera.getWorldDirection(new THREE.Vector3());
    drag = { mode: 'grab', moved: 0, id: body.id, plane: new THREE.Plane().setFromNormalAndCoplanarPoint(normal, at) };
    return;
  }
  drag = { mode: 'orbit', moved: 0 };
});

// 블록 집기: 물리 형태에서는 큐브를 집으면 그 큐브가 속한 블록
function pickBlock(e) {
  if (mathForm()) return pickAt(e, pickBodies);
  if (coreForm()) {   // 블록 하나를 집으면 그 블록이 속한 모듈
    const hit = ray(e).intersectObjects([unitMesh, glowMesh].filter((o) => o.visible), false)[0];
    const id = hit && (hit.object === unitMesh ? unitOwner : glowOwner)[hit.instanceId];
    return id ? { kind: 'block', id } : null;
  }
  const hit = vox && ray(e).intersectObject(voxMesh, false)[0];
  return hit ? { kind: 'block', id: program.blocks[vox.cells[voxOrder[hit.instanceId]].owner].id } : null;
}

// 블록을 고르면 그 영역 안의 폴더·파일 블록을 먼저 집는다 (영역 안으로 들어가기)
function focusedNodes() {
  const owner = selected?.kind === 'block' ? selected.id : selected?.kind === 'node' ? nodes.get(selected.key)?.owner : null;
  return owner ? pickNodes.filter((m) => nodes.get(m.userData.key)?.owner === owner && m.visible) : [];
}

canvas.addEventListener('pointermove', (e) => {
  if (!isActive(view)) return;
  if (!drag) {
    const t = pickAt(e, pickTerms);
    const b = !t && (pickAt(e, focusedNodes()) || (!e.shiftKey && pickBlock(e)));
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
    const w = pickAt(e, [...pickWires, ...pickPins]);
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
  const body = pickBlock(e);
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
  if (mathForm()) for (const [id, v] of views) v.body.material.opacity = focus === id && roots.get(id)?.length ? 0.14 : 0.42;
  if (coreForm()) {
    aimCut();
    if (explode !== explodeGoal) {
      explodeAnim ??= { from: explode, t0: t };
      const p = Math.min(1, (t - explodeAnim.t0) / 0.9);
      explode = explodeAnim.from + (explodeGoal - explodeAnim.from) * (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2);
      if (p >= 1) { explode = explodeGoal; explodeAnim = null; }
      renderCore();
      if (cutOn() !== cutWasOn) applyForm();
    }
  }
  for (const n of nodes.values()) {
    n.view.body.visible = !!n.local && (views.get(n.owner)?.grow ?? 1) >= 1 && mathForm();
    n.view.el.hidden = n.owner !== focus || !mathForm();
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
      (v.cable ?? v.curve).getPointAt((t * 0.45 + p / PULSES) % 1, tmp).toArray(arr, n * 3);   // 코어에서는 배선을 따라
    }
  }
  pulseGeo.setDrawRange(0, n);
  pulseGeo.attributes.position.needsUpdate = true;
  energyField.material.opacity = (coreForm() ? 0.35 : 1) * (0.6 + 0.25 * (result.system ?? 0) * (0.5 + 0.5 * Math.sin(t * 2.4)));   // 장의 요동

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

// 개발 확인용: 분해 보기로 시작한다 (main.js 의 ?explode)
export function explodeView() {
  explodeGoal = 1;
  goal.sph.radius *= 1.8;
  buildPalette();
}

// 개발 확인용: 그 종류의 첫 블록을 고른다 (main.js 의 ?focus=)
export function focusType(type) {
  const b = program.blocks.find((x) => x.type === type);
  if (b) select({ kind: 'block', id: b.id });
}

export function build(saved, initialEnv) {
  // 손대지 않은 No Base 는 지금의 초기 구조로 다시 만든다
  program = saved.blocks.length && !saved.nobase ? saved
    : { ...baseProgram({ path: hooks.dataPlaces()[0]?.path }), ...(saved.dim !== undefined ? { dim: saved.dim } : {}), ...(saved.form ? { form: saved.form } : {}) };
  env = initialEnv;
  buildPalette();
  buildDimension();
  refresh(false);
  pioneer(program.blocks.map((b) => b.id));
  overview();
  cur.target.copy(goal.target);
  cur.sph.copy(goal.sph);
}
