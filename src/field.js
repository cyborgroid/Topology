// 양자장: 차원 D 와 보로노이 영역 개척으로 Topology 시스템 구조를 완성한다.
//  - 크기 배수는 차원을 지수로 계산한다: N = (1/r)^D, 거꾸로 차원은 log 로 잰다: D = log N / log(1/r).
//    N = 16(초입방체 꼭짓점), r = 맨 마지막 영역의 선형 축척(맨 처음 영역 = 1).
//    0 < D ≤ 4  : 초입방체 안의 프랙탈. 상류 영역이 넓고 하류로 갈수록 좁아진다.
//    D > 4      : 4차원 너머. r → 1 이 되어 영역들이 고르게 개척된다.
//    D < 0      : 음수 차원. r > 1 이 되어 위계가 뒤집힌다 — 하류(Topology)가 바깥의 큰 영역을 개척한다.
//    D = 0      : 모든 영역이 한 점으로 응축된다.
//  - 블록 씨앗은 신호 순서대로 초입방체의 그레이 코드 경로를 따라 한 걸음씩 놓인다. k 번째 영역의 선형 축척 λ = r^(k/(n-1)),
//    크기 배수 λ^D = 16^(-k/(n-1)) — 차원이 무엇이든 마지막 영역은 처음 영역의 1/16 이고, 차원(지수)이 선형 축척을 정한다.
//  - 보로노이: 씨앗마다 다른 씨앗보다 자기에게 가까운 공간을 개척한다. 그 영역이 곧 양자 아날로그 뉴런 블록이다.
import { BLOCK_TYPES } from './blocks.js';

export const DIM_LIMIT = 10000;                        // 거의 무한: ±10⁴ 까지
export const DEFAULT_DIM = Math.log(16) / Math.log(3);  // r = 1/3 (D ≈ 2.52)
const N = 16;
const RADIUS = 9;          // 구조 전체의 반지름
const MARGIN = 3;          // 바깥 영역의 경계 여유
const R_LIMIT = 1e-6;      // 그릴 수 있는 축척 범위 [1e-6, 1e6]
const W_DIR = [0.45, 0.75, -0.5];   // 넷째 축을 3D 에 눕히는 방향

// 크기 비 r. D = 0 은 r = 0(한 점), 음수는 r > 1.
export const ratio = (D) => (D === 0 ? 0 : N ** (-1 / D));

// log 눈금: 슬라이더 값 s ↔ 차원 D (0 근처는 촘촘하고 멀어질수록 10 배씩)
export const toSlider = (D) => Math.sign(D) * Math.log10(1 + Math.abs(D));
export const fromSlider = (s) => Math.sign(s) * (10 ** Math.abs(s) - 1);

const CORNERS = Array.from({ length: N }, (_, g) => [0, 1, 2, 3].map((bit) => ((g >> bit) & 1 ? 1 : -1)));
const gray = (i) => i ^ (i >> 1);   // 이웃한 번호끼리 비트 하나만 다르다 = 초입방체의 이웃 꼭짓점
const project = ([x, y, z, w]) => [x + W_DIR[0] * w, y + W_DIR[1] * w, z + W_DIR[2] * w];

// 신호가 흐르는 순서(위상 정렬). 같은 때 준비된 블록은 블록 종류 순서대로.
export function flowOrder(program) {
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

// 블록 id -> { p: 3D 씨앗 위치(무게중심이 원점, 반지름 RADIUS), k: 순서, scale: 선형 축척 λ, size: 크기 배수 λ^D }
export function seeds(program, D) {
  const order = flowOrder(program);
  const r = Math.min(1 / R_LIMIT, Math.max(R_LIMIT, ratio(D)));
  const step = order.length > 1 ? r ** (1 / (order.length - 1)) : 1;
  const raw = [];
  let p = [0, 0, 0, 0], scale = 1;
  order.forEach((id, k) => {
    p = p.map((v, i) => v + scale * CORNERS[gray(k % N)][i]);
    scale *= step;
    raw.push(project(p));
  });
  const c = [0, 1, 2].map((i) => raw.reduce((s, q) => s + q[i], 0) / Math.max(raw.length, 1));
  const far = Math.max(1e-9, ...raw.map((q) => Math.hypot(q[0] - c[0], q[1] - c[1], q[2] - c[2])));
  const n = Math.max(order.length - 1, 1);
  return new Map(order.map((id, k) => [id, {
    p: raw[k].map((v, i) => ((v - c[i]) / far) * RADIUS),
    k,
    scale: step ** k,
    size: D === 0 ? (k ? 0 : 1) : N ** (-k / n),   // λ^D = (r^D)^(k/n) = 16^(-k/n)
  }]));
}

// --- 보로노이 영역 개척 -------------------------------------------------------------
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
// 바깥 경계: 깎은 팔면체(14면) — 구조의 겉모양
const BOUND_DIRS = [
  [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
  ...[-1, 1].flatMap((x) => [-1, 1].flatMap((y) => [-1, 1].map((z) => [x, y, z].map((v) => v / Math.sqrt(3))))),
];

// 씨앗마다 개척한 영역(볼록 다면체)의 꼭짓점들 = 반공간의 교집합
export function voronoi(points) {
  const bounds = BOUND_DIRS.map((n) => ({ n, c: Math.max(...points.map((p) => dot(n, p))) + MARGIN }));
  return points.map((s, i) => {
    const planes = [...bounds];
    points.forEach((t, j) => {
      const d = [t[0] - s[0], t[1] - s[1], t[2] - s[2]];
      const len = Math.hypot(...d);
      if (j === i || len < 1e-9) return;
      const n = d.map((v) => v / len);
      planes.push({ n, c: dot(n, s) + len / 2 });   // 두 씨앗의 수직이등분면 = 영역의 경계
    });
    const verts = [];
    for (let a = 0; a < planes.length; a++) {
      for (let b = a + 1; b < planes.length; b++) {
        const nb = cross(planes[a].n, planes[b].n);
        for (let c = b + 1; c < planes.length; c++) {
          const det = dot(planes[c].n, nb);
          if (Math.abs(det) < 1e-12) continue;
          const x = cross(planes[b].n, planes[c].n).map((v) => v * planes[a].c);
          const y = cross(planes[c].n, planes[a].n).map((v) => v * planes[b].c);
          const p = [0, 1, 2].map((k) => (x[k] + y[k] + nb[k] * planes[c].c) / det);
          if (planes.every((q) => dot(q.n, p) <= q.c + 1e-7)) verts.push(p);
        }
      }
    }
    return verts;
  });
}
