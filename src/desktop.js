// 데스크톱 뷰: 평소 쓰던 2D Digital OS 데스크톱을 깊이 방향으로 펼친 것. 스크롤로 깊이를 오간다.
//   앞(카메라 쪽) : 열린 창들이 한 층씩
//   가운데(z=0)   : 바탕화면
//   뒤            : 폴더 층. 폴더를 누르면 그 내용이 바로 뒤에 새 층으로 생긴다.
// 스크롤을 멈추면 가장 가까운 층에 맞춰져 그 층이 픽셀 그대로(평소 2D 화면처럼) 보인다.
import * as THREE from 'three';
import { CSS3DRenderer, CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';
import { api } from './bridge.js';
import { registerView, isActive, isUi, isTyping, setView } from './core.js';

const SCALE = 0.02;   // CSS 1px = 0.02 월드 단위
const GAP = 9;        // 층 사이 거리
const TASKBAR = 46;
const ICON = 100;     // 아이콘 칸 크기(px)
const HEAD = 44;      // 폴더 층 머리줄 높이(px)
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

function flyToZ(z) {
  goalZ = z + pixelDist();
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
  const el = document.createElement('div');
  el.className = `panel3d ${index === 0 ? 'desktop-wall' : 'folder-layer'}`;
  el.innerHTML = `
    <div class="layer-head">
      <span class="layer-name"></span><span class="layer-count"></span>
      <span class="pager"><button data-p="-1">◀</button><span class="page"></span><button data-p="1">▶</button></span>
    </div>
    <div class="layer-icons"></div>`;
  el.querySelector('.layer-name').textContent = name;
  const obj = new CSS3DObject(el);
  obj.scale.setScalar(SCALE);
  const layer = { kind: 'folder', index, path, name, z: -index * GAP, el, obj, selected: null, page: 0, pages: 1 };
  el.querySelector('.pager').addEventListener('click', (e) => {
    const d = Number(e.target.dataset.p);
    if (!d) return;
    layer.page = THREE.MathUtils.clamp(layer.page + d, 0, layer.pages - 1);
    renderLayer(layer);
  });
  sizeLayer(layer);
  scene.add(obj);
  return layer;
}

function sizeLayer(layer) {
  const { w, h } = panelSize();
  layer.el.style.width = `${w}px`;
  layer.el.style.height = `${h}px`;
  layer.obj.position.set(0, (TASKBAR / 2) * SCALE, layer.z);
}

async function renderLayer(layer) {
  const per = perPage();
  const sp = layer.index === 0 ? specials : [];
  const offset = layer.page === 0 ? 0 : layer.page * per - sp.length;
  const limit = layer.page === 0 ? per - sp.length : per;
  const r = await api.listDir(layer.path, { offset, limit });
  layer.pages = Math.max(1, Math.ceil((r.total + sp.length) / per));

  layer.el.querySelector('.layer-count').textContent = r.error ? r.error : `${r.total}개`;
  layer.el.querySelector('.page').textContent = `${layer.page + 1} / ${layer.pages}`;
  layer.el.querySelector('.pager').hidden = layer.pages < 2;

  const items = [
    ...(layer.page === 0 ? sp.map((s) => ({ ...s, dir: !!s.path })) : []),
    ...r.entries.map((e) => ({ name: e.name, path: e.path, dir: e.dir, glyph: e.dir ? '📁' : '📄' })),
  ];
  layer.el.querySelector('.layer-icons').replaceChildren(...items.map((item) => {
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
}

function truncate(length) {
  while (stack.length > length) scene.remove(stack.pop().obj);
}

// layer 에서 고른 폴더를 바로 뒤 층으로 연다. 그보다 깊던 층은 새로 고른 폴더 기준으로 다시 만든다.
async function openBehind(layer, path, name) {
  layer.selected = path;
  layer.el.querySelectorAll('.icon').forEach((el) => el.classList.toggle('selected', el.title === name));
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

function renderGauge() {
  shownLayer = nearestLayer(camZ - pixelDist());
  gaugeEl.replaceChildren(
    Object.assign(document.createElement('div'), { className: 'gauge-title', textContent: '깊이 ↕ 스크롤' }),
    ...layers().map((l) => {
      const b = document.createElement('button');
      b.textContent = l.kind === 'window' ? `${l.icon} ${l.title}` : l.name;
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

addEventListener('keydown', (e) => {
  if (!isActive(view) || isTyping(e.target)) return;
  const list = layers();
  const i = list.indexOf(shownLayer);
  if ((e.code === 'PageDown') && i < list.length - 1) flyToZ(list[i + 1].z);
  if ((e.code === 'PageUp' || e.code === 'Backspace') && i > 0) flyToZ(list[i - 1].z);
});

// --- 프레임 --------------------------------------------------------------------
function update(dt) {
  const d = pixelDist();
  if (snapPending && performance.now() - lastWheel > 300) flyToZ(nearestLayer(goalZ - d).z);

  const k = 1 - Math.exp(-dt * 7);
  camZ += (goalZ - camZ) * k;
  camera.position.set(0, 0, camZ);
  camera.lookAt(0, 0, camZ - 1);

  // 카메라를 지나친 층은 사라지고, 멀리 있는 층은 어두워진다.
  for (const l of [...windows, ...stack]) {
    l.obj.position.z += (l.z - l.obj.position.z) * k;
    const dz = camZ - l.obj.position.z;
    const opacity = THREE.MathUtils.clamp((dz - 0.4 * d) / (0.5 * d), 0, 1);
    l.el.style.opacity = opacity.toFixed(3);
    l.el.style.filter = `brightness(${(1 - THREE.MathUtils.clamp((dz - d) / (GAP * 4), 0, 0.55)).toFixed(3)})`;
    l.obj.visible = !l.minimized && opacity > 0.02;
  }

  if (nearestLayer(camZ - d) !== shownLayer) renderGauge();
}

const view = {
  scene, camera,
  layers: [css3d.domElement, gaugeEl, hintEl],
  update,
  render: () => css3d.render(scene, camera),
  resize: () => {
    css3d.setSize(innerWidth, innerHeight);
    stack.forEach((l) => { sizeLayer(l); renderLayer(l); });
  },
  status: () => {
    const list = layers();
    return `층 ${list.indexOf(shownLayer) + 1}/${list.length} · ${shownLayer?.kind === 'window' ? shownLayer.title : shownLayer?.name ?? ''}`;
  },
};
registerView('desktop', view);
