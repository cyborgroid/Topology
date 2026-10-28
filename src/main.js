// QE Analog Topology: 양자 뉴런 블록 조립판(본 화면)과 깊이로 펼친 데스크톱을 실제 OS 와 묶는다.
import { api } from './bridge.js';
import { setView, activeName, isTyping } from './core.js';
import * as diagram from './diagram.js';
import * as desktop from './desktop.js';
import { sanitize } from './blocks.js';
import { terminalApp, systemApp, networkApp, qeSystemApp } from './apps.js';
import { initTaskbar } from './taskbar.js';
import { ANCHORS } from './topology.config.js';

const places = await api.places();
const program = sanitize(await api.loadProgram());

const openApp = (app) => {
  setView('desktop');
  desktop.openWindow(app);
};
const showBlocks = () => setView('diagram');

// --- 블록 환경 값: 이 컴퓨터의 실제 상태 -----------------------------------------------
const env = { identity: '', wifi: 0, vpn: false, data: {} };
const dataPaths = () => [...new Set(program.blocks.filter((b) => b.type === 'data' && b.path).map((b) => b.path))];

async function readData(path) {
  env.data[path] = (await api.listDir(path, { limit: 0 })).total;
}
async function refreshEnv() {
  const [n, s] = await Promise.all([api.netInfo(), api.sysInfo()]);
  env.identity = `${s.user}@${s.hostname}`;
  const wifi = n.wifi.find((w) => w.inUse);
  env.wifi = wifi ? wifi.signal / 100 : 0;
  env.vpn = n.vpn;
  await Promise.all(dataPaths().map(readData));
  diagram.setEnv({ ...env, data: { ...env.data } });
}

let saveTimer = 0;
const PLACE_NAMES = { home: '홈', desktop: '바탕화면', documents: '문서', downloads: '다운로드', pictures: '사진', music: '음악', videos: '비디오', public: '공개', templates: '템플릿' };
let latest = diagram.snapshot();

Object.assign(diagram.hooks, {
  save: (p) => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => api.saveProgram(p), 400);
  },
  dataPlaces: () => Object.entries(PLACE_NAMES).filter(([k]) => places[k]).map(([k, name]) => ({ name, path: places[k] })),
  needData: async (path) => {
    await readData(path);
    diagram.setEnv({ ...env, data: { ...env.data } });
  },
  folders: (concept) => ANCHORS.filter((a) => a.node === concept && places[a.place])
    .map((a) => ({ name: places[a.place].split('/').pop(), path: places[a.place] })),
  openFolder: (path) => {
    setView('desktop');
    desktop.openPath(path);
  },
  openNetwork: () => openApp(networkApp()),
  openTerminal: () => openApp(terminalApp(places.home)),
  openSystem: () => openApp(qeSystemApp(() => latest)),
  changed: (snap) => {
    latest = snap;
    document.getElementById('tray-qe').textContent = snap.system === null ? '' : `◈ QE ${Math.round(snap.system * 100)}%`;
  },
});

// 새 데이터 블록의 기본 폴더 값을 먼저 읽어 둔다.
await readData(places.desktop);
diagram.build(program, { ...env, data: { ...env.data } });
setView('diagram');
refreshEnv();
setInterval(refreshEnv, 15000);

initTaskbar({
  builtins: [
    { name: '양자 뉴런 블록', glyph: '◈', run: showBlocks },
    { name: 'QE 시스템', glyph: '📈', run: () => openApp(qeSystemApp(() => latest)) },
    { name: '터미널', glyph: '⌨', run: () => openApp(terminalApp(places.home)) },
    { name: '시스템', glyph: '🖥', run: () => openApp(systemApp()) },
    { name: '네트워크', glyph: '📶', run: () => openApp(networkApp()) },
  ],
  onNetwork: () => openApp(networkApp()),
});
document.getElementById('tray-qe').addEventListener('click', () => openApp(qeSystemApp(() => latest)));

// Tab = 블록 조립판 ↔ 데스크톱
addEventListener('keydown', (e) => {
  if (e.key !== 'Tab' || isTyping(e.target)) return;
  e.preventDefault();
  setView(activeName() === 'diagram' ? 'desktop' : 'diagram');
});

await desktop.init({
  places,
  specials: [
    { name: '양자 뉴런 블록', glyph: '◈', open: showBlocks },
    { name: 'QE 시스템', glyph: '📈', open: () => openApp(qeSystemApp(() => latest)) },
    { name: '홈', glyph: '🏠', path: places.home },
    { name: '터미널', glyph: '⌨', open: () => openApp(terminalApp(places.home)) },
  ],
});

// 개발 확인용: ?open=<경로> 는 데스크톱에서 그 폴더 층까지 열고, ?view=desktop 은 창 두 개를 띄운다. ?dim=<0~4> 는 프랙탈 차원.
const q = new URLSearchParams(location.search);
if (q.has('dim')) diagram.setDimension(Number(q.get('dim')));
if (q.has('open')) diagram.hooks.openFolder(q.get('open'));
if (q.get('view') === 'desktop') {
  openApp(systemApp());
  openApp(terminalApp(places.home));
}
