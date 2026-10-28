// 양자장: 프랙탈(소수 차원)과 보로노이 다이어그램으로 시스템을 하나의 결정 구조로 완성한다.
//  - 프랙탈: 4차원 초입방체를 16조각으로 자기복제(축척 r)한다. 하우스도르프 차원 D = log16 / log(1/r).
//    D 는 0 ~ 4 사이를 볼륨처럼 연속으로 올리고 내린다. D 가 오를수록 장이 공간을 채우고(4 = 초입방체를 꽉 채움),
//    내릴수록 점 먼지로 응축된다(0 = 꼭짓점 16개).
//  - 블록 = 첫 단계 16조각의 중심. 신호 순서대로 그레이 코드를 따라 놓아, 이어진 블록이 초입방체의 이웃 꼭짓점에 온다.
//  - 보로노이: 블록 위치를 씨앗으로 공간을 나눈다. 블록의 셀 = 그 블록에 가장 가까운 공간, 맞닿은 면 = 접합.
//    장의 양자(점)는 가장 가까운 블록의 셀에 속한다 — 양자장이 블록들의 영역으로 완성된다.
import { BLOCK_TYPES } from './blocks.js';

export const DIM_MIN = 0, DIM_MAX = 4;
export const DEFAULT_DIM = Math.log(16) / Math.log(3);   // r = 1/3: 초입방 칸토어 먼지 (D ≈ 2.52)
const N = 16;              // 자기복제 조각 수 = 4D 초입방체 꼭짓점
const SIZE = 8;            // 장의 반지름
const PERSPECTIVE = 0.4;   // 4D → 3D: w 가 클수록 바깥 입방체(초입방체 투영)
const MARGIN = 1.2;        // 보로노이 바깥 경계 여유

export const ratio = (D) => (D <= 0.001 ? 0 : N ** (-1 / D));

const CORNERS = Array.from({ length: N }, (_, g) => [0, 1, 2, 3].map((bit) => ((g >> bit) & 1 ? 1 : -1)));
const gray = (i) => i ^ (i >> 1);   // 이웃한 번호끼리 비트 하나만 다르다 = 초입방체의 이웃 꼭짓점

// 4D 점 -> 3D (안쪽·바깥 입방체로 보이는 초입방체 원근)
function project([x, y, z, w]) {
  const k = SIZE * (1 + PERSPECTIVE * w);
  return [x * k, y * k, z * k];
}

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

// 블록 id -> 3D 씨앗 위치. 16개를 넘으면 한 단계 더 안쪽 조각으로 들어간다.
export function seeds(program, D) {
  const r = ratio(D);
  const pos = new Map();
  flowOrder(program).forEach((id, k) => {
    let p = CORNERS[gray(k % N)].map((v) => (1 - r) * v);
    if (k >= N) p = CORNERS[gray(Math.floor(k / N) - 1)].map((v, i) => (1 - r) * v + r * p[i]);
    pos.set(id, project(p));
  });
  return pos;
}

// 장의 양자: 카오스 게임으로 프랙탈 끌개 위의 점을 찍는다. 같은 난수 순서를 써서 D 를 움직이면 장이 끊기지 않고 변한다.
export function quanta(D, count) {
  const r = ratio(D);
  const out = new Float32Array(count * 3);
  let seed = 0x9e3779b9;
  const rnd = () => {   // mulberry32
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  let p = [0, 0, 0, 0];
  for (let i = -24; i < count; i++) {
    const c = CORNERS[Math.floor(rnd() * N)];
    p = p.map((v, j) => r * v + (1 - r) * c[j]);
    if (i >= 0) out.set(project(p), i * 3);
  }
  return out;
}

// --- 보로노이 ----------------------------------------------------------------------
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
// 바깥 경계: 깎은 팔면체(14면) — 결정의 겉모양
const BOUND_DIRS = [
  [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
  ...[-1, 1].flatMap((x) => [-1, 1].flatMap((y) => [-1, 1].map((z) => [x, y, z].map((v) => v / Math.sqrt(3))))),
];

// 씨앗마다 보로노이 셀의 꼭짓점들. 셀 = 경계 안에서 다른 씨앗보다 이 씨앗에 가까운 점들(반공간의 교집합).
// field = 장의 양자 위치(경계를 장 전체에 맞춘다)
export function voronoi(points, field) {
  const bounds = BOUND_DIRS.map((n) => {
    let c = -Infinity;
    for (const p of points) c = Math.max(c, dot(n, p));
    for (let i = 0; i < field.length; i += 3) c = Math.max(c, n[0] * field[i] + n[1] * field[i + 1] + n[2] * field[i + 2]);
    return { n, c: c + MARGIN };
  });
  return points.map((s, i) => {
    const planes = [...bounds];
    points.forEach((t, j) => {
      const d = [t[0] - s[0], t[1] - s[1], t[2] - s[2]];
      const len = Math.hypot(...d);
      if (j === i || len < 1e-6) return;
      const n = d.map((v) => v / len);
      planes.push({ n, c: dot(n, s) + len / 2 });   // 두 씨앗의 수직이등분면
    });
    const verts = [];
    for (let a = 0; a < planes.length; a++) {
      for (let b = a + 1; b < planes.length; b++) {
        const nb = cross(planes[a].n, planes[b].n);
        for (let c = b + 1; c < planes.length; c++) {
          const det = dot(planes[c].n, nb);
          if (Math.abs(det) < 1e-9) continue;
          const x = cross(planes[b].n, planes[c].n).map((v) => v * planes[a].c);
          const y = cross(planes[c].n, planes[a].n).map((v) => v * planes[b].c);
          const p = [0, 1, 2].map((k) => (x[k] + y[k] + nb[k] * planes[c].c) / det);
          if (planes.every((q) => dot(q.n, p) <= q.c + 1e-6)) verts.push(p);
        }
      }
    }
    return verts;
  });
}
