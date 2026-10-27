// QE Analog Topology: Quantum Brain 다이어그램(본 화면)과 깊이로 펼친 데스크톱, 두 뷰를 실제 OS 와 묶는다.
import { api } from './bridge.js';
import { setView, activeName, isTyping } from './core.js';
import * as diagram from './diagram.js';
import * as desktop from './desktop.js';
import { terminalApp, systemApp, networkApp } from './apps.js';
import { initTaskbar } from './taskbar.js';
import { ANCHORS } from './topology.config.js';

const places = await api.places();

const openApp = (app) => {
  setView('desktop');
  desktop.openWindow(app);
};
const showBrain = () => {
  setView('diagram');
  diagram.overview();
};

// 큐비트(개념)에 접목된 실제 폴더는 데스크톱 뷰의 폴더 층으로 연다.
Object.assign(diagram.hooks, {
  folders: (id) => ANCHORS.filter((a) => a.node === id && places[a.place])
    .map((a) => ({ name: places[a.place].split('/').pop(), path: places[a.place] })),
  openFolder: (path) => {
    setView('desktop');
    desktop.openPath(path);
  },
});

diagram.build();
setView('diagram');

initTaskbar({
  builtins: [
    { name: 'Quantum Brain', glyph: '◈', run: showBrain },
    { name: '데스크톱', glyph: '▣', run: () => setView('desktop') },
    { name: '터미널', glyph: '⌨', run: () => openApp(terminalApp(places.home)) },
    { name: '시스템', glyph: '🖥', run: () => openApp(systemApp()) },
    { name: '네트워크', glyph: '📶', run: () => openApp(networkApp()) },
  ],
  onNetwork: () => openApp(networkApp()),
});

// Tab = 다이어그램 ↔ 데스크톱
addEventListener('keydown', (e) => {
  if (e.key !== 'Tab' || isTyping(e.target)) return;
  e.preventDefault();
  setView(activeName() === 'diagram' ? 'desktop' : 'diagram');
});

await desktop.init({
  places,
  specials: [
    { name: 'Quantum Brain', glyph: '◈', open: showBrain },
    { name: '홈', glyph: '🏠', path: places.home },
    { name: '터미널', glyph: '⌨', open: () => openApp(terminalApp(places.home)) },
  ],
});

// 개발 확인용: ?open=<경로> 는 데스크톱에서 그 폴더 층까지 열고, ?view=desktop 은 창 두 개를 띄운다.
const q = new URLSearchParams(location.search);
if (q.has('open')) diagram.hooks.openFolder(q.get('open'));
if (q.get('view') === 'desktop') {
  openApp(systemApp());
  openApp(terminalApp(places.home));
}
