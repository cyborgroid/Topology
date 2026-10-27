// 규격화된 데스크톱 환경(창, 작업 표시줄, 시작 메뉴, 바탕화면 아이콘)을 3D 공간에 옮긴다.
import * as THREE from 'three';
import { CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';
import { scene, camera, flyTo, worldPerPixel } from './scene.js';

const SCALE = 0.02;   // CSS 1px = 0.02 월드 단위
const windows = new Map();
const taskList = document.getElementById('task-list');
let nextId = 1;
let focused = null;

function cameraAxes() {
  return {
    right: new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion),
    up: new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion),
    forward: camera.getWorldDirection(new THREE.Vector3()),
  };
}

function focus(win) {
  if (focused) { focused.el.classList.remove('focused'); focused.tab.classList.remove('active'); }
  focused = win;
  if (win) { win.el.classList.add('focused'); win.tab.classList.add('active'); }
}

// 창을 화면 정면에 꽉 차게 보이도록 카메라를 옮긴다.
function frame(win) {
  const { obj, height } = win;
  const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(obj.quaternion);
  const dist = (height * SCALE * 1.3) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
  const e = new THREE.Euler().setFromQuaternion(obj.quaternion, 'YXZ');
  flyTo(obj.position.clone().addScaledVector(normal, dist), e.y, e.x);
}

export function openWindow({ title, icon = '▢', width = 640, height = 420, build }) {
  const el = document.createElement('div');
  el.className = 'win';
  el.style.width = `${width}px`;
  el.style.height = `${height}px`;
  el.innerHTML = `
    <div class="win-bar">
      <span class="win-icon"></span><span class="win-title"></span>
      <div class="win-btns">
        <button data-act="frame" title="정면으로 보기">◎</button>
        <button data-act="min" title="최소화">–</button>
        <button data-act="close" title="닫기">×</button>
      </div>
    </div>
    <div class="win-body"></div>`;
  el.querySelector('.win-icon').textContent = icon;

  // 현재 시선 앞에 카메라를 바라보도록 띄우고, 여러 개면 계단식으로 겹친다.
  const obj = new CSS3DObject(el);
  obj.scale.setScalar(SCALE);
  const { right, up, forward } = cameraAxes();
  const n = windows.size % 5;
  obj.position.copy(camera.position).addScaledVector(forward, 16)
    .addScaledVector(right, n * 0.8).addScaledVector(up, -n * 0.6);
  obj.quaternion.copy(camera.quaternion);
  scene.add(obj);

  const tab = document.createElement('button');
  tab.className = 'task';
  taskList.append(tab);

  const win = {
    id: nextId++, el, obj, tab, height, cleanup: [],
    setTitle(text) {
      el.querySelector('.win-title').textContent = text;
      tab.textContent = `${icon} ${text}`;
      tab.title = text;
    },
    close() {
      win.cleanup.forEach((fn) => fn());
      scene.remove(obj);
      tab.remove();
      windows.delete(win.id);
      if (focused === win) focus(null);
    },
    minimize() {
      obj.visible = false;
      tab.classList.add('minimized');
      if (focused === win) focus(null);
    },
    restore() {
      obj.visible = true;
      tab.classList.remove('minimized');
      focus(win);
      frame(win);
    },
  };
  win.setTitle(title);
  windows.set(win.id, win);

  el.addEventListener('pointerdown', () => focus(win));
  el.querySelector('.win-btns').addEventListener('click', (e) => {
    const act = e.target.dataset.act;
    if (act === 'close') win.close();
    if (act === 'min') win.minimize();
    if (act === 'frame') frame(win);
  });
  tab.addEventListener('click', () => {
    if (focused === win && obj.visible) win.minimize();
    else win.restore();
  });

  // 제목 표시줄: 드래그 = 시선 평면에서 이동, 스크롤 = 앞뒤(깊이) 이동, 더블클릭 = 정면으로.
  const bar = el.querySelector('.win-bar');
  let moving = false;
  bar.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    moving = true;
    bar.setPointerCapture(e.pointerId);
  });
  bar.addEventListener('pointermove', (e) => {
    if (!moving) return;
    const k = worldPerPixel(obj.position);
    const axes = cameraAxes();
    obj.position.addScaledVector(axes.right, e.movementX * k).addScaledVector(axes.up, -e.movementY * k);
  });
  bar.addEventListener('pointerup', () => { moving = false; });
  bar.addEventListener('dblclick', (e) => { if (!e.target.closest('button')) frame(win); });
  bar.addEventListener('wheel', (e) => {
    e.preventDefault();
    obj.position.addScaledVector(cameraAxes().forward, -(e.deltaY || e.deltaX) * 0.01);
  }, { passive: false });

  focus(win);
  build(el.querySelector('.win-body'), win);
  return win;
}

// 바탕화면 아이콘: 홈 시점 왼쪽에 세로 격자로 세운다.
export function placeDesktopIcons(items) {
  const ROWS = 7;
  items.forEach((item, i) => {
    const el = document.createElement('div');
    el.className = 'icon';
    el.innerHTML = '<div class="icon-glyph"></div><div class="icon-name"></div>';
    el.querySelector('.icon-glyph').textContent = item.glyph;
    el.querySelector('.icon-name').textContent = item.name;
    el.title = item.name;
    el.addEventListener('click', () => {
      document.querySelectorAll('.icon.selected').forEach((n) => n.classList.remove('selected'));
      el.classList.add('selected');
    });
    el.addEventListener('dblclick', item.open);

    const obj = new CSS3DObject(el);
    obj.scale.setScalar(SCALE);
    obj.position.set(-19 + Math.floor(i / ROWS) * 2.4, 5 - (i % ROWS) * 2.5, 10);
    scene.add(obj);
  });
}

// 시작 메뉴: 내장 앱 + 이 컴퓨터에 설치된 앱(.desktop) + 종료.
export function initStartMenu({ builtins, loadApps, launch, quit }) {
  const btn = document.getElementById('start-btn');
  const menu = document.getElementById('start-menu');
  const search = menu.querySelector('.start-search');
  const builtinList = menu.querySelector('.start-builtins');
  const appList = menu.querySelector('.start-apps');
  let installed = null;

  for (const b of builtins) {
    const item = document.createElement('button');
    item.className = 'start-tile';
    item.innerHTML = '<span class="glyph"></span><span class="name"></span>';
    item.querySelector('.glyph').textContent = b.glyph;
    item.querySelector('.name').textContent = b.name;
    item.addEventListener('click', () => { close(); b.run(); });
    builtinList.append(item);
  }

  function renderApps() {
    const q = search.value.trim().toLowerCase();
    appList.replaceChildren(...(installed ?? [])
      .filter((a) => !q || a.name.toLowerCase().includes(q) || a.id.toLowerCase().includes(q))
      .map((a) => {
        const item = document.createElement('button');
        item.className = 'start-app';
        item.textContent = a.name;
        item.title = a.comment || a.id;
        item.addEventListener('click', () => { close(); launch(a.id); });
        return item;
      }));
  }

  async function open() {
    menu.hidden = false;
    search.value = '';
    search.focus();
    installed ??= await loadApps();
    renderApps();
  }
  function close() {
    menu.hidden = true;
  }

  btn.addEventListener('click', () => (menu.hidden ? open() : close()));
  search.addEventListener('input', renderApps);
  search.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') appList.querySelector('button')?.click();
  });
  menu.querySelector('.start-quit').addEventListener('click', quit);
  addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  addEventListener('pointerdown', (e) => {
    if (!menu.hidden && !e.target.closest('.start-menu, #start-btn')) close();
  });
}
