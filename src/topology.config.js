// Topology.md 의 [정의] / [대상] / [결과] 를 3D 노드와 링크로 옮긴 설정.
// group 은 색상 구분용이다.

export const GROUPS = {
  core:     { color: 0x7fe7ff, label: 'Topology' },
  hardware: { color: 0xa0b4ff, label: 'Chassis & Circuit' },
  language: { color: 0xffd36e, label: 'Instrument' },
  mind:     { color: 0xff8ad8, label: 'AI & Graphic' },
  nature:   { color: 0x8affc1, label: 'QE' },
  network:  { color: 0xffa36b, label: 'Network' },
};

export const NODES = [
  { id: 'topology',   name: 'Topology',   group: 'core',     pos: [0, 0, 0],      size: 2.2,
    desc: 'Analog 화면 사양. Digital 의 OS 를 대신한다.' },
  { id: 'qe',         name: 'QE',         group: 'nature',   pos: [0, 9, -6],     size: 1.5,
    desc: '양자역학 + 자연상태. 불확정성의 원리로 자연을 분석한다.' },
  { id: 'instrument', name: 'Instrument', group: 'language', pos: [10, 2, 0],     size: 1.6,
    desc: 'Analog 의 언어. 양자화 + 블록 컴퓨팅이 필요한 핵심.' },
  { id: 'chassis',    name: 'Chassis',    group: 'hardware', pos: [-9, -4, 4],    size: 1.2,
    desc: '전자 기기의 외관. Analog & Digital 공용.' },
  { id: 'circuit',    name: 'Circuit',    group: 'hardware', pos: [-9, -4, -4],   size: 1.2,
    desc: '전자 기기의 회로. Analog & Digital 공용.' },
  { id: 'ai',         name: 'AI',         group: 'mind',     pos: [16, 7, -5],    size: 1.3,
    desc: '블록 코딩 기반 챗봇. 데이터에서 토큰이 만들어진다.' },
  { id: 'graphic',    name: 'Graphic',    group: 'mind',     pos: [17, -3, -6],   size: 1.1,
    desc: '블록 코딩으로 챗봇의 그래픽 처리를 개선한다.' },
  { id: 'network',    name: 'Network',    group: 'network',  pos: [3, -9, 9],     size: 1.5,
    desc: '계정 / 데이터 / VPN / WIFI 를 한 곳에서 다룬다.' },
  { id: 'phone',      name: '전화번호',    group: 'network',  pos: [12, -7, 8],    size: 1.0,
    desc: '가장 많이 쓰는 고유 식별 번호. 계정으로 통용된다.' },
  { id: 'data',       name: '데이터',      group: 'network',  pos: [-2, -15, 12],  size: 0.9,
    desc: '기기에서 만들어서 쓴다.' },
  { id: 'vpn',        name: 'VPN',        group: 'network',  pos: [6, -15, 15],   size: 0.9,
    desc: '데이터에 더하면 국경을 초월한다.' },
  { id: 'wifi',       name: 'WIFI',       group: 'network',  pos: [-5, -9, 15],   size: 0.9,
    desc: '주변 환경 파악에 필수.' },
  { id: 'bigdata',    name: '빅데이터',    group: 'network',  pos: [3, -20, 4],    size: 1.4,
    desc: '네트워크의 모체가 되는 출처.' },
];

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

// 실제 폴더를 Topology 개념 노드에 접목한다. place 는 app/main.js 의 fs:places 키.
// 홈(~) 은 Topology 중심에 붙고, 나머지 홈 폴더는 홈 노드 주변에 펼쳐진다.
// dir 을 주면 그 방향으로 가지를 뻗고, 없으면 Topology 중심에서 바깥쪽으로 뻗는다.
export const FILE_COLORS = { folder: 0x9fd8ff, file: 0xe8f4ff, more: 0x5f7f99 };

export const ANCHORS = [
  { place: 'home',      node: 'topology',   reason: '모든 데이터의 시작점', dir: [-0.9, 0.8, -1] },
  { place: 'desktop',   node: 'topology',   reason: '화면 = Topology', dir: [1, 0.9, -1] },
  { place: 'documents', node: 'instrument', reason: '기록은 Analog 의 언어' },
  { place: 'templates', node: 'circuit',    reason: '설계의 틀' },
  { place: 'downloads', node: 'network',    reason: '네트워크에서 들어온 데이터' },
  { place: 'public',    node: 'network',    reason: '네트워크로 나가는 데이터' },
  { place: 'pictures',  node: 'graphic',    reason: '그래픽' },
  { place: 'videos',    node: 'graphic',    reason: '그래픽' },
  { place: 'music',     node: 'qe',         reason: '자연의 소리' },
];

// 조작: 스크롤 = 전진/후진, Space = 상승, Shift+Space = 하강,
// Shift+스크롤 = 좌우 이동, 드래그 = 시선, Shift 누르는 동안 정밀(느린) 이동.
export const CONTROLS = {
  wheelSpeed: 0.02,
  riseSpeed: 8,
  fineFactor: 0.3,
  damping: 4,
  lookSensitivity: 0.003,
};
