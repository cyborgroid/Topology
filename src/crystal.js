// 결정 격자: 시스템 전체에 하나의 차원 사양을 적용해, 블록(육각기둥 셀)이 놓일 격자점을 정한다.
// 셀은 선으로 잇지 않고 서로 면을 맞대고 맞물린다. 이어진 블록일수록 이웃 칸에 오도록 신호 순서대로 하나씩 놓는다.
// 4D 는 넷째 축(w)까지 격자를 펼치고 비스듬한 넷째 방향으로 3D 에 투영한다 — 화면이 보여 줄 수 있는 가장 높은 차원.
import { BLOCK_TYPES } from './blocks.js';

export const CELL_R = 1.5;                  // 육각기둥 외접 반지름 (꼭짓점이 +z, 평평한 면이 ±x)
export const CELL_H = 1.1;                  // 셀 높이
const FLAT = CELL_R * Math.sqrt(3);         // 마주 보는 면 사이 = 옆 셀 중심 거리
const ROW = CELL_R * 1.5;                   // 벌집 다음 줄
const W_STEP = CELL_R * 3;                  // 넷째 축 한 칸
const HYPER = 30;                           // 4D → 3D 원근 거리 (w 가 멀수록 셀이 작다)
const W_DIR = [0.45, 0.75, -0.5];           // 넷째 축을 3D 에 비스듬히 눕히는 방향

export const DIMENSIONS = [
  { d: 4, label: '4D', name: '초입방 결정', note: '세 축에 넷째 축 w 를 더한 격자. w 칸은 비스듬히 투영되고, 결정이 xw 평면에서 흔들린다' },
  { d: 3, label: '3D', name: '입체 결정', note: '육각기둥 셀이 벌집 층으로 쌓여 위아래·옆으로 맞물린다' },
  { d: 2, label: '2D', name: '평면 결정', note: '셀이 한 평면의 벌집으로 맞물린다' },
  { d: 1, label: '1D', name: '선 결정', note: '셀이 신호 순서대로 한 줄로 맞붙는다' },
  { d: 0, label: '0D', name: '점 결정', note: '모든 셀이 한 점 — Topology 를 중심으로 응축된 결정 씨앗' },
];
export const DEFAULT_DIM = 3;

// 차원별 격자점 [x, y, z, w]. 원점에서 가까운 순서로 정렬해 같은 비용이면 안쪽을 고른다.
const siteCache = new Map();
function sites(d) {
  if (siteCache.has(d)) return siteCache.get(d);
  const N = 5;
  const layers = d >= 3 || d === 0 ? [-3, -2, -1, 0, 1, 2, 3] : [0];   // 0D 는 공처럼 응축
  const ws = d === 4 ? [0, 1] : [0];   // 초입방체처럼 w 두 칸
  const list = [];
  for (const w of ws) for (const l of layers) for (let q = -N; q <= N; q++) for (let s = -N; s <= N; s++) {
    list.push([FLAT * (q + s / 2), l * CELL_H, ROW * s, w * W_STEP]);
  }
  list.sort((a, b) => norm(a) - norm(b));
  siteCache.set(d, list);
  return list;
}

// 셀이 납작하니 위아래 칸은 무겁게, w 칸은 가볍게 쳐서 결정이 고르게 자란다
const METRIC = [1, 2.4, 1, 0.55];
const dist = (a, b) => Math.hypot(...a.map((v, i) => (v - b[i]) * METRIC[i]));
const norm = (a) => dist(a, [0, 0, 0, 0]);

// 신호가 흐르는 순서(위상 정렬). 같은 때 준비된 블록은 블록 종류 순서대로.
function flowOrder(program) {
  const kinds = Object.keys(BLOCK_TYPES);
  const rank = new Map(program.blocks.map((b, i) => [b.id, kinds.indexOf(b.type) * 1000 + i]));
  const indeg = new Map(program.blocks.map((b) => [b.id, 0]));
  const next = new Map(program.blocks.map((b) => [b.id, []]));
  for (const w of program.wires) {
    if (!indeg.has(w.from.block) || !indeg.has(w.to.block)) continue;
    indeg.set(w.to.block, indeg.get(w.to.block) + 1);
    next.get(w.from.block).push(w.to.block);
  }
  const ready = [...indeg.keys()].filter((id) => indeg.get(id) === 0);
  const order = [];
  while (ready.length) {
    ready.sort((a, b) => rank.get(a) - rank.get(b));
    const id = ready.shift();
    order.push(id);
    for (const n of next.get(id)) {
      indeg.set(n, indeg.get(n) - 1);
      if (indeg.get(n) === 0) ready.push(n);
    }
  }
  return [...order, ...[...indeg.keys()].filter((id) => !order.includes(id))];   // 고리에 걸린 블록은 끝에
}

// 블록 id -> 격자점 [x, y, z, w] (결정의 무게중심이 원점)
export function layout(program, d) {
  const order = flowOrder(program);
  const pos = new Map();
  if (d === 1) {
    order.forEach((id, i) => pos.set(id, [(i - (order.length - 1) / 2) * FLAT, 0, 0, 0]));
    return pos;
  }
  if (d === 0) order.reverse();   // 신호가 모이는 곳(Topology)이 씨앗의 중심
  const nbrs = new Map(order.map((id) => [id, []]));
  for (const w of program.wires) {
    nbrs.get(w.from.block)?.push(w.to.block);
    nbrs.get(w.to.block)?.push(w.from.block);
  }
  const pull = d === 0 ? 4 : 0.3;   // 원점으로 당기는 힘: 0D 는 한 점으로 응축
  const list = sites(d);
  const used = new Set();
  for (const id of order) {
    let best = -1, bestCost = Infinity;
    for (let i = 0; i < list.length; i++) {
      if (used.has(i)) continue;
      let c = pull * norm(list[i]);
      for (const n of nbrs.get(id)) if (pos.has(n)) c += dist(list[i], pos.get(n));
      if (c < bestCost - 1e-9) { bestCost = c; best = i; }
    }
    used.add(best);
    pos.set(id, list[best]);
  }
  const c = [0, 0, 0, 0];
  for (const p of pos.values()) p.forEach((v, i) => { c[i] += v / pos.size; });
  for (const [id, p] of pos) pos.set(id, p.map((v, i) => v - c[i]));
  return pos;
}

// 격자점 -> 3D 위치와 크기. 4D 는 xw 평면으로 angle 만큼 돌린 뒤, w 를 비스듬한 방향으로 눕히고 원근으로 줄인다.
export function project([x, y, z, w], angle = 0) {
  const c = Math.cos(angle), s = Math.sin(angle);
  const xr = x * c - w * s, wr = x * s + w * c;
  const k = Math.max(0.4, HYPER / (HYPER + wr));
  return { x: (xr + wr * W_DIR[0]) * k, y: (y + wr * W_DIR[1]) * k, z: (z + wr * W_DIR[2]) * k, scale: k };
}
