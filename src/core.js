// 공용 렌더러와 뷰 전환. 다이어그램 뷰와 데스크톱 뷰는 각자 장면과 카메라를 갖고,
// 활성 뷰만 그리고 입력을 받는다.
import * as THREE from 'three';

export const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
document.getElementById('stage').appendChild(renderer.domElement);
export const canvas = renderer.domElement;

export const isTyping = (t) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
// 창, 패널, 작업 표시줄 위의 입력은 그 UI 의 몫이다.
export const isUi = (t) => t instanceof Element && !!t.closest('.win, .taskbar, .start-menu, .panel');

const views = new Map();
const listeners = [];
let active = null;

// view: { scene, camera, layers: [DOM], update(dt, t), render(), resize(), status() }
export function registerView(name, view) {
  view.name = name;
  view.layers.forEach((el) => { el.hidden = true; });
  views.set(name, view);
}

export function setView(name) {
  const next = views.get(name);
  if (!next || next === active) return;
  if (active) active.layers.forEach((el) => { el.hidden = true; });
  active = next;
  active.layers.forEach((el) => { el.hidden = false; });
  document.body.dataset.view = name;
  listeners.forEach((fn) => fn(name));
}

export const isActive = (view) => active === view;
export const activeName = () => active?.name;
export const onViewChange = (fn) => listeners.push(fn);

const tickers = [];
export const onTick = (fn) => tickers.push(fn);

const clock = new THREE.Clock();
function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  if (active) {
    active.update(dt, t);
    renderer.render(active.scene, active.camera);
    active.render();
    tickers.forEach((fn) => fn(active, dt));
  }
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  for (const v of views.values()) {
    v.camera.aspect = innerWidth / innerHeight;
    v.camera.updateProjectionMatrix();
    v.resize();
  }
});
