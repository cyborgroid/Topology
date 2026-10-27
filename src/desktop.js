// 데스크톱 뷰: 평소 쓰던 2D Digital OS 데스크톱을 깊이 방향으로 펼친 것. 스크롤로 깊이를 오간다.
//   앞(카메라 쪽) : 열린 창들이 한 층씩
//   가운데(z=0)   : 바탕화면
//   뒤            : 폴더 층. 폴더를 누르면 그 내용이 바로 뒤에 새 층으로 생긴다.
// 스크롤을 멈추면 가장 가까운 층에 맞춰져 그 층이 픽셀 그대로(평소 2D 화면처럼) 보인다.
// 한 층의 내용이 한 화면을 넘으면 페이지가 바둑판처럼 상하좌우로 펼쳐지고, 마우스로 끌어 옮겨 다닌다.
import * as THREE from 'three';
import { CSS3DRenderer, CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';
import { api } from './bridge.js';
import { registerView, isActive, isUi, isTyping, setView } from './core.js';

const SCALE = 0.02;   // CSS 1px = 0.02 월드 단위
const GAP = 9;        // 층 사이 거리
const TASKBAR = 46;
const ICON = 100;     // 아이콘 칸 크기(px)
const HEAD = 44;      // 폴더 층 머리줄 높이(px)
const MAX_PAGES = 16; // 한 층에 펼치는 페이지 수 상한
const BG = 0x05192b;

export const scene = new THREE.Scene();
scene.background = new THREE.Color(BG);
scene.fog = new THREE.FogExp2(BG, 0.006);

// 층 사이를 지날 때 깊이감을 주는 입자
const PARTICLES = 2000;
const pPos = new Float32Array(PARTICLES * 3);
for (let i = 0; i < PARTICLES; i++) {
  pPos[i * 3] = (Math.random() - 0.5) * 80;
  pPos[i * 3 + 1] = (Math.random() - 0.5) * 50;
  pPos[i * 3 + 2] = Math.random() * 400 - 250;
}
const pGeo = new THREE.BufferGeometry();
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
scene.add(new THREE.Points(pGeo, new THREE.PointsMaterial({ color: 0x9fdcff, size: 0.08, transparent: true, opacity: 0.5 })));

export const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 600);

const css3d = new CSS3DRenderer();
css3d.domElement.className = 'layer css3d';
document.getElementById('stage').appendChild(css3d.domElement);
css3d.setSize(innerWidth, innerHeight);

const gaugeEl = document.getElementById('depth-gauge');
const hintEl = document.getElementById('desktop-hint');
const taskList = document.getElementById('task-list');

// 이 거리에서 보면 층 위의 CSS 1px 이 화면 1px 이 된다.
const pixelDist = () => (SCALE * innerHeight) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
let camZ = pixelDist(), goalZ = camZ, lastWheel = 0, snapPending = false;
let camX = 0, camY = 0, goalX = 0, goalY = 0;

// 페이지 사이 간격(월드 단위). 한 페이지 = 화면 하나 크기.
const pageW = () => innerWidth * SCALE + 1.6;
const pageH = () => (innerHeight - TASKBAR) * SCALE + 1.6;

function flyToZ(z, page = [0, 0]) {
  goalZ = z + pixelDist();
  goalX = page[0] * pageW();
  goalY = -page[1] * pageH();
  snapPending = false;
}

// --- 폴더 층 (0 = 바탕화면) ------------------------------------------------------
const stack = [];
let places = null;
let specials = [];   // 바탕화면에만 놓이는 아이콘 { name, glyph, path? , open? }

function panelSize() {
  return { w: innerWidth, h: innerHeight - TASKBAR };
}
function perPage() {
  const { w, h } = panelSize();
  return Math.max(1, Math.floor((w - 32) / ICON)) * Math.max(1, Math.floor((h - HEAD - 24) / ICON));
}

function iconEl({ name, glyph, selected }) {
  const el = document.createElement('div');
  el.className = `icon${selected ? ' selected' : ''}`;
  el.innerHTML = '<div class="icon-glyph"></div><div class="icon-name"></div>';
  el.querySelector('.icon-glyph').textContent = glyph;
  el.querySelector('.icon-name').textContent = name;
  el.title = name;
  return el;
}

function createLayer(index, path, name) {
  return { kind: 'folder', index, path, name, z: -index * GAP, selected: null, pages: [], cols: 1, page: [0, 0] };
}

function pagePanel(layer, i, count, total) {
  const el = document.createElement('div');
  el.className = `panel3d ${layer.index === 0 ? 'desktop-wall' : 'folder-layer'}`;
  el.innerHTML = `
    <div class="layer-head">
      <span class="layer-name"></span><span class="layer-count"></span><span class="page-no"></span>
    </div>
    <div class="layer-icons"></div>`;
  el.querySelector('.layer-name').textContent = layer.name;
  el.querySelector('.layer-count').textContent = total;
  el.querySelector('.page-no').textContent = count > 1 ? `페이지 ${i + 1} / ${count}  ·  드래그로 넘기기` : '';
  const { w, h } = panelSize();
  el.style.width = `${w}px`;
  el.style.height = `${h}px`;
  const obj = new CSS3DObject(el);
  obj.scale.setScalar(SCALE);
  const col = i % layer.cols, row = Math.floor(i / layer.cols);
  obj.position.set(col * pageW(), (TASKBAR / 2) * SCALE - row * pageH(), layer.z);
  scene.add(obj);
  return { el, obj, col, row };
}

async function renderLayer(layer) {
  const per = perPage();
  const sp = layer.index === 0 ? specials : [];
  const r = await api.listDir(layer.path, { limit: per * MAX_PAGES - sp.length });
  const items = [
    ...sp.map((s) => ({ ...s, dir: !!s.path })),
    ...r.entries.map((e) => ({ name: e.name, path: e.path, dir: e.dir, glyph: e.dir ? '📁' : '📄' })),
  ];
  const count = Math.max(1, Math.ceil(items.length / per));
  layer.cols = Math.ceil(Math.sqrt(count));
  layer.pages.forEach((p) => scene.remove(p.obj));
  const total = r.error ? r.error : `${r.total}개${r.total > r.entries.length ? ` (앞 ${r.entries.length}개)` : ''}`;
  layer.pages = Array.from({ length: count }, (_, i) => pagePanel(layer, i, count, total));

  layer.pages.forEach((page, i) => {
    page.el.querySelector('.layer-icons').replaceChildren(...items.slice(i * per, (i + 1) * per).map((item) => {
      const el = iconEl({ ...item, selected: item.path && item.path === layer.selected });
      // 폴더: 클릭 = 뒤에 다음 층 만들기, 더블클릭 = 그 층으로 들어가기. 파일: 더블클릭 = 기본 앱으로 열기.
      el.addEventListener('click', () => {
        if (item.dir && item.path !== layer.selected) openBehind(layer, item.path, item.name);
      });
      el.addEventListener('dblclick', async () => {
        if (item.open) return item.open();
        if (!item.dir) return api.open(item.path);
        const next = item.path === layer.selected ? stack[layer.index + 1] : await openBehind(layer, item.path, item.name);
        if (next) flyToZ(next.z);
      });
      return el;
    }));
  });
}

function truncate(length) {
  while (stack.length > length) stack.pop().pages.forEach((p) => scene.remove(p.obj));
}

// layer 에서 고른 폴더를 바로 뒤 층으로 연다. 그보다 깊던 층은 새로 고른 폴더 기준으로 다시 만든다.
async function openBehind(layer, path, name) {
  layer.selected = path;
  layer.pages.forEach((p) => p.el.querySelectorAll('.icon').forEach((el) => el.classList.toggle('selected', el.title === name)));
  truncate(layer.index + 1);
  const next = createLayer(layer.index + 1, path, `📁 ${name}`);
  stack.push(next);
  await renderLayer(next);
  renderGauge();
  return next;
}

// 실제 경로까지 폴더 층을 차례로 열고 그 층으로 간다. (다이어그램의 "접목된 폴더" 에서 호출)
export async function openPath(path) {
  let layer = stack[0];
  if (path !== places.desktop) {
    const parts = path.startsWith(`${places.home}/`) ? path.slice(places.home.length + 1).split('/') : null;
    if (!parts) return;
    layer = await openBehind(stack[0], places.home, '홈');
    let cur = places.home;
    for (const part of parts) {
      cur = `${cur}/${part}`;
      layer = await openBehind(layer, cur, part);
    }
  }
  flyToZ(layer.z);
}

export async function init(opts) {
  places = opts.places;
  specials = opts.specials;
  stack.push(createLayer(0, places.desktop, '🖥 바탕화면'));
  await renderLayer(stack[0]);
  renderGauge();
}

// --- 창 층 --------------------------------------------------------------------
const windows = [];
let focused = null;
let shownLayer = null;

const visibleWindows = () => windows.filter((w) => !w.minimized);
// 앞(카메라 쪽)에서 뒤 순서
const layers = () => [...visibleWindows(), ...stack].sort((a, b) => b.z - a.z);
const nearestLayer = (z) => layers().reduce((best, l) => (Math.abs(l.z - z) < Math.abs(best.z - z) ? l : best));

function compact() {
  [...windows].sort((a, b) => a.z - b.z).forEach((w, i) => { w.z = (i + 1) * GAP; });
}

function focus(win) {
  if (focused) { focused.el.classList.remove('focused'); focused.tab.classList.remove('active'); }
  focused = win;
  if (win) { win.el.classList.add('focused'); win.tab.classList.add('active'); }
}

// 지금 카메라가 보는 페이지(층 안에서)
function pageIndex(layer) {
  if (layer.kind !== 'folder' || !layer.pages.length) return 0;
  const col = THREE.MathUtils.clamp(Math.round(camX / pageW()), 0, layer.cols - 1);
  const row = THREE.MathUtils.clamp(Math.round(-camY / pageH()), 0, Math.ceil(layer.pages.length / layer.cols) - 1);
  return Math.min(row * layer.cols + col, layer.pages.length - 1);
}

function snapPage(layer, x = goalX, y = goalY) {
  if (layer.kind !== 'folder' || !layer.pages.length) return [0, 0];
  const rows = Math.ceil(layer.pages.length / layer.cols);
  let col = THREE.MathUtils.clamp(Math.round(x / pageW()), 0, layer.cols - 1);
  let row = THREE.MathUtils.clamp(Math.round(-y / pageH()), 0, rows - 1);
  while (row * layer.cols + col >= layer.pages.length) col--;   // 마지막 줄의 빈칸
  return [col, row];
}

let lastGaugeKey = '';
function renderGauge() {
  shownLayer = nearestLayer(camZ - pixelDist());
  gaugeEl.replaceChildren(
    Object.assign(document.createElement('div'), { className: 'gauge-title', textContent: '깊이 ↕ 스크롤' }),
    ...layers().map((l) => {
      const b = document.createElement('button');
      const pages = l.kind === 'folder' && l.pages.length > 1 ? `  ${pageIndex(l) + 1}/${l.pages.length}` : '';
      b.textContent = l.kind === 'window' ? `${l.icon} ${l.title}` : l.name + (l === shownLayer ? pages : '');
      b.className = `${l.kind}${l === shownLayer ? ' current' : ''}`;
      b.addEventListener('click', () => flyToZ(l.z));
      return b;
    }),
  );
}

// 새 창은 맨 앞에 새 층을 만들고, 카메라가 그 층으로 물러나 정면에서 보여 준다.
export function openWindow({ title, icon = '▢', width = 640, height = 420, build }) {
  const el = document.createElement('div');
  el.className = 'win';
  el.style.width = `${width}px`;
  el.style.height = `${height}px`;
  el.innerHTML = `
    <div class="win-bar" title="드래그 = 이동 · 스크롤 = 이 창의 깊이 바꾸기">
      <span class="win-icon"></span><span class="win-title"></span>
      <div class="win-btns">
        <button data-act="min" title="최소화">–</button>
        <button data-act="close" title="닫기">×</button>
      </div>
    </div>
    <div class="win-body"></div>`;
  el.querySelector('.win-icon').textContent = icon;

  const z = Math.max(0, ...windows.map((w) => w.z)) + GAP;
  const n = windows.length % 5;
  const obj = new CSS3DObject(el);
  obj.scale.setScalar(SCALE);
  obj.position.set((n - 2) * 36 * SCALE, (TASKBAR / 2 + 30 - n * 24) * SCALE, z);
  scene.add(obj);

  const tab = document.createElement('button');
  tab.className = 'task';
  taskList.append(tab);

  const win = {
    kind: 'window', el, obj, tab, icon, title, z, minimized: false, cleanup: [],
    setTitle(text) {
      win.title = text;
      el.querySelector('.win-title').textContent = text;
      tab.textContent = `${icon} ${text}`;
      tab.title = text;
      renderGauge();
    },
    close() {
      win.cleanup.forEach((fn) => fn());
      scene.remove(obj);
      tab.remove();
      windows.splice(windows.indexOf(win), 1);
      if (focused === win) focus(null);
      compact();
      flyToZ(nearestLayer(camZ - pixelDist()).z);
      renderGauge();
    },
    minimize() {
      win.minimized = true;
      obj.visible = false;
      tab.classList.add('minimized');
      if (focused === win) focus(null);
      flyToZ(nearestLayer(win.z).z);
      renderGauge();
    },
    restore() {
      win.minimized = false;
      obj.visible = true;
      tab.classList.remove('minimized');
      focus(win);
      flyToZ(win.z);
      renderGauge();
    },
  };
  windows.push(win);

  el.addEventListener('pointerdown', () => {
    focus(win);
    if (shownLayer !== win) flyToZ(win.z);   // 뒤쪽 층의 창을 누르면 그 층으로 간다.
  });
  el.querySelector('.win-btns').addEventListener('click', (e) => {
    if (e.target.dataset.act === 'close') win.close();
    if (e.target.dataset.act === 'min') win.minimize();
  });
  tab.addEventListener('click', () => {
    setView('desktop');
    if (focused === win && !win.minimized && shownLayer === win) win.minimize();
    else win.restore();
  });

  // 제목 표시줄: 드래그 = 층 안에서 이동, 스크롤 = 이 창을 앞뒤 다른 깊이로 옮기기(카메라도 따라감)
  const bar = el.querySelector('.win-bar');
  let moving = false;
  bar.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    moving = true;
    bar.setPointerCapture(e.pointerId);
  });
  bar.addEventListener('pointermove', (e) => {
    if (!moving) return;
    const k = (2 * (camZ - obj.position.z) * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) / innerHeight;
    obj.position.x += e.movementX * k;
    obj.position.y -= e.movementY * k;
  });
  bar.addEventListener('pointerup', () => { moving = false; });
  bar.addEventListener('wheel', (e) => {
    e.preventDefault();
    win.z = Math.max(1, win.z - (e.deltaY || e.deltaX) * 0.02);
    flyToZ(win.z);
    renderGauge();
  }, { passive: false });

  win.setTitle(title);
  focus(win);
  flyToZ(z);
  build(el.querySelector('.win-body'), win);
  return win;
}

// --- 입력 ----------------------------------------------------------------------
addEventListener('wheel', (e) => {
  if (!isActive(view) || isUi(e.target)) return;
  e.preventDefault();
  const d = pixelDist();
  const front = Math.max(0, ...visibleWindows().map((w) => w.z));
  const back = stack[stack.length - 1]?.z ?? 0;
  // 스크롤 앞(↑) = 안쪽(폴더 깊이)으로, 뒤(↓) = 바깥쪽(창 층)으로
  goalZ = THREE.MathUtils.clamp(goalZ + (e.deltaY || e.deltaX) * 0.03 * (e.shiftKey ? 0.35 : 1), back + d, front + d + GAP * 0.6);
  lastWheel = performance.now();
  snapPending = true;
}, { passive: false });

// 마우스로 끌어 상하좌우 페이지로: 빈 곳이나 페이지 바탕을 끌면 화면이 손을 따라오고, 놓으면 가까운 페이지에 맞춘다.
let pan = null;
function startPan(e) {
  if (!isActive(view) || e.button !== 0) return;
  if (e.target instanceof Element && e.target.closest('.icon, .win, button, input, select')) return;
  pan = { x: e.clientX, y: e.clientY, gx: goalX, gy: goalY, moved: 0 };
}
addEventListener('pointerdown', (e) => {
  if (e.target instanceof Element && (e.target === document.querySelector('#stage canvas') || e.target.closest('.panel3d'))) startPan(e);
});
addEventListener('pointermove', (e) => {
  if (!pan) return;
  const dx = e.clientX - pan.x, dy = e.clientY - pan.y;
  pan.moved = Math.max(pan.moved, Math.abs(dx) + Math.abs(dy));
  // 맞춰진 층에서는 화면 1px = 층 위 1px 이라 손가락처럼 그대로 따라온다
  goalX = camX = pan.gx - dx * SCALE;
  goalY = camY = pan.gy + dy * SCALE;
});
addEventListener('pointerup', () => {
  if (!pan) return;
  const layer = nearestLayer(camZ - pixelDist());
  // 화면의 1/5 이상 끌었으면 그 방향의 다음 페이지로
  const dx = (goalX - pan.gx) / pageW(), dy = (goalY - pan.gy) / pageH();
  const bias = (v) => (Math.abs(v) > 0.2 ? Math.sign(v) * 0.5 : 0);
  const [col, row] = snapPage(layer, pan.gx + (dx + bias(dx)) * pageW(), pan.gy + (dy + bias(dy)) * pageH());
  goalX = col * pageW();
  goalY = -row * pageH();
  pan = null;
});

addEventListener('keydown', (e) => {
  if (!isActive(view) || isTyping(e.target)) return;
  const layerNow = nearestLayer(camZ - pixelDist());
  const step = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.code];
  if (step && layerNow.kind === 'folder') {
    const [c, r] = snapPage(layerNow);
    const [col, row] = snapPage(layerNow, (c + step[0]) * pageW(), -(r + step[1]) * pageH());
    goalX = col * pageW();
    goalY = -row * pageH();
    e.preventDefault();
  }
  const list = layers();
  const i = list.indexOf(shownLayer);
  if ((e.code === 'PageDown') && i < list.length - 1) flyToZ(list[i + 1].z);
  if ((e.code === 'PageUp' || e.code === 'Backspace') && i > 0) flyToZ(list[i - 1].z);
});

// --- 프레임 --------------------------------------------------------------------
function update(dt) {
  const d = pixelDist();
  if (snapPending && performance.now() - lastWheel > 300) {
    const layer = nearestLayer(goalZ - d);
    flyToZ(layer.z, snapPage(layer));
  }

  const k = 1 - Math.exp(-dt * 7);
  camZ += (goalZ - camZ) * k;
  if (!pan) {
    camX += (goalX - camX) * k;
    camY += (goalY - camY) * k;
  }
  camera.position.set(camX, camY, camZ);
  camera.lookAt(camX, camY, camZ - 1);

  // 카메라를 지나친 층은 사라지고, 멀리 있는 층은 어두워진다.
  const panels = [...windows, ...stack.flatMap((l) => l.pages.map((p) => ({ ...p, z: l.z })))];
  for (const l of panels) {
    l.obj.position.z += (l.z - l.obj.position.z) * k;
    const dz = camZ - l.obj.position.z;
    const opacity = THREE.MathUtils.clamp((dz - 0.4 * d) / (0.5 * d), 0, 1);
    l.el.style.opacity = opacity.toFixed(3);
    l.el.style.filter = `brightness(${(1 - THREE.MathUtils.clamp((dz - d) / (GAP * 4), 0, 0.55)).toFixed(3)})`;
    l.obj.visible = !l.minimized && opacity > 0.02;
  }

  const now = nearestLayer(camZ - d);
  const key = `${stack.indexOf(now)}:${windows.indexOf(now)}:${pageIndex(now)}`;
  if (now !== shownLayer || key !== lastGaugeKey) { lastGaugeKey = key; renderGauge(); }
}

const view = {
  scene, camera,
  layers: [css3d.domElement, gaugeEl, hintEl],
  update,
  render: () => css3d.render(scene, camera),
  resize: () => {
    css3d.setSize(innerWidth, innerHeight);
    stack.forEach((l) => renderLayer(l));
  },
  status: () => {
    const list = layers();
    const pages = shownLayer?.kind === 'folder' && shownLayer.pages.length > 1 ? ` · 페이지 ${pageIndex(shownLayer) + 1}/${shownLayer.pages.length}` : '';
    return `층 ${list.indexOf(shownLayer) + 1}/${list.length} · ${shownLayer?.kind === 'window' ? shownLayer.title : shownLayer?.name ?? ''}${pages}`;
  },
};
registerView('desktop', view);
