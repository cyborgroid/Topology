// QE Analog Topology: 블록 다이어그램(본 화면)과 3D 데스크톱, 두 뷰를 실제 OS 와 묶는다.
import { api } from './bridge.js';
import { setView, activeName, isTyping } from './core.js';
import * as diagram from './diagram.js';
import * as desktop from './desktop.js';
import { buildTower } from './tower.js';
import { plantFileSystem, onEnter, frameFor, describe, reveal } from './filegraph.js';
import { terminalApp, systemApp, networkApp } from './apps.js';
import { initTaskbar } from './taskbar.js';

const places = await api.places();

const openApp = (app) => {
  setView('desktop');
  desktop.openWindow(app);
};
const showFolder = (path) => {
  setView('diagram');
  reveal(path);
};
const showRoot = () => {
  setView('diagram');
  diagram.enter(diagram.ROOT);
};

Object.assign(diagram.hooks, {
  enter: onEnter,
  frame: frameFor,
  describe,
  open: (u) => api.open(u.data.path),
  terminal: (path) => openApp(terminalApp(path)),
});

buildTower();
diagram.start();
setView('diagram');

initTaskbar({
  builtins: [
    { name: '다이어그램', glyph: '◈', run: showRoot },
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

const desk = await api.listDir(places.desktop);
desktop.setDesktopIcons([
  { name: 'Topology', glyph: '◈', open: showRoot },
  { name: '홈', glyph: '🏠', open: () => showFolder(places.home) },
  { name: '터미널', glyph: '⌨', open: () => openApp(terminalApp(places.home)) },
  ...desk.entries.map((e) => ({
    name: e.name,
    glyph: e.dir ? '📁' : '📄',
    open: () => (e.dir ? showFolder(e.path) : api.open(e.path)),
  })),
]);

await plantFileSystem(places);

// 개발 확인용: ?reveal=<경로> 는 그 폴더로 들어가고, ?view=desktop 은 창 두 개를 띄운 데스크톱으로 시작한다.
const q = new URLSearchParams(location.search);
if (q.has('reveal')) showFolder(q.get('reveal'));
if (q.get('view') === 'desktop') {
  openApp(systemApp());
  openApp(terminalApp(places.home));
}
