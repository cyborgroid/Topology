// 데스크톱 뷰: 평소 쓰던 2D Digital OS 데스크톱을 깊이 방향으로 펼친 것.
// 바탕화면은 맨 뒤 벽이고, 창은 각자 앞쪽 층에 놓인다. 스크롤로 층 사이를 앞뒤로 오가며,
// 멈추면 가장 가까운 층에 맞춰져 그 층이 픽셀 그대로(평소 2D 화면처럼) 보인다.
import * as THREE from 'three';
import { CSS3DRenderer, CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';
import { registerView, isActive, isUi, isTyping, setView } from './core.js';

const SCALE = 0.02;   // CSS 1px = 0.02 월드 단위
const GAP = 9;        // 층 사이 거리
const TASKBAR = 46;
const BG = 0x05192b;

export const scene = new THREE.Scene();
scene.background = new THREE.Color(BG);
scene.fog = new THREE.FogExp2(BG, 0.008);

// 층 사이를 지날 때 깊이감을 주는 입자
const PARTICLES = 1500;
const pPos = new Float32Array(PARTICLES * 3);
for (let i = 0; i < PARTICLES; i++) {
  pPos[i * 3] = (Math.random() - 0.5) * 80;
  pPos[i * 3 + 1] = (Math.random() - 0.5) * 50;
  pPos[i * 3 + 2] = Math.random() * 200 - 20;
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
const taskList = document.getElementById('task-list');

// 이 거리에서 보면 층 위의 CSS 1px 이 화면 1px 이 된다.
const pixelDist = () => (SCALE * innerHeight) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
let camZ = pixelDist(), goalZ = camZ, lastWheel = 0, snapPending = false;

// --- 바탕화면 벽 ---------------------------------------------------------------
const wallEl = document.createElement('div');
wallEl.className = 'wall';
const iconsEl = document.createElement('div');
iconsEl.className = 'wall-icons';
wallEl.append(iconsEl);
const wall = new CSS3DObject(wallEl);
wall.scale.setScalar(SCALE);
scene.add(wall);

function layoutWall() {
  wallEl.style.width = `${innerWidth}px`;
  wallEl.style.height = `${innerHeight - TASKBAR}px`;
  wall.position.set(0, (TASKBAR / 2) * SCALE, 0);
}
layoutWall();

export function setDesktopIcons(items) {
  iconsEl.replaceChildren(...items.map((item) => {
    const el = document.createElement('div');
    el.className = 'icon';
    el.innerHTML = '<div class="icon-glyph"></div><div class="icon-name"></div>';
    el.querySelector('.icon-glyph').textContent = item.glyph;
    el.querySelector('.icon-name').textContent = item.name;
    el.title = item.name;
    el.addEventListener('click', () => {
      iconsEl.querySelectorAll('.icon.selected').forEach((n) => n.classList.remove('selected'));
      el.classList.add('selected');
    });
    el.addEventListener('dblclick', item.open);
    return el;
  }));
}

// --- 층 ----------------------------------------------------------------------
const windows = [];
let focused = null;
let shownLayer = null;

const visibleWindows = () => windows.filter((w) => !w.minimized);
// 앞(카메라 쪽)에서 뒤(바탕화면) 순서
const layers = () => [...visibleWindows().map((w) => ({ z: w.goalZ, win: w })), { z: 0, win: null }].sort((a, b) => b.z - a.z);

function nearestLayer(z) {
  return layers().reduce((best, l) => (Math.abs(l.z - z) < Math.abs(best.z - z) ? l : best));
}

function flyToZ(z) {
  goalZ = z + pixelDist();
  snapPending = false;
}

function compact() {
  [...windows].sort((a, b) => a.goalZ - b.goalZ).forEach((w, i) => { w.goalZ = (i + 1) * GAP; });
}

function focus(win) {
  if (focused) { focused.el.classList.remove('focused'); focused.tab.classList.remove('active'); }
  focused = win;
  if (win) { win.el.classList.add('focused'); win.tab.classList.add('active'); }
}

function renderGauge() {
  const current = nearestLayer(camZ - pixelDist());
  shownLayer = current.win;
  gaugeEl.replaceChildren(
    Object.assign(document.createElement('div'), { className: 'gauge-title', textContent: '깊이 ↕ 스크롤' }),
    ...layers().map((l) => {
      const b = document.createElement('button');
      b.textContent = l.win ? `${l.win.icon} ${l.win.title}` : '🖥 바탕화면';
      if (l.win === current.win) b.className = 'current';
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

  const z = Math.max(0, ...windows.map((w) => w.goalZ)) + GAP;
  const n = windows.length % 5;
  const obj = new CSS3DObject(el);
  obj.scale.setScalar(SCALE);
  obj.position.set((n - 2) * 36 * SCALE, (TASKBAR / 2 + 30 - n * 24) * SCALE, z);
  scene.add(obj);

  const tab = document.createElement('button');
  tab.className = 'task';
  taskList.append(tab);

  const win = {
    el, obj, tab, icon, title, goalZ: z, minimized: false, cleanup: [],
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
      flyToZ(nearestLayer(win.goalZ).z);
      renderGauge();
    },
    restore() {
      win.minimized = false;
      obj.visible = true;
      tab.classList.remove('minimized');
      focus(win);
      flyToZ(win.goalZ);
      renderGauge();
    },
  };
  windows.push(win);

  el.addEventListener('pointerdown', () => {
    focus(win);
    if (shownLayer !== win) flyToZ(win.goalZ);   // 뒤쪽 층의 창을 누르면 그 층으로 간다.
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
    win.goalZ = Math.max(1, win.goalZ - (e.deltaY || e.deltaX) * 0.02);
    flyToZ(win.goalZ);
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
  const front = Math.max(0, ...visibleWindows().map((w) => w.goalZ));
  // 스크롤 앞(↑) = 안쪽(바탕화면 쪽)으로, 뒤(↓) = 바깥쪽(앞 층)으로
  goalZ = THREE.MathUtils.clamp(goalZ + (e.deltaY || e.deltaX) * 0.03 * (e.shiftKey ? 0.35 : 1), d, front + d + GAP * 0.6);
  lastWheel = performance.now();
  snapPending = true;
}, { passive: false });

addEventListener('keydown', (e) => {
  if (!isActive(view) || isTyping(e.target)) return;
  const list = layers();
  const i = list.indexOf(list.find((l) => l.win === shownLayer));
  if (e.code === 'PageDown' && i < list.length - 1) flyToZ(list[i + 1].z);
  if (e.code === 'PageUp' && i > 0) flyToZ(list[i - 1].z);
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
  for (const w of windows) {
    w.obj.position.z += (w.goalZ - w.obj.position.z) * k;
    const dz = camZ - w.obj.position.z;
    const opacity = THREE.MathUtils.clamp((dz - 0.4 * d) / (0.5 * d), 0, 1);
    w.el.style.opacity = opacity.toFixed(3);
    w.el.style.filter = `brightness(${(1 - THREE.MathUtils.clamp((dz - d) / (GAP * 4), 0, 0.5)).toFixed(3)})`;
    w.obj.visible = !w.minimized && opacity > 0.02;
  }
  wallEl.style.filter = `brightness(${(1 - THREE.MathUtils.clamp((camZ - d) / (GAP * 4), 0, 0.5)).toFixed(3)})`;

  if (nearestLayer(camZ - d).win !== shownLayer) renderGauge();
}

const view = {
  scene, camera,
  layers: [css3d.domElement, gaugeEl],
  update,
  render: () => css3d.render(scene, camera),
  resize: () => { css3d.setSize(innerWidth, innerHeight); layoutWall(); },
  status: () => {
    const list = layers();
    return `층 ${list.findIndex((l) => l.win === shownLayer) + 1}/${list.length}`;
  },
};
registerView('desktop', view);
renderGauge();
