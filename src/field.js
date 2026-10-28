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

// 같은 차원 법칙으로 n 개의 씨앗을 놓는다: 그레이 코드 경로를 한 걸음씩, 걸음마다 축척 ρ = r^(1/(n-1)).
// 무게중심이 원점, 반지름 1. 블록 구조와 영역 안의 폴더·파일이 같은 법칙을 따른다(자기닮음).
export function pathSeeds(n, D) {
  const r = Math.min(1 / R_LIMIT, Math.max(R_LIMIT, ratio(D)));
  const step = n > 1 ? r ** (1 / (n - 1)) : 1;
  const raw = [];
  let p = [0, 0, 0, 0], scale = 1;
  for (let k = 0; k < n; k++) {
    p = p.map((v, i) => v + scale * CORNERS[gray(k % N)][i]);
    scale *= step;
    raw.push(project(p));
  }
  const c = [0, 1, 2].map((i) => raw.reduce((s, q) => s + q[i], 0) / Math.max(n, 1));
  const far = Math.max(1e-9, ...raw.map((q) => Math.hypot(q[0] - c[0], q[1] - c[1], q[2] - c[2])));
  return { points: raw.map((q) => q.map((v, i) => (v - c[i]) / far)), step };
}

// 블록 id -> { p: 3D 씨앗 위치(무게중심이 원점, 반지름 RADIUS), k: 순서, scale: 선형 축척 λ, size: 크기 배수 λ^D }
export function seeds(program, D) {
  const order = flowOrder(program);
  const { points, step } = pathSeeds(order.length, D);
  const n = Math.max(order.length - 1, 1);
  return new Map(order.map((id, k) => [id, {
    p: points[k].map((v) => v * RADIUS),
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

// 하나의 코어: 핵(center)을 중심으로 모든 씨앗을 품는 26면 결정 외피. 영역들은 이 안을 빈틈없이 채운다.
const CORE_DIRS = [-1, 0, 1].flatMap((x) => [-1, 0, 1].flatMap((y) => [-1, 0, 1].map((z) => [x, y, z])))
  .filter((d) => d.some((v) => v)).map((d) => d.map((v) => v / Math.hypot(...d)));
export function coreBounds(center, points, margin = 3) {
  const radius = Math.max(...points.map((p) => Math.hypot(p[0] - center[0], p[1] - center[1], p[2] - center[2]))) + margin;
  return CORE_DIRS.map((n) => ({ n, c: dot(n, center) + radius, j: -1 }));
}

export const outerBounds = (points) => BOUND_DIRS.map((n) => ({ n, c: Math.max(...points.map((p) => dot(n, p))) + MARGIN, j: -1 }));

// 씨앗마다 개척한 영역(볼록 다면체) = 반공간의 교집합.
//   { verts, planes, faces, volume, area } — planes 는 안쪽 영역을 다시 나눌 때 경계,
//   faces 는 면마다 { j: 맞닿은 이웃 씨앗 번호(-1 = 바깥), area, centroid, normal, poly } = 물리적 접촉면.
// bounds 를 주면 그 안에서만 개척한다 (부모 영역 안의 폴더·파일 영역).
export function voronoi(points, bounds = outerBounds(points)) {
  return points.map((s, i) => {
    const planes = [...bounds];
    points.forEach((t, j) => {
      const d = [t[0] - s[0], t[1] - s[1], t[2] - s[2]];
      const len = Math.hypot(...d);
      if (j === i || len < 1e-9) return;
      const n = d.map((v) => v / len);
      planes.push({ n, c: dot(n, s) + len / 2, j });   // 두 씨앗의 수직이등분면 = 영역의 경계 = 이웃과의 접촉면
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
    // 실제로 영역에 닿는 경계만 남긴다 (안쪽을 다시 나눌 때 계산이 가볍도록)
    const touching = planes.filter((q) => verts.some((p) => Math.abs(dot(q.n, p) - q.c) < 1e-5));
    const faces = touching.map((q) => ({ ...facePolygon(verts, q), j: q.j ?? -1, normal: q.n, h: q.c - dot(q.n, s) }))
      .filter((f) => f.area > 1e-6);
    return {
      verts,
      planes: touching,
      faces,
      volume: faces.reduce((a, f) => a + (f.area * f.h) / 3, 0),   // 씨앗을 꼭짓점으로 한 각뿔들의 합
      area: faces.reduce((a, f) => a + f.area, 0),
    };
  });
}

// 평면 위에 놓인 꼭짓점들을 둘레 순서로 세워 다각형과 넓이를 구한다
function facePolygon(verts, q) {
  const on = [];
  for (const p of verts) {
    if (Math.abs(dot(q.n, p) - q.c) < 1e-5 && !on.some((o) => Math.hypot(o[0] - p[0], o[1] - p[1], o[2] - p[2]) < 1e-6)) on.push(p);
  }
  const centroid = [0, 1, 2].map((k) => on.reduce((a, p) => a + p[k], 0) / Math.max(on.length, 1));
  const u0 = Math.abs(q.n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  const u = cross(q.n, u0), w = cross(q.n, u);
  const rel = (p) => [p[0] - centroid[0], p[1] - centroid[1], p[2] - centroid[2]];
  const poly = on.sort((a, b) => Math.atan2(dot(rel(a), w), dot(rel(a), u)) - Math.atan2(dot(rel(b), w), dot(rel(b), u)));
  let area = 0;
  for (let i = 0; i < poly.length; i++) area += Math.hypot(...cross(rel(poly[i]), rel(poly[(i + 1) % poly.length]))) / 2;
  return { poly, centroid, area: poly.length >= 3 ? area : 0 };
}

// 영역 안쪽으로 d 만큼 들인 경계 (안쪽 영역 사이에 틈을 둔다)
export const inset = (planes, d) => planes.map((q) => ({ n: q.n, c: q.c - d, j: -1 }));

// 씨앗에서 경계까지 가장 가까운 거리 = 영역에 들어가는 가장 큰 공의 반지름
export const inradius = (s, planes) => Math.min(...planes.map((q) => q.c - dot(q.n, s)));

// --- 양자 에너지 장: 영역 안의 프랙탈 먼지 ------------------------------------------------
// 영역의 꼭짓점들을 끌개로 카오스 게임을 돌린다(p ← ρp + (1−ρ)v). 볼록 영역이라 점은 늘 영역 안에 있고,
// ρ 는 차원에서 온다 — 같은 차원 법칙이 에너지 장의 결까지 정한다. 같은 난수 순서를 써서 영역이 움직여도 장이 끊기지 않는다.
export function energy(verts, count, D, seed) {
  const out = new Float32Array(count * 3);
  if (!verts.length || !count) return out;
  const rho = Math.min(0.75, Math.max(0.25, ratio(Math.abs(D)) || 0.25));
  let st = seed | 0;
  const rnd = () => {   // mulberry32
    st = (st + 0x6d2b79f5) | 0;
    let t = Math.imul(st ^ (st >>> 15), 1 | st);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  let p = [0, 1, 2].map((k) => verts.reduce((a, v) => a + v[k], 0) / verts.length);
  for (let i = -8; i < count; i++) {
    const v = verts[Math.floor(rnd() * verts.length)];
    p = p.map((x, k) => rho * x + (1 - rho) * v[k]);
    if (i >= 0) out.set(p, i * 3);
  }
  return out;
}
