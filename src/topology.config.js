// Topology.md 의 개념을 PCB 회로로 옮긴 설정.
// 층(TIERS)은 위에서 아래로 쌓인 기판 레이어이고, 개념은 칩, LINKS 는 배선이다.

export const GROUPS = {
  core:     { color: 0x2fb6d9, label: 'Topology' },
  hardware: { color: 0x5b6fd6, label: 'Chassis & Circuit' },
  language: { color: 0xd9a62f, label: 'Instrument' },
  mind:     { color: 0xc04fa6, label: 'AI & Graphic' },
  nature:   { color: 0x2fb37a, label: 'QE' },
  network:  { color: 0xd9733b, label: 'Network' },
};

export const NODES = [
  { id: 'qe',         name: 'QE',         group: 'nature',   desc: '양자역학 + 자연상태. 불확정성의 원리로 자연을 분석한다.' },
  { id: 'chassis',    name: 'Chassis',    group: 'hardware', desc: '전자 기기의 외관. Analog & Digital 공용.' },
  { id: 'circuit',    name: 'Circuit',    group: 'hardware', desc: '전자 기기의 회로. Analog & Digital 공용.' },
  { id: 'instrument', name: 'Instrument', group: 'language', desc: 'Analog 의 언어. 양자화 + 블록 컴퓨팅이 필요한 핵심.' },
  { id: 'topology',   name: 'Topology',   group: 'core',     desc: 'Analog 화면 사양. Digital 의 OS 를 대신한다.' },
  { id: 'ai',         name: 'AI',         group: 'mind',     desc: '블록 코딩 기반 챗봇. 데이터에서 토큰이 만들어진다.' },
  { id: 'graphic',    name: 'Graphic',    group: 'mind',     desc: '블록 코딩으로 챗봇의 그래픽 처리를 개선한다.' },
  { id: 'network',    name: 'Network',    group: 'network',  desc: '계정 / 데이터 / VPN / WIFI 를 한 곳에서 다룬다.' },
  { id: 'phone',      name: '전화번호',    group: 'network',  desc: '가장 많이 쓰는 고유 식별 번호. 계정으로 통용된다.' },
  { id: 'data',       name: '데이터',      group: 'network',  desc: '기기에서 만들어서 쓴다.' },
  { id: 'vpn',        name: 'VPN',        group: 'network',  desc: '데이터에 더하면 국경을 초월한다.' },
  { id: 'wifi',       name: 'WIFI',       group: 'network',  desc: '주변 환경 파악에 필수.' },
  { id: 'bigdata',    name: '빅데이터',    group: 'network',  desc: '네트워크의 모체가 되는 출처.' },
];

// 기판 레이어: 위(1층)에서 아래로. QE 가 맨 위에서 신호를 연다.
export const TIERS = [
  { name: '① 자연 · 양자',     blocks: ['qe'] },
  { name: '② 하드웨어',        blocks: ['chassis', 'circuit'] },
  { name: '③ 언어',            blocks: ['instrument'] },
  { name: '④ 화면 (OS)',       blocks: ['topology'] },
  { name: '⑤ 지능 · 표현',     blocks: ['ai', 'graphic'] },
  { name: '⑥ 네트워크',        blocks: ['network', 'phone', 'data', 'vpn', 'wifi', 'bigdata'] },
];

// 개념 사이의 관계(Topology.md [결과]) = 배선. 다른 층끼리는 비아로 이어진다.
export const LINKS = [
  ['topology', 'qe'],
  ['topology', 'instrument'],
  ['topology', 'chassis'],
  ['topology', 'circuit'],
  ['topology', 'network'],
  ['chassis', 'circuit'],
  ['instrument', 'ai'],
  ['instrument', 'graphic'],
  ['instrument', 'phone'],
  ['ai', 'graphic'],
  ['network', 'phone'],
  ['network', 'data'],
  ['network', 'vpn'],
  ['network', 'wifi'],
  ['data', 'vpn'],
  ['data', 'ai'],
  ['bigdata', 'network'],
  ['bigdata', 'data'],
];

// 실제 폴더를 개념 칩에 접목한다(정보 패널에서 데스크톱 폴더 층으로 열기). place 는 app/os-api.js 의 places() 키.
export const ANCHORS = [
  { place: 'home',      node: 'topology',   reason: '모든 데이터의 시작점' },
  { place: 'desktop',   node: 'topology',   reason: '화면 = Topology' },
  { place: 'documents', node: 'instrument', reason: '기록은 Analog 의 언어' },
  { place: 'templates', node: 'circuit',    reason: '설계의 틀' },
  { place: 'downloads', node: 'network',    reason: '네트워크에서 들어온 데이터' },
  { place: 'public',    node: 'network',    reason: '네트워크로 나가는 데이터' },
  { place: 'pictures',  node: 'graphic',    reason: '그래픽' },
  { place: 'videos',    node: 'graphic',    reason: '그래픽' },
  { place: 'music',     node: 'qe',         reason: '자연의 소리' },
];

export const CONTROLS = {
  orbitSensitivity: 0.005,
  fineFactor: 0.4,
};
