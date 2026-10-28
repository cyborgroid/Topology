// 양자 코어의 부품: 블록 = 기기를 구동하고 회로를 완성하는 부품. 양자 코어(하나의 컴퓨터)는
// 가운데 양자 핵(QE 코어)과, 그 주위에서 코어를 구조화하고 3D 회로를 완성하는 부품들로 이루어진다.
// 부품 모형은 반지름 1 안에 들어가게 만들고(배치할 때 영역 크기만큼 키운다), +y 가 바깥(핵 반대쪽)을 향한다.
import * as THREE from 'three';

// 블록 종류 -> 부품
export const PARTS = {
  data:       { part: '메모리 모듈',               build: memory },
  phone:      { part: '보안 식별 칩',              build: secureChip },
  wifi:       { part: '안테나 모듈',               build: antenna },
  vpn:        { part: '암호 모듈 (차폐 캔)',       build: shieldedModule },
  network:    { part: '트랜시버',                  build: transceiver },
  bigdata:    { part: '저장 어레이',               build: storage },
  qe:         { part: '양자 핵 (큐비트 칩 · 냉각 단 · 차폐)', build: nucleus },
  instrument: { part: '제어 전자부 (마이크로파)',  build: controller },
  ai:         { part: '뉴럴 프로세서',             build: processor },
  graphic:    { part: '그래픽 프로세서',           build: gpu },
  topology:   { part: '디스플레이 출력부',         build: display },
};

// 신호 -> 배선 (반지름은 화면 단위)
export const CABLES = {
  quantum: { name: '초전도 동축선', radius: 0.11, jacket: true },
  command: { name: '마이크로파 제어선', radius: 0.07 },
  link:    { name: 'RF 동축선', radius: 0.07 },
  data:    { name: '데이터 버스', radius: 0.06 },
  id:      { name: '보안 버스', radius: 0.05 },
  token:   { name: '고속 버스', radius: 0.06 },
  screen:  { name: '디스플레이 링크', radius: 0.06 },
};

const M = {
  board: new THREE.MeshStandardMaterial({ color: 0x2a6b4c, roughness: 0.7 }),
  chip: new THREE.MeshStandardMaterial({ color: 0x2b3038, roughness: 0.45 }),
  metal: new THREE.MeshStandardMaterial({ color: 0xc8d4dc, metalness: 0.45, roughness: 0.35 }),   // 환경맵이 없어 금속도를 낮춘다
  gold: new THREE.MeshStandardMaterial({ color: 0xe8b84a, metalness: 0.5, roughness: 0.3, emissive: 0x3a2a08 }),
  shield: new THREE.MeshStandardMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide }),
};
export const STRUT = new THREE.MeshStandardMaterial({ color: 0x9aa6b0, metalness: 0.4, roughness: 0.4 });

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
const board = (g, w = 1.6, d = 1.6) => g.add(box(w, 0.1, d, M.board, 0, -0.3));

// 부품 하나: { group, accent } — accent 는 블록 색·신호 세기로 빛나는 재질
export function buildPart(type, color) {
  const accent = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.4, roughness: 0.35, metalness: 0.2 });
  const group = new THREE.Group();
  PARTS[type].build(group, accent);
  return { group, accent };
}

function memory(g, a) {
  board(g, 1.7, 1.1);
  for (let i = 0; i < 4; i++) g.add(box(0.32, 0.22, 0.7, M.chip, -0.6 + i * 0.4, -0.14));
  g.add(box(1.6, 0.05, 0.12, M.gold, 0, -0.33, 0.55));   // 끝단 접점
  g.add(box(0.2, 0.06, 0.2, a, 0.7, 0, -0.35));
}

function secureChip(g, a) {
  g.add(box(1.0, 0.08, 1.3, M.board, 0, -0.3));
  for (let x = 0; x < 3; x++) for (let z = 0; z < 2; z++) g.add(box(0.22, 0.03, 0.3, M.gold, -0.3 + x * 0.3, -0.24, -0.25 + z * 0.5));
  g.add(box(0.36, 0.12, 0.36, a, 0, -0.18, 0));
}

function antenna(g, a) {
  board(g, 1.2, 1.2);
  g.add(cyl(0.05, 1.5, M.metal, -0.3, 0.45, 0, 8), cyl(0.05, 1.5, M.metal, 0.3, 0.45, 0, 8));   // 다이폴
  const coil = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.04, 8, 32), M.gold);
  coil.rotation.x = Math.PI / 2;
  coil.position.y = -0.15;
  g.add(coil, box(0.3, 0.14, 0.3, a, 0, -0.18, 0));
}

function shieldedModule(g, a) {
  board(g, 1.4, 1.4);
  g.add(box(1.1, 0.45, 1.1, M.metal, 0, -0.02));                       // 차폐 캔
  const lock = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.06, 8, 24), a);
  lock.rotation.x = Math.PI / 2;
  lock.position.y = 0.24;
  g.add(lock);
}

function transceiver(g, a) {
  board(g, 1.6, 1.4);
  g.add(box(0.6, 0.12, 0.6, M.chip, -0.2, -0.19));
  for (let i = 0; i < 4; i++) g.add(box(0.26, 0.3, 0.3, M.metal, 0.65, -0.1, -0.5 + i * 0.33));   // 포트
  g.add(box(0.25, 0.08, 0.25, a, -0.2, -0.1));
}

function storage(g, a) {
  for (let i = 0; i < 3; i++) g.add(cyl(0.8, 0.12, i % 2 ? M.metal : M.chip, 0, -0.3 + i * 0.22, 0, 32));
  g.add(cyl(0.12, 0.8, a, 0, 0, 0, 12));
}

function controller(g, a) {
  board(g, 1.7, 1.3);
  g.add(box(0.7, 0.14, 0.5, M.chip, -0.3, -0.18));
  for (let i = 0; i < 5; i++) g.add(cyl(0.07, 0.35, M.gold, 0.15 + i * 0.16, -0.08, 0.45, 10));   // SMA 커넥터 줄
  g.add(box(0.3, 0.08, 0.3, a, -0.3, -0.07));
}

function processor(g, a) {
  board(g, 1.6, 1.6);
  g.add(box(0.8, 0.08, 0.8, a, 0, -0.21));
  for (let i = 0; i < 7; i++) g.add(box(0.06, 0.5, 0.9, M.metal, -0.36 + i * 0.12, 0.1));   // 방열핀
}

function gpu(g, a) {
  board(g, 1.8, 1.2);
  g.add(box(0.6, 0.08, 0.6, M.chip, -0.4, -0.21));
  const fan = new THREE.Group();
  fan.add(new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.05, 8, 32), M.metal));
  for (let i = 0; i < 6; i++) {
    const blade = box(0.36, 0.02, 0.12, a);
    blade.rotation.y = (i / 6) * Math.PI;
    fan.add(blade);
  }
  fan.rotation.x = Math.PI / 2;
  fan.position.set(0.35, -0.1, 0);
  g.add(fan);
}

function display(g, a) {
  g.add(box(1.8, 0.08, 1.2, M.chip, 0, -0.3), box(1.66, 0.02, 1.06, a, 0, -0.25));   // 화면
  g.add(box(0.5, 0.1, 0.2, M.metal, 0, -0.4, 0.62));
}

// 양자 핵: 큐비트 칩을 매단 냉각 단(금도금 판 3 장 + 지지봉) + 차폐 구
function nucleus(g, a) {
  [[0.5, 0.9], [0.05, 0.75], [-0.4, 0.6]].forEach(([y, r]) => g.add(cyl(r, 0.06, M.gold, 0, y, 0, 40)));
  for (let i = 0; i < 4; i++) {
    const t = (i / 4) * Math.PI * 2;
    g.add(cyl(0.035, 0.9, M.metal, Math.cos(t) * 0.5, 0.05, Math.sin(t) * 0.5, 8));
  }
  g.add(box(0.36, 0.05, 0.36, a, 0, -0.62), cyl(0.03, 0.2, M.gold, 0, -0.5, 0, 8));   // 큐비트 칩
  g.add(new THREE.Mesh(new THREE.SphereGeometry(1.15, 32, 20), M.shield));
}
