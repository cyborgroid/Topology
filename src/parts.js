// 모듈을 부품 쪽으로: 코어 조각(모듈)의 바깥 면에 그 블록의 기능을 드러내는 '기능면'을 새기고,
// 맞닿은 면에는 신호 규격의 커넥터 하우징을 단다. 기능면은 따로 붙인 기기가 아니라 하나의 코어 외피에 새겨진 부품 면이다.
// 모형은 반지름 1 안, +y 가 면의 바깥쪽이다 (놓을 때 면 크기만큼 키우고 면의 법선에 맞춘다).
import * as THREE from 'three';

// 블록 종류 -> 기능면
export const FEATURES = {
  data:       { name: '메모리 셀 배열', build: memory },
  phone:      { name: '식별 접점', build: contacts },
  wifi:       { name: '안테나 코일', build: antenna },
  vpn:        { name: '차폐 격자', build: shield },
  network:    { name: '포트 배열', build: ports },
  bigdata:    { name: '디스크 스택', build: disks },
  instrument: { name: '제어 커넥터 줄', build: controls },
  ai:         { name: '연산 다이 · 방열핀', build: processor },
  graphic:    { name: '그래픽 다이 · 팬', build: gpu },
  topology:   { name: '표시면', build: display },
};

// 신호 -> 커넥터 규격
export const CONNECTORS = {
  quantum: { name: '동축 커넥터 (초전도)', pins: 1 },
  command: { name: '4핀 제어 커넥터', pins: 4 },
  link:    { name: 'RF 동축 커넥터', pins: 1 },
  data:    { name: '8핀 데이터 커넥터', pins: 8 },
  id:      { name: '6핀 보안 커넥터', pins: 6 },
  token:   { name: '8핀 고속 커넥터', pins: 8 },
  screen:  { name: '10핀 디스플레이 커넥터', pins: 10 },
};

// 공유 재질 (코어 절개도의 잘라 내기 평면은 diagram 이 넣는다)
export const MATERIALS = {
  chip: new THREE.MeshStandardMaterial({ color: 0x2b3038, roughness: 0.45 }),
  metal: new THREE.MeshStandardMaterial({ color: 0xc8d4dc, metalness: 0.45, roughness: 0.35 }),   // 환경맵이 없어 금속도를 낮춘다
  gold: new THREE.MeshStandardMaterial({ color: 0xe8b84a, metalness: 0.5, roughness: 0.3, emissive: 0x3a2a08 }),
  housing: new THREE.MeshStandardMaterial({ color: 0x1c2228, roughness: 0.6 }),
};
const M = MATERIALS;

const box = (w, h, d, mat, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
};
const cyl = (r, h, mat, x = 0, y = 0, z = 0, seg = 16) => {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), mat);
  m.position.set(x, y, z);
  return m;
};
const ring = (r, t, mat, y = 0) => {
  const m = new THREE.Mesh(new THREE.TorusGeometry(r, t, 8, 32), mat);
  m.rotation.x = Math.PI / 2;
  m.position.y = y;
  return m;
};

// 기능면 하나: accent = 블록 색으로 빛나는 재질 (신호 세기에 따라 diagram 이 밝기를 바꾼다)
export function buildFeature(type, accent) {
  const g = new THREE.Group();
  FEATURES[type]?.build(g, accent);
  return g;
}

function memory(g, a) {
  for (let x = 0; x < 4; x++) for (let z = 0; z < 3; z++) g.add(box(0.36, 0.12, 0.5, x === 3 && z === 2 ? a : M.chip, -0.6 + x * 0.4, 0.06, -0.55 + z * 0.55));
}
function contacts(g, a) {
  for (let x = 0; x < 3; x++) for (let z = 0; z < 2; z++) g.add(box(0.36, 0.04, 0.5, M.gold, -0.42 + x * 0.42, 0.02, -0.3 + z * 0.6));
  g.add(box(0.3, 0.1, 0.3, a, 0, 0.06, 0));
}
function antenna(g, a) {
  g.add(ring(0.75, 0.05, M.gold, 0.03), ring(0.5, 0.05, M.gold, 0.03), ring(0.25, 0.05, a, 0.03));
}
function shield(g, a) {
  for (let i = -3; i <= 3; i++) g.add(box(1.5, 0.05, 0.05, M.metal, 0, 0.03, i * 0.22), box(0.05, 0.05, 1.5, M.metal, i * 0.22, 0.03, 0));
  g.add(ring(0.22, 0.06, a, 0.08));
}
function ports(g, a) {
  for (let i = 0; i < 4; i++) g.add(box(0.32, 0.22, 0.4, M.metal, -0.6 + i * 0.4, 0.11, 0), box(0.2, 0.1, 0.3, M.housing, -0.6 + i * 0.4, 0.2, 0));
  g.add(box(1.5, 0.04, 0.12, a, 0, 0.02, 0.4));
}
function disks(g, a) {
  for (let i = 0; i < 3; i++) g.add(cyl(0.7 - i * 0.12, 0.08, i % 2 ? M.metal : M.chip, 0, 0.04 + i * 0.09, 0, 36));
  g.add(cyl(0.1, 0.32, a, 0, 0.16, 0, 12));
}
function controls(g, a) {
  for (let i = 0; i < 6; i++) g.add(cyl(0.09, 0.32, M.gold, -0.75 + i * 0.3, 0.16, 0, 12));
  g.add(box(1.7, 0.06, 0.3, a, 0, 0.03, 0.4));
}
function processor(g, a) {
  g.add(box(0.8, 0.06, 0.8, a, 0, 0.03, 0));
  for (let i = 0; i < 7; i++) g.add(box(0.06, 0.4, 1.2, M.metal, -0.54 + i * 0.18, 0.26, 0));
}
function gpu(g, a) {
  const fan = new THREE.Group();
  fan.add(ring(0.45, 0.05, M.metal, 0));
  for (let i = 0; i < 6; i++) {
    const blade = box(0.4, 0.02, 0.12, a);
    blade.rotation.y = (i / 6) * Math.PI;
    fan.add(blade);
  }
  fan.position.set(0.35, 0.08, 0);
  g.add(box(0.6, 0.06, 0.6, M.chip, -0.45, 0.03, 0), fan);
}
function display(g, a) {
  g.add(box(1.7, 0.05, 1.1, M.chip, 0, 0.025, 0), box(1.56, 0.02, 0.96, a, 0, 0.06, 0));
}

// 커넥터 하우징: male = 금도금 핀이 선 수 커넥터, female = 소켓 구멍이 난 암 커넥터. 띠 = 신호 색
export function buildConnector(type, stripe, male) {
  const spec = CONNECTORS[type] ?? CONNECTORS.data;
  const g = new THREE.Group();
  const coax = spec.pins === 1;
  if (coax) {
    g.add(cyl(0.32, 0.3, M.metal, 0, 0.15, 0, 20), cyl(0.36, 0.06, stripe, 0, 0.3, 0, 20));
    if (male) g.add(cyl(0.07, 0.5, M.gold, 0, 0.45, 0, 10));
    else g.add(cyl(0.12, 0.05, M.housing, 0, 0.33, 0, 12));
    return g;
  }
  const w = 0.16 * spec.pins + 0.2;
  g.add(box(w, 0.28, 0.42, M.housing, 0, 0.14, 0), box(w, 0.05, 0.08, stripe, 0, 0.3, 0.2));
  for (let i = 0; i < spec.pins; i++) {
    const x = -w / 2 + 0.18 + i * 0.16;
    g.add(male ? cyl(0.03, 0.3, M.gold, x, 0.4, 0, 6) : box(0.06, 0.02, 0.06, M.chip, x, 0.29, 0));
  }
  return g;
}
