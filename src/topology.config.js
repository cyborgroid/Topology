// Quantum Neuron Block Computing 의 재료.
// 사용자는 No Base(빈 상태)에서 양자 뉴런 블록을 쌓아 AI 구조를 만든다. 뉴런에는 Topology.md 의 개념 이름을 붙일 수 있다.
// Chassis 와 Circuit 은 Topology.md 에서 "여기서 다루지 않는다" 고 했으므로 넣지 않는다.

export const GROUPS = {
  nature:   { color: 0x2fd6a0, label: 'QE' },
  language: { color: 0xe0b341, label: 'Instrument' },
  core:     { color: 0x2fb6d9, label: 'Topology' },
  mind:     { color: 0xd55fbf, label: 'AI & Graphic' },
  network:  { color: 0xe88a4e, label: 'Network' },
};

export const NODES = [
  { id: 'qe',         name: 'QE',         group: 'nature',   desc: '양자역학 + 자연상태. 불확정성의 원리로 자연을 분석한다.' },
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

// 실제 폴더를 개념에 접목한다. 그 개념 이름의 뉴런을 고르면 정보 패널에서 데스크톱 폴더 층으로 연다. place 는 app/os-api.js 의 places() 키.
export const ANCHORS = [
  { place: 'home',      node: 'topology',   reason: '모든 데이터의 시작점' },
  { place: 'desktop',   node: 'topology',   reason: '화면 = Topology' },
  { place: 'documents', node: 'instrument', reason: '기록은 Analog 의 언어' },
  { place: 'templates', node: 'instrument', reason: '명령의 틀' },
  { place: 'downloads', node: 'network',    reason: '네트워크에서 들어온 데이터' },
  { place: 'public',    node: 'network',    reason: '네트워크로 나가는 데이터' },
  { place: 'pictures',  node: 'graphic',    reason: '그래픽' },
  { place: 'videos',    node: 'graphic',    reason: '그래픽' },
  { place: 'music',     node: 'qe',         reason: '자연의 소리' },
];

// 물리 설계 가정값 — Quantum Analog Neuron Core 를 실제로 만들 때 이 값을 바꾸면 설계도가 따라 바뀐다.
// 블록(영역)의 재료는 묶음(group)을 따른다. 접촉면은 패드, 떨어진 연결은 브리지(도체)로 잇는다.
export const PHYSICAL = {
  unitMM: 10,   // 화면 1 = 10 mm
  materials: {
    '환경':        { name: '실리콘', density: 2.33 },     // g/cm³
    '네트워크':    { name: '구리', density: 8.96 },
    '양자 · 처리': { name: '사파이어', density: 3.98 },
    '화면':        { name: '유리', density: 2.5 },
  },
  pad: { name: '구리 패드', conductivity: 5.96e7 },            // S/m — 접촉면 전체가 패드
  bridge: { name: '구리 브리지', conductivity: 5.96e7, sectionMM2: 1 },
  signalSpeed: 0.6,   // 빛의 속도 대비 신호 속도
  gap: 0.06,          // 이웃 영역 사이 틈 = 씨앗 거리 × gap (패드 두께)
};

export const CONTROLS = {
  orbitSensitivity: 0.005,
  fineFactor: 0.4,
};
