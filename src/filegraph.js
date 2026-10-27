// 실제 폴더와 파일을 블록으로 심는다.
// 폴더의 내용은 그 폴더보다 한 단계 뒤(-z)·아래에 매달린 판(plate) 위에 격자로 놓이므로,
// 폴더 구조가 계단처럼 깊어지고 스크롤 앞 = 한 단계 깊이 들어가기가 된다.
import * as THREE from 'three';
import { api } from './bridge.js';
import { addNode, addLink, getNode, removeNode, setPlate, removePlate, enter, ancestorsOf, camera } from './diagram.js';
import { ANCHORS, FILE_COLORS, LINKS, NODES } from './topology.config.js';

const PAGE = 60;
const LEVEL_GAP = 7;
const CELL_W = 3.2, CELL_H = 1.5, MAX_COLS = 10;
const ANCHOR_SPREAD = 3.4;

// path -> { id, name, expanded, children: [노드 id], loaded, total, cols, grid }
const planted = new Map();
const fsId = (p) => `fs:${p}`;
const aliasId = (p) => `alias:${p}`;
const plateId = (p) => `plate:${p}`;
const moreId = (p) => `more:${p}`;

function formatBytes(n) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(i ? 1 : 0)} ${units[i]}`;
}

function plant(e, name, pos, parentId) {
  const id = fsId(e.path);
  addNode({
    id, name, pos, parentId,
    kind: e.dir ? 'folder' : 'file',
    color: e.dir ? FILE_COLORS.folder : FILE_COLORS.file,
    data: { path: e.path, dir: e.dir, size: e.size },
  });
  if (e.dir) planted.set(e.path, { id, name, expanded: false, children: [], loaded: 0, total: 0, cols: 0, grid: null });
  return id;
}

// 판의 위치와 크기: 폴더 블록 바로 아래에 윗변을 두고 한 단계 뒤에 놓는다.
function gridFor(entry, count) {
  const f = getNode(entry.id).position;
  const rows = Math.max(1, Math.ceil(count / entry.cols));
  const w = entry.cols * CELL_W + 0.8;
  const h = rows * CELL_H + 1.2;
  const top = f.y - 2.2;
  return {
    cols: entry.cols, w, h, top,
    left: f.x - (entry.cols * CELL_W) / 2,
    center: new THREE.Vector3(f.x, top - h / 2, f.z - LEVEL_GAP),
  };
}

function cellPos(grid, i) {
  const c = i % grid.cols, r = Math.floor(i / grid.cols);
  return new THREE.Vector3(grid.left + CELL_W * (c + 0.5), grid.top - 0.9 - CELL_H * r, grid.center.z + 0.3);
}

async function loadPage(path) {
  const entry = planted.get(path);
  if (!entry) return;
  const r = await api.listDir(path, { limit: PAGE, offset: entry.loaded });
  if (r.error || !planted.has(path)) return;

  entry.total = r.total;
  entry.cols ||= THREE.MathUtils.clamp(Math.ceil(Math.sqrt(Math.max(r.total, 1) * 2.2)), 2, MAX_COLS);
  removeNode(moreId(path));
  entry.children = entry.children.filter((id) => id !== moreId(path));

  const start = entry.loaded;
  entry.loaded += r.entries.length;
  const hasMore = entry.loaded < entry.total;
  entry.grid = gridFor(entry, entry.loaded + (hasMore ? 1 : 0));
  setPlate(plateId(path), { center: entry.grid.center, w: entry.grid.w, h: entry.grid.h, title: `${entry.name} · ${r.total}개` });
  addLink(entry.id, plateId(path));

  r.entries.forEach((e, k) => {
    const pos = cellPos(entry.grid, start + k);
    if (getNode(fsId(e.path))) {
      // 이미 다른 개념 블록에 접목된 폴더(문서, 다운로드 …)는 바로가기 블록으로 잇는다.
      addNode({
        id: aliasId(e.path), name: `↗ ${e.name}`, kind: 'folder', color: FILE_COLORS.folder, pos,
        parentId: entry.id, data: { path: e.path, dir: true, alias: fsId(e.path) },
      });
      addLink(aliasId(e.path), fsId(e.path));
      entry.children.push(aliasId(e.path));
    } else {
      entry.children.push(plant(e, e.name, pos, entry.id));
    }
  });

  if (hasMore) {
    addNode({
      id: moreId(path), name: `… ${entry.total - entry.loaded}개 더`, kind: 'more', color: FILE_COLORS.more,
      pos: cellPos(entry.grid, entry.loaded), parentId: entry.id, data: { path },
    });
    entry.children.push(moreId(path));
  }
}

async function expand(path) {
  const entry = planted.get(path);
  if (!entry || entry.expanded) return;
  entry.expanded = true;
  await loadPage(path);
}

function collapse(path) {
  const entry = planted.get(path);
  if (!entry || !entry.expanded) return;
  for (const id of entry.children) {
    if (id.startsWith('fs:')) {
      const child = id.slice(3);
      collapse(child);
      planted.delete(child);
    }
    removeNode(id);
  }
  removePlate(plateId(path));
  Object.assign(entry, { expanded: false, children: [], loaded: 0, total: 0, cols: 0, grid: null });
}

// --- diagram hooks -----------------------------------------------------------
export async function onEnter(u) {
  if (u.kind === 'more') return loadPage(u.data.path);
  if (u.kind !== 'folder') return;
  // 지금 들어간 폴더의 조상 줄기만 남기고 나머지 펼침은 접어서 한 갈래만 보이게 한다.
  const keep = new Set(ancestorsOf(u.id).map((a) => a.data.path).filter(Boolean));
  for (const [p, e] of [...planted]) {
    if (e.expanded && !keep.has(p) && planted.has(p)) collapse(p);
  }
  await expand(u.data.path);
}

const tanHalf = () => Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));

export function frameFor(u) {
  const node = getNode(u.id);
  if (u.kind === 'folder') {
    const grid = planted.get(u.data.path)?.grid;
    if (!grid) return { target: node.position.clone(), offset: new THREE.Vector3(0, 0.35, 1).setLength(9) };
    const fit = Math.max(grid.h / (2 * tanHalf()), grid.w / (2 * tanHalf() * camera.aspect));
    const offset = new THREE.Vector3(0, 0.04, 1).normalize();   // 거의 수평: 위의 폴더 블록이 판을 덮지 않게
    // 판이 작아도 카메라는 폴더 블록(판보다 LEVEL_GAP 앞)의 뒤쪽에 있어야 블록에 가리지 않는다.
    const minDist = (LEVEL_GAP + 6) / offset.z;
    return {
      target: grid.center.clone().add(new THREE.Vector3(0, 1.2, 0)),
      offset: offset.multiplyScalar(Math.max(fit * 1.08 + 2, minDist)),
    };
  }
  // 개념 블록: 블록과 그 뒤에 접목된 폴더들을 비스듬히 본다.
  return {
    target: node.position.clone().add(new THREE.Vector3(0, -1, -LEVEL_GAP / 2)),
    offset: new THREE.Vector3(0.9, 0.5, 1).setLength(16),
  };
}

export async function describe(u) {
  if (u.kind === 'file') return formatBytes(u.data.size ?? 0);
  if (u.kind === 'folder') {
    const entry = planted.get(u.data.path);
    const total = entry?.expanded ? entry.total : (await api.listDir(u.data.path, { limit: 0 })).total;
    return `${total}개 항목`;
  }
  if (u.kind === 'concept') {
    const names = Object.fromEntries(NODES.map((n) => [n.id, n.name]));
    const linked = LINKS.filter((l) => l.includes(u.id)).map((l) => names[l[0] === u.id ? l[1] : l[0]]);
    const folders = ANCHORS.filter((a) => a.node === u.id).map((a) => `${a.place} (${a.reason})`);
    return [`연결: ${linked.join(', ')}`, folders.length ? `접목된 폴더: ${folders.join(', ')}` : ''].filter(Boolean).join('\n');
  }
  return '';
}

// 실제 경로를 따라 폴더 판을 차례로 펼치고 그 폴더로 들어간다.
export async function reveal(path) {
  let base = [...planted.keys()].filter((p) => path === p || path.startsWith(`${p}/`)).sort((a, b) => b.length - a.length)[0];
  if (!base) return;
  for (const part of path.slice(base.length).split('/').filter(Boolean)) {
    await expand(base);
    base = `${base}/${part}`;
  }
  if (getNode(fsId(base))) await enter(fsId(base));
}

// 홈과 XDG 폴더를 ANCHORS 에 따라 개념 블록 바로 뒤에 접목한다.
export async function plantFileSystem(places) {
  const valid = [];
  for (const a of ANCHORS) {
    const path = places[a.place];
    if (!path || !getNode(a.node) || valid.some((v) => v.path === path)) continue;
    if ((await api.listDir(path, { limit: 0 })).error) continue;
    valid.push({ ...a, path });
  }
  for (const a of valid) {
    const siblings = valid.filter((v) => v.node === a.node);
    const k = siblings.indexOf(a);
    const block = getNode(a.node).position;
    const pos = new THREE.Vector3(block.x + (k - (siblings.length - 1) / 2) * ANCHOR_SPREAD, block.y, block.z - LEVEL_GAP);
    plant({ path: a.path, dir: true }, a.place === 'home' ? '~ 홈' : a.path.split('/').pop(), pos, a.node);
    addLink(a.node, fsId(a.path));
  }
  await expand(places.home);
}
