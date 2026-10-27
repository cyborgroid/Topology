// QE Analog Topology: 개념 노드 + 실제 파일 시스템 + 3D 데스크톱을 하나의 공간으로 묶는다.
import * as THREE from 'three';
import { addNode, addLink, onNode, onTick, flyHome, camera } from './scene.js';
import { openWindow, placeDesktopIcons, initStartMenu } from './desktop.js';
import { filesApp, terminalApp, systemApp, networkApp, nodeApp } from './apps.js';
import { plantFileSystem, toggle } from './filegraph.js';
import { GROUPS, NODES, LINKS } from './topology.config.js';

const api = window.topology;

for (const n of NODES) {
  addNode({ id: n.id, name: n.name, kind: 'concept', color: GROUPS[n.group].color, size: n.size, pos: new THREE.Vector3(...n.pos) });
}
for (const [a, b] of LINKS) addLink(a, b);

const places = await api.places();

const BUILTINS = [
  { name: '파일', glyph: '📁', run: () => openWindow(filesApp(places.home)) },
  { name: '터미널', glyph: '⌨', run: () => openWindow(terminalApp(places.home)) },
  { name: '시스템', glyph: '🖥', run: () => openWindow(systemApp()) },
  { name: '네트워크', glyph: '📶', run: () => openWindow(networkApp()) },
  { name: 'Topology 홈', glyph: '◎', run: flyHome },
];
initStartMenu({ builtins: BUILTINS, loadApps: api.apps, launch: api.launch, quit: api.quit });
document.getElementById('home-btn').addEventListener('click', flyHome);

// 노드: 클릭 = 개념 정보 / 폴더 펼치기·접기, 더블클릭 = 폴더는 파일 창, 파일은 기본 앱으로 열기.
onNode('click', (node) => {
  if (node.kind === 'concept') openWindow(nodeApp(node));
  else if (node.kind === 'folder') toggle(node.data.path);
});
onNode('dblclick', (node) => {
  if (node.kind === 'concept') return;
  if (node.data.dir) openWindow(filesApp(node.data.path));
  else api.open(node.data.path);
});

// 바탕화면 아이콘 = 실제 바탕화면 폴더의 내용.
const desk = await api.listDir(places.desktop);
placeDesktopIcons([
  { name: '홈', glyph: '🏠', open: () => openWindow(filesApp(places.home)) },
  { name: '터미널', glyph: '⌨', open: () => openWindow(terminalApp(places.home)) },
  ...desk.entries.map((e) => ({
    name: e.name,
    glyph: e.dir ? '📁' : '📄',
    open: () => (e.dir ? openWindow(filesApp(e.path)) : api.open(e.path)),
  })),
]);

await plantFileSystem(places);

// --- tray ----------------------------------------------------------------
const $ = (id) => document.getElementById(id);
onTick(() => {
  const p = camera.position;
  $('tray-pos').textContent = `${p.x.toFixed(0)}, ${p.y.toFixed(0)}, ${p.z.toFixed(0)}`;
});
function clock() {
  $('tray-clock').textContent = new Date().toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
async function status() {
  const [n, s] = await Promise.all([api.netInfo(), api.sysInfo()]);
  const wifi = n.wifi.find((w) => w.inUse);
  $('tray-net').textContent = wifi ? `📶 ${wifi.ssid}` : n.active[0] ? `🔌 ${n.active[0].name}` : '⚠ 오프라인';
  $('tray-bat').textContent = s.battery ? `🔋 ${s.battery.capacity}%` : '';
}
$('tray-net').addEventListener('click', () => openWindow(networkApp()));
clock();
status();
setInterval(clock, 1000);
setInterval(status, 15000);

if (new URLSearchParams(location.search).has('demo')) {
  openWindow(filesApp(places.desktop));
  openWindow(systemApp());
}
