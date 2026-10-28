// 조립용 물리 형태: 보로노이 영역을 같은 크기의 큐브(복셀)로 양자화해 손으로 쌓을 수 있게 한다.
//  - 큐브 하나 = 규격 부품. 큐브는 가장 가까운 블록 씨앗에 속한다 (이산 보로노이 — 수학 구조 그대로).
//  - 서로 다른 블록의 큐브가 맞닿은 면 = 접촉 패드. 연결마다 그중 한 면에 커넥터 핀을 둔다.
//  - 맞닿지 않은 연결은 큐브 사이를 지나는 최단 배선 경로(브리지 도선)로 잇는다.
//  - 아래층부터 한 층씩 쌓는다 (층 = y 방향 큐브 한 줄).
import { outerBounds } from './field.js';

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const key = (i) => `${i[0]},${i[1]},${i[2]}`;
const AXES = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];

// seeds: 블록 순서대로 씨앗 위치, size: 큐브 한 변(화면 단위), box: { min, max } 덮을 범위
// -> { size, cells: [{ i: [ix,iy,iz], c: [x,y,z], owner }], at: Map(key -> cell 번호), counts: [블록별 큐브 수] }
export function voxelize(seeds, size, box) {
  const bounds = outerBounds(seeds);
  const lo = [0, 1, 2].map((k) => Math.floor(box.min.getComponent(k) / size));
  const hi = [0, 1, 2].map((k) => Math.ceil(box.max.getComponent(k) / size));
  const cells = [], at = new Map(), counts = seeds.map(() => 0);
  for (let iy = lo[1]; iy < hi[1]; iy++) {
    for (let ix = lo[0]; ix < hi[0]; ix++) {
      for (let iz = lo[2]; iz < hi[2]; iz++) {
        const c = [(ix + 0.5) * size, (iy + 0.5) * size, (iz + 0.5) * size];
        if (!bounds.every((q) => dot(q.n, c) <= q.c)) continue;
        let owner = 0, best = Infinity;
        seeds.forEach((s, k) => {
          const d = (c[0] - s[0]) ** 2 + (c[1] - s[1]) ** 2 + (c[2] - s[2]) ** 2;
          if (d < best) { best = d; owner = k; }
        });
        at.set(key([ix, iy, iz]), cells.length);
        cells.push({ i: [ix, iy, iz], c, owner });
        counts[owner]++;
      }
    }
  }
  return { size, cells, at, counts };
}

// 블록 쌍마다 맞닿은 큐브 면: 'a,b'(a<b) -> [{ c: 면 중심, axis }]
export function contacts(vox) {
  const out = new Map();
  for (const cell of vox.cells) {
    AXES.forEach((e, axis) => {
      const n = vox.at.get(key([cell.i[0] + e[0], cell.i[1] + e[1], cell.i[2] + e[2]]));
      if (n === undefined) return;
      const other = vox.cells[n];
      if (other.owner === cell.owner) return;
      const k = cell.owner < other.owner ? `${cell.owner},${other.owner}` : `${other.owner},${cell.owner}`;
      if (!out.has(k)) out.set(k, []);
      out.get(k).push({ c: cell.c.map((v, j) => v + (e[j] * vox.size) / 2), axis });
    });
  }
  return out;
}

export const facesBetween = (faces, a, b) => faces.get(a < b ? `${a},${b}` : `${b},${a}`) ?? [];

// a 블록 큐브에서 b 블록 큐브까지 큐브 면을 따라 가는 최단 경로(큐브 번호들). 없으면 null.
export function route(vox, a, b) {
  const prev = new Map();
  const queue = [];
  vox.cells.forEach((cell, n) => { if (cell.owner === a) { prev.set(n, -1); queue.push(n); } });
  for (let head = 0; head < queue.length; head++) {
    const n = queue[head];
    if (vox.cells[n].owner === b) {
      const path = [];
      for (let p = n; p !== -1; p = prev.get(p)) path.unshift(p);
      return path;
    }
    const i = vox.cells[n].i;
    for (const e of AXES) {
      for (const s of [1, -1]) {
        const m = vox.at.get(key([i[0] + s * e[0], i[1] + s * e[1], i[2] + s * e[2]]));
        if (m === undefined || prev.has(m)) continue;
        prev.set(m, n);
        queue.push(m);
      }
    }
  }
  return null;
}

// 아래층부터: [{ iy, cells: [cell 번호] }]
export function layers(vox) {
  const by = new Map();
  vox.cells.forEach((cell, n) => {
    if (!by.has(cell.i[1])) by.set(cell.i[1], []);
    by.get(cell.i[1]).push(n);
  });
  return [...by.entries()].sort((x, y) => x[0] - y[0]).map(([iy, cells]) => ({ iy, cells }));
}
