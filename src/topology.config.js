// Topology.md 를 Quantum Brain 으로 옮긴 설정.
// Quantum Brain = 생물학적 뇌가 아니라 QE(양자)로 짠 AI 구조, 즉 양자 신경망(QNN)이다.
// 개념 = 큐비트, 신경망의 층(LAYERS) = 시간 순서, Topology.md 의 문장 = 게이트(블록).
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

// 큐비트는 원형 고리로 놓인다(QE 가 맨 위). 모두 |0⟩ 에서 시작한다.
export const QUBITS = ['qe', 'instrument', 'topology', 'ai', 'graphic', 'network', 'phone', 'data', 'vpn', 'wifi', 'bigdata'];

// 신경망 안에서의 역할
export const ROLES = {
  qe: '코어', instrument: '코어', topology: '코어',
  ai: '출력', graphic: '출력', network: '출력',
  phone: '입력', data: '입력', vpn: '입력', wifi: '입력', bigdata: '입력',
};

export const LAYERS = [
  { id: 'input',   name: '① 입력 인코딩',          desc: '네트워크 쪽 개념(데이터·전화번호·WIFI·VPN·빅데이터)을 회전 각도로 양자 상태에 싣는다.' },
  { id: 'core',    name: '② 양자 코어 · QE',       desc: 'QE 가 불확정성(중첩)을 만들고 Instrument 와 Topology 로 퍼뜨린다.' },
  { id: 'hidden1', name: '③ 은닉층 · 얽힘 링',     desc: '모든 큐비트에 학습되는 회전(가중치)을 주고, 고리의 이웃끼리 차례로 얽는다.' },
  { id: 'hidden2', name: '④ 은닉층 · Instrument',  desc: '언어(Instrument)가 AI · Graphic · 전화번호를 제어한다. Topology 는 화면 조작으로 회전한다.' },
  { id: 'merge',   name: '⑤ 네트워크 통합',        desc: '전화번호 / 데이터 / VPN / WIFI / 빅데이터가 Network 로 모인다.' },
  { id: 'output',  name: '⑥ 출력 측정',            desc: 'AI · Graphic · Network 를 측정해 Quantum Brain 의 답(1 이 나올 확률)을 읽는다.' },
];

// 게이트(블록). kind: H(중첩), RX/RY(회전, angle), CX(얽힘: controls 의 각 큐비트가 targets 의 각 큐비트를 제어), M(측정)
const PI = Math.PI;
const INPUTS = [
  ['data', 2.2, '데이터 — 기기에서 만들어서 쓴다. 챗봇 토큰의 재료.'],
  ['phone', 1.1, '전화번호 — 가장 많이 쓰는 고유 식별 번호.'],
  ['wifi', 1.7, 'WIFI — 주변 환경 파악에 필수.'],
  ['vpn', 0.6, 'VPN — 데이터에 넣으면 국경을 초월한다.'],
  ['bigdata', 2.6, '빅데이터 — 네트워크의 모체가 되는 출처.'],
];
// 은닉층의 학습된 가중치(회전 각). 고정값이다.
const WEIGHTS = [0.62, 1.05, 0.48, 0.91, 0.33, 0.77, 1.2, 0.41, 0.86, 0.58, 0.95];
const NAMES = { qe: 'QE', instrument: 'Instrument', topology: 'Topology', ai: 'AI', graphic: 'Graphic', network: 'Network',
  phone: '전화번호', data: '데이터', vpn: 'VPN', wifi: 'WIFI', bigdata: '빅데이터' };

export const GATES = [
  ...INPUTS.map(([q, angle, note]) => ({ layer: 'input', kind: 'RY', angle, targets: [q], note: `입력 x = ${angle} rad · ${note}` })),

  { layer: 'core', kind: 'H',  targets: ['qe'], note: 'QE — 불확정성의 원리로 자연 상태를 중첩으로 연다.' },
  { layer: 'core', kind: 'CX', controls: ['qe'], targets: ['instrument'], note: 'Instrument — 양자화가 필요한 Analog 의 언어. QE 와 얽힌다.' },
  { layer: 'core', kind: 'CX', controls: ['qe'], targets: ['topology'], note: 'Topology — 양자와 아날로그는 뗄 수 없다. 화면이 QE 와 얽힌다.' },

  ...QUBITS.map((q, i) => ({ layer: 'hidden1', kind: 'RY', angle: WEIGHTS[i], targets: [q], note: `학습된 가중치 θ = ${WEIGHTS[i]} rad (${NAMES[q]})` })),
  ...QUBITS.map((q, i) => {
    const next = QUBITS[(i + 1) % QUBITS.length];
    return { layer: 'hidden1', kind: 'CX', controls: [q], targets: [next], note: `얽힘 링 — ${NAMES[q]} → ${NAMES[next]}` };
  }),

  { layer: 'hidden2', kind: 'CX', controls: ['instrument'], targets: ['ai', 'graphic', 'phone'], note: 'Instrument — AI, Graphic, 전화번호와 호환되어 완성된다.' },
  { layer: 'hidden2', kind: 'RX', angle: PI / 2, targets: ['topology'], note: 'Topology — 화면 속이 물속 같은 3D, 스크롤 · 스페이스 · Shift 로 위치를 컨트롤.' },

  { layer: 'merge', kind: 'CX', controls: ['phone', 'data', 'vpn', 'wifi', 'bigdata'], targets: ['network'], note: '네트워크 — 전화번호 / 데이터 / VPN / WIFI 가 한 곳에 모이고, 빅데이터가 그 모체가 된다.' },

  { layer: 'output', kind: 'M', targets: ['ai', 'graphic', 'network'], note: 'AI 는 블록 코딩 기반이고 아날로그 환경이어서 진정한 내 것이다. 답을 측정한다.' },
];

// 실제 폴더를 개념(큐비트)에 접목한다. 정보 패널에서 데스크톱 폴더 층으로 연다. place 는 app/os-api.js 의 places() 키.
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

export const CONTROLS = {
  orbitSensitivity: 0.005,
  fineFactor: 0.4,
};
