// Quantum Neuron Block Computing 의 블록 정의와 평가.
// 블록 = 기능을 맡은 단자(모듈). 단자를 호환되는 것끼리 이어 조립하면 체계화된 시스템이 된다.
// 처리 블록 안에는 양자 뉴런이 하나씩 있다. 사용자는 게이트를 직접 짜지 않고 블록을 조립만 한다.
// 환경 블록(데이터, 전화번호·계정, WIFI, VPN)은 이 컴퓨터의 실제 값을 신호로 쓴다.
// 시스템은 하나의 차원 결정체다: 층마다 차원이 하나씩 늘어나며(점 → 선 → 면 → 공간) 신호가 꼭짓점의 Topology 에 모인다.
import { QuantumState } from './quantum.js';

// 단자(신호) 종류. single = 한 곳에만 이을 수 있다(양자 신호는 복제 불가).
export const SIGNALS = {
  data:    { label: '데이터', color: 0x2fd6a0 },
  id:      { label: '식별',   color: 0xe88a4e },
  link:    { label: '연결',   color: 0x5ff2ff },
  quantum: { label: '양자',   color: 0xb48cff, single: true },
  command: { label: '명령',   color: 0xe0b341 },
  token:   { label: '토큰',   color: 0xd55fbf },
  screen:  { label: '화면',   color: 0x2fb6d9 },
};

// 결정의 층 = 차원. 블록의 group 이 어느 층인지 정한다.
export const LAYERS = {
  '0차원 · 환경':        '점 — 실제 값이 솟는 원천',
  '1차원 · 네트워크':    '선 — 점과 점을 잇는 연결',
  '2차원 · 양자 · 처리': '면 — 중첩과 연산이 펼쳐지는 면',
  '3차원 · 화면':        '공간 — Topology 3D 화면으로 솟는다',
};

const port = (id, type, optional = false) => ({ id, type, label: SIGNALS[type].label, optional });

// Topology.md 의 개념을 기능 모듈로. 단자 구성은 [환경] [대상] [결과] 의 관계를 따른다.
export const BLOCK_TYPES = {
  data:       { label: '데이터',          group: '0차원 · 환경', color: 0x2fd6a0, concept: 'data',
                ins: [], outs: [port('data', 'data')],
                help: '데이터는 기기에서 만들어서 쓴다. 고른 실제 폴더의 항목 수가 신호 세기가 된다.' },
  phone:      { label: '전화번호 · 계정', group: '0차원 · 환경', color: 0xe88a4e, concept: 'phone',
                ins: [], outs: [port('id', 'id')],
                help: '가장 많이 쓰는 고유 식별 번호. 이 컴퓨터의 계정이 식별 신호가 된다.' },
  wifi:       { label: 'WIFI',            group: '0차원 · 환경', color: 0x5ff2ff, concept: 'wifi',
                ins: [], outs: [port('link', 'link')],
                help: '주변 환경 파악에 필수. 지금 연결된 Wi-Fi 의 신호 세기가 연결 신호가 된다.' },
  vpn:        { label: 'VPN',             group: '1차원 · 네트워크', color: 0x7fd0ff, concept: 'vpn', neuron: true,
                ins: [port('link', 'link'), port('data', 'data', true)], outs: [port('link', 'link')],
                help: '데이터에 VPN 을 넣으면 국경을 초월한다. 이 컴퓨터에 VPN 이 켜져 있으면 뉴런이 한 번 더 자극된다.' },
  network:    { label: 'Network',         group: '1차원 · 네트워크', color: 0xe8a04e, concept: 'network', neuron: true,
                ins: [port('link', 'link'), port('id', 'id', true), port('data', 'data', true)], outs: [port('link', 'link')],
                help: '전화번호 / 데이터 / VPN / WIFI 가 한 곳에 모여서 아주 잘 돌아간다.' },
  bigdata:    { label: '빅데이터',        group: '1차원 · 네트워크', color: 0xc8794a, concept: 'bigdata', neuron: true,
                ins: [port('link', 'link')], outs: [port('data', 'data')],
                help: '네트워크를 할 때 모체가 되는 출처. 연결을 데이터로 바꾼다.' },
  qe:         { label: 'QE 코어',         group: '2차원 · 양자 · 처리', color: 0xb48cff, concept: 'qe', neuron: true, superpose: true,
                ins: [port('data', 'data')], outs: [port('q', 'quantum')],
                help: '불확정성의 원리. 데이터를 양자 뉴런의 중첩 상태로 연다.' },
  instrument: { label: 'Instrument',      group: '2차원 · 양자 · 처리', color: 0xe0b341, concept: 'instrument', neuron: true,
                ins: [port('q', 'quantum'), port('id', 'id', true)], outs: [port('cmd', 'command')],
                help: 'Analog 가 소통하는 언어. 양자 상태를 명령으로 바꾼다. 전화번호와 호환된다.' },
  ai:         { label: 'AI',              group: '2차원 · 양자 · 처리', color: 0xd55fbf, concept: 'ai', neuron: true,
                ins: [port('cmd', 'command'), port('data', 'data', true)], outs: [port('token', 'token')],
                help: '데이터에서 챗봇 토큰이 만들어진다. 블록 코딩 기반이고 아날로그 환경이라 진정한 내 것이다.' },
  graphic:    { label: 'Graphic',         group: '3차원 · 화면', color: 0xf27fd0, concept: 'graphic', neuron: true,
                ins: [port('token', 'token')], outs: [port('screen', 'screen')],
                help: '토큰을 그래픽으로. 블록 코딩으로 그래픽 처리를 개선한다.' },
  topology:   { label: 'Topology',        group: '3차원 · 화면', color: 0x2fb6d9, concept: 'topology', neuron: true, sink: true,
                ins: [port('screen', 'screen'), port('cmd', 'command', true)], outs: [],
                help: 'Analog 화면 사양. 조립한 시스템의 결과가 Topology 화면(데스크톱)으로 나간다.' },
};

let seq = 0;
const newId = (prefix) => `${prefix}${Date.now().toString(36)}${(seq++).toString(36)}`;

export function createBlock(type, program, x, z, defaults = {}) {
  const def = BLOCK_TYPES[type];
  const same = program.blocks.filter((b) => b.type === type).length;
  const block = { id: newId('b'), type, name: same ? `${def.label} ${same + 1}` : def.label, x, y: 0, z };
  if (type === 'data') block.path = defaults.path ?? null;
  return block;
}

export const portKey = (block, p) => `${block}:${p}`;

export function findPort(program, blockId, portId, side) {
  const b = program.blocks.find((x) => x.id === blockId);
  return b && BLOCK_TYPES[b.type][side].find((p) => p.id === portId);
}

// from(출력 단자) → to(입력 단자) 가 호환되는지: 다른 블록, 같은 신호 종류
export function canConnect(program, from, to) {
  if (from.block === to.block) return false;
  const a = findPort(program, from.block, from.port, 'outs');
  const b = findPort(program, to.block, to.port, 'ins');
  return !!a && !!b && a.type === b.type;
}

// 잇는다. 입력 단자에는 하나만 들어오고, 양자 출력은 한 곳으로만 나간다.
export function connect(program, from, to) {
  if (!canConnect(program, from, to)) return false;
  const type = findPort(program, from.block, from.port, 'outs').type;
  program.wires = program.wires.filter((w) =>
    !(w.to.block === to.block && w.to.port === to.port)
    && !(SIGNALS[type].single && w.from.block === from.block && w.from.port === from.port));
  program.wires.push({ id: newId('w'), from, to });
  return true;
}

export function removeBlock(program, id) {
  program.blocks = program.blocks.filter((b) => b.id !== id);
  program.wires = program.wires.filter((w) => w.from.block !== id && w.to.block !== id);
}

// 양자 뉴런: 입력 세기 x 마다 큐비트 하나에 Ry(πx) 로 싣고, 각 입력이 출력 큐비트를 제어 회전(CRy)한다.
// 입력이 모두 1 이면 출력이 1 이 되고, 모두 0 이면 0 이다(중첩 뉴런은 0.5 에서 시작).
export function quantumNeuron(xs, superpose = false) {
  const n = xs.length;
  const s = new QuantumState(n + 1);
  const out = n;
  if (superpose) s.h(out);
  const step = (superpose ? Math.PI / 2 : Math.PI) / Math.max(n, 1);
  xs.forEach((x, i) => {
    s.ry(i, Math.PI * x);
    s.cry(i, out, step);
  });
  const bloch = s.bloch(out);
  return { value: (1 - bloch[2]) / 2, bloch };
}

// 환경 블록의 실제 값 (main.js 가 채운다)
//   env = { identity: 'user@host' | '', wifi: 0~1, vpn: boolean, data: { [path]: 항목 수 } }
function sourceValue(b, env) {
  if (b.type === 'data') {
    const count = env.data?.[b.path];
    return count === undefined ? null : Math.min(1, Math.log10(count + 1) / 3);   // 1000 개면 1
  }
  if (b.type === 'phone') return env.identity ? 1 : 0;
  if (b.type === 'wifi') return env.wifi ?? 0;
  return null;
}

// 결과: state.get(id) = { status: 'ok' | 'idle' | 'error', msg, value, bloch, inputs: [{ label, value }] }
//       live = 신호가 흐르는 연결, system = Topology 블록에 도달한 결과(없으면 null)
export function evaluate(program, env = {}) {
  const blocks = new Map(program.blocks.map((b) => [b.id, b]));
  const wires = program.wires.filter((w) => blocks.has(w.from.block) && blocks.has(w.to.block));
  const into = new Map(wires.map((w) => [portKey(w.to.block, w.to.port), w]));

  // 신호가 흐르는 순서(위상 정렬). 같은 때 준비된 블록은 왼쪽부터.
  const indeg = new Map([...blocks.keys()].map((id) => [id, 0]));
  const next = new Map([...blocks.keys()].map((id) => [id, []]));
  for (const w of wires) {
    indeg.set(w.to.block, indeg.get(w.to.block) + 1);
    next.get(w.from.block).push(w.to.block);
  }
  const ready = [...blocks.keys()].filter((id) => indeg.get(id) === 0);
  const order = [];
  while (ready.length) {
    ready.sort((a, b) => blocks.get(a).x - blocks.get(b).x);
    const id = ready.shift();
    order.push(id);
    for (const n of next.get(id)) {
      indeg.set(n, indeg.get(n) - 1);
      if (indeg.get(n) === 0) ready.push(n);
    }
  }

  const state = new Map();
  for (const id of blocks.keys()) {
    if (!order.includes(id)) state.set(id, { status: 'error', msg: '연결이 고리를 이룬다 — 신호가 자기에게 돌아온다' });
  }

  const outs = new Map();   // portKey -> 신호 세기
  const live = new Set();
  let system = null;
  for (const id of order) {
    if (state.has(id)) continue;
    const b = blocks.get(id);
    const def = BLOCK_TYPES[b.type];

    const inputs = [];
    let missing = null;
    for (const p of def.ins) {
      const w = into.get(portKey(id, p.id));
      const v = w ? outs.get(portKey(w.from.block, w.from.port)) : undefined;
      if (v === undefined) {
        if (!p.optional) { missing = p; break; }
        continue;
      }
      live.add(w.id);
      inputs.push({ label: p.label, value: v });
    }
    if (missing) {
      state.set(id, { status: 'idle', msg: `${missing.label} 단자가 비어 있다`, inputs });
      continue;
    }

    let value, bloch = null, msg = '';
    if (def.neuron) {
      const xs = inputs.map((i) => i.value);
      if (b.type === 'vpn' && env.vpn) xs.push(1);
      ({ value, bloch } = quantumNeuron(xs, def.superpose));
      if (b.type === 'vpn') msg = env.vpn ? '이 컴퓨터의 VPN 이 켜져 있다' : '이 컴퓨터의 VPN 이 꺼져 있다';
    } else {
      value = sourceValue(b, env);
      if (value === null) {
        state.set(id, { status: 'idle', msg: b.type === 'data' ? '폴더를 고르세요' : '환경 값을 읽는 중', inputs });
        continue;
      }
      if (b.type === 'phone') msg = env.identity ? `계정 ${env.identity}` : '계정 정보 없음';
      if (b.type === 'wifi') msg = env.wifi ? `Wi-Fi 신호 ${Math.round(env.wifi * 100)}%` : 'Wi-Fi 연결 없음';
      if (b.type === 'data') msg = `${b.path} · ${env.data[b.path]}개 항목`;
    }
    for (const p of def.outs) outs.set(portKey(id, p.id), value);
    if (def.sink) system = Math.max(system ?? 0, value);
    state.set(id, { status: 'ok', msg, value, bloch, inputs });
  }
  return { state, live, system };
}

export function emptyProgram() {
  return { blocks: [], wires: [] };
}

// No Base = Topology 자체의 초기 시스템 구조. Topology.md [결과] 의 관계대로 블록을 놓고 잇는 육방정계 결정체.
//   신호는 아래에서 위로, 차원을 하나씩 더하며 흐른다. 층마다 정삼각형이고, 이웃한 층은 60° 엇갈려 위에서 보면 정육각형이 된다.
//   0차원(데이터·WIFI·전화번호) → 1차원(VPN·Network·빅데이터) → 2차원(QE 코어·Instrument·AI, 좁아짐) → 3차원 축(Graphic → 꼭짓점 Topology)
const R = 7, H = 4.6;
const ring = (r, deg, y) => [r * Math.cos(deg * Math.PI / 180), y, -r * Math.sin(deg * Math.PI / 180)];
const BASE_LAYOUT = [
  ['data', ...ring(R, 90, 0)], ['wifi', ...ring(R, 210, 0)], ['phone', ...ring(R, 330, 0)],
  ['vpn', ...ring(R, 150, H)], ['network', ...ring(R, 270, H)], ['bigdata', ...ring(R, 30, H)],
  ['qe', ...ring(R * 0.55, 90, 2 * H)], ['ai', ...ring(R * 0.55, 210, 2 * H)], ['instrument', ...ring(R * 0.55, 330, 2 * H)],
  ['graphic', 0, 3 * H, 0], ['topology', 0, 4.2 * H, 0],
];
const BASE_WIRES = [
  ['wifi', 'link', 'vpn', 'link'], ['data', 'data', 'vpn', 'data'],
  ['vpn', 'link', 'network', 'link'], ['phone', 'id', 'network', 'id'], ['data', 'data', 'network', 'data'],
  ['network', 'link', 'bigdata', 'link'], ['bigdata', 'data', 'qe', 'data'],
  ['qe', 'q', 'instrument', 'q'], ['phone', 'id', 'instrument', 'id'],
  ['instrument', 'cmd', 'ai', 'cmd'], ['bigdata', 'data', 'ai', 'data'],
  ['ai', 'token', 'graphic', 'token'], ['graphic', 'screen', 'topology', 'screen'], ['instrument', 'cmd', 'topology', 'cmd'],
];

export function baseProgram(defaults = {}) {
  const program = { ...emptyProgram(), nobase: true };
  const ids = {};
  for (const [type, x, y, z] of BASE_LAYOUT) {
    const b = createBlock(type, program, Math.round(x * 100) / 100, Math.round(z * 100) / 100, defaults);
    b.y = y;
    ids[type] = b.id;
    program.blocks.push(b);
  }
  for (const [a, ap, b, bp] of BASE_WIRES) connect(program, { block: ids[a], port: ap }, { block: ids[b], port: bp });
  return program;
}

// 저장된 프로그램을 읽을 때: 모르는 블록과 끊어진 연결은 버린다.
export function sanitize(p) {
  if (!p || !Array.isArray(p.blocks) || !Array.isArray(p.wires)) return emptyProgram();
  const blocks = p.blocks.filter((b) => b && BLOCK_TYPES[b.type] && typeof b.id === 'string')
    .map((b) => ({ ...b, x: Number(b.x) || 0, y: Number(b.y) || 0, z: Number(b.z) || 0 }));
  const ids = new Set(blocks.map((b) => b.id));
  const wires = p.wires.filter((w) => w && ids.has(w.from?.block) && ids.has(w.to?.block)
    && findPort({ blocks }, w.from.block, w.from.port, 'outs') && findPort({ blocks }, w.to.block, w.to.port, 'ins'));
  return { blocks, wires, ...(p.nobase ? { nobase: true } : {}) };
}
