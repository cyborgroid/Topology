// 실제 폴더와 파일을 Topology 그래프의 노드로 심는다.
// 폴더는 부모에서 바깥쪽으로 뻗는 원뿔 위에 자식들을 펼치므로, 펼칠수록 가지처럼 자란다.
import * as THREE from 'three';
import { addNode, addLink, getNode, removeNode, flyToPoint } from './scene.js';
import { ANCHORS, FILE_COLORS } from './topology.config.js';

const api = window.topology;
const MAX_CHILDREN = 48;
const SPREAD = THREE.MathUtils.degToRad(70);
const GOLDEN = Math.PI * (3 - Math.sqrt(5));

// path -> { id, dir(바깥 방향), expanded, children: [자식 id] }
const planted = new Map();
const fsId = (p) => `fs:${p}`;

// dir 을 중심축으로 하는 원뿔 위에 n 개의 방향을 고르게 뿌린다.
function coneDirections(dir, n) {
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
  const minCos = Math.cos(SPREAD);
  return Array.from({ length: n }, (_, i) => {
    const theta = Math.acos(1 - ((i + 0.5) / n) * (1 - minCos));
    const phi = i * GOLDEN;
    return new THREE.Vector3(Math.sin(theta) * Math.cos(phi), Math.sin(theta) * Math.sin(phi), Math.cos(theta))
      .applyQuaternion(q);
  });
}

function plant({ path, name, dir: isDir, pos, outward, parentId }) {
  const id = fsId(path);
  addNode({
    id, name, pos,
    kind: isDir ? 'folder' : 'file',
    color: isDir ? FILE_COLORS.folder : FILE_COLORS.file,
    size: isDir ? 0.55 : 0.3,
    data: { path, dir: isDir },
  });
  if (parentId) addLink(parentId, id);
  if (isDir) planted.set(path, { id, dir: outward.clone().normalize(), expanded: false, children: [] });
  return id;
}

export async function expand(path) {
  const entry = planted.get(path);
  if (!entry || entry.expanded) return;
  entry.expanded = true;
  const parent = getNode(entry.id);
  const list = await api.listDir(path, { limit: MAX_CHILDREN });
  const extra = list.total - list.entries.length;
  const count = list.entries.length + (extra > 0 ? 1 : 0);
  if (!count) return;

  const radius = 3 + Math.sqrt(count) * 1.4;
  const dirs = coneDirections(entry.dir, count);
  list.entries.forEach((e, i) => {
    // 이미 다른 개념 노드에 접목된 폴더(예: 문서, 다운로드)는 새로 만들지 않고 잇기만 한다.
    if (getNode(fsId(e.path))) { addLink(entry.id, fsId(e.path)); return; }
    const pos = parent.userData.base.clone().addScaledVector(dirs[i], radius);
    entry.children.push(plant({ ...e, pos, outward: dirs[i], parentId: entry.id }));
  });
  if (extra > 0) {
    const id = `more:${path}`;
    addNode({
      id, name: `… +${extra}`, kind: 'more', color: FILE_COLORS.more, size: 0.3,
      pos: parent.userData.base.clone().addScaledVector(dirs[count - 1], radius),
      data: { path, dir: true },
    });
    addLink(entry.id, id);
    entry.children.push(id);
  }
}

export function collapse(path) {
  const entry = planted.get(path);
  if (!entry || !entry.expanded) return;
  for (const id of entry.children) {
    const childPath = id.slice(id.indexOf(':') + 1);
    if (id.startsWith('fs:')) collapse(childPath);
    planted.delete(childPath);
    removeNode(id);
  }
  entry.children = [];
  entry.expanded = false;
}

export function toggle(path) {
  return planted.get(path)?.expanded ? collapse(path) : expand(path);
}

// 실제 경로를 따라 필요한 폴더를 펼치고 그 노드로 날아간다.
export async function reveal(path) {
  let base = [...planted.keys()].filter((p) => path === p || path.startsWith(p + '/'))
    .sort((a, b) => b.length - a.length)[0];
  if (!base) return false;
  for (const part of path.slice(base.length).split('/').filter(Boolean)) {
    await expand(base);
    base = `${base}/${part}`;
  }
  const node = getNode(fsId(base));
  if (!node) return false;
  flyToPoint(node.userData.base, 9);
  return true;
}

// 홈과 XDG 폴더를 ANCHORS 에 따라 개념 노드 바깥쪽에 심는다.
export async function plantFileSystem(places) {
  const center = getNode('topology').userData.base;
  const perAnchor = new Map();
  for (const { place, node, dir } of ANCHORS) {
    const path = places[place];
    const anchor = getNode(node);
    if (!path || !anchor || planted.has(path)) continue;
    const exists = await api.listDir(path, { limit: 0 });
    if (exists.error) continue;

    const a = anchor.userData.base;
    const outward = dir ? new THREE.Vector3(...dir) : a.clone().sub(center);
    // 같은 개념 노드에 여러 폴더가 붙으면 축을 조금씩 돌려 겹치지 않게 한다.
    const k = dir ? 0 : perAnchor.get(node) ?? 0;
    if (!dir) perAnchor.set(node, k + 1);
    outward.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), k * 0.7).applyAxisAngle(new THREE.Vector3(1, 0, 0), k * 0.3);

    plant({
      path, name: place === 'home' ? '~ 홈' : path.split('/').pop(), dir: true,
      pos: a.clone().addScaledVector(outward, (dir ? 9 : 4) + k), outward, parentId: node,
    });
  }
  await expand(places.home);
  await expand(places.desktop);
}
