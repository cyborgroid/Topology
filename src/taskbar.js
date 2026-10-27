// 작업 표시줄: 뷰 전환, 시작 메뉴(내장 앱 + 설치된 앱), 상태 표시(위치, 네트워크, 배터리, 시계).
import { api } from './bridge.js';
import { setView, onViewChange, onTick } from './core.js';

export function initTaskbar({ builtins, onNetwork }) {
  const $ = (id) => document.getElementById(id);

  const viewSwitch = $('view-switch');
  viewSwitch.addEventListener('click', (e) => {
    const name = e.target.closest('button')?.dataset.view;
    if (name) setView(name);
  });
  onViewChange((name) => {
    viewSwitch.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.view === name));
  });

  initStartMenu(builtins);

  onTick((view) => { $('tray-pos').textContent = view.status(); });
  const clock = () => {
    $('tray-clock').textContent = new Date().toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };
  const status = async () => {
    const [n, s] = await Promise.all([api.netInfo(), api.sysInfo()]);
    const wifi = n.wifi.find((w) => w.inUse);
    $('tray-net').textContent = wifi ? `📶 ${wifi.ssid}` : n.active[0] ? `🔌 ${n.active[0].name}` : '⚠ 오프라인';
    $('tray-bat').textContent = s.battery ? `🔋 ${s.battery.capacity}%` : '';
  };
  $('tray-net').addEventListener('click', onNetwork);
  clock();
  status();
  setInterval(clock, 1000);
  setInterval(status, 15000);
}

function initStartMenu(builtins) {
  const btn = document.getElementById('start-btn');
  const menu = document.getElementById('start-menu');
  const search = menu.querySelector('.start-search');
  const builtinList = menu.querySelector('.start-builtins');
  const appList = menu.querySelector('.start-apps');
  let installed = null;

  const close = () => { menu.hidden = true; };
  const open = async () => {
    menu.hidden = false;
    search.value = '';
    search.focus();
    installed ??= await api.apps();
    renderApps();
  };

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
        item.addEventListener('click', () => { close(); api.launch(a.id); });
        return item;
      }));
  }

  btn.addEventListener('click', () => (menu.hidden ? open() : close()));
  search.addEventListener('input', renderApps);
  search.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') appList.querySelector('button')?.click();
  });
  menu.querySelector('.start-quit').addEventListener('click', () => api.quit());
  addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  addEventListener('pointerdown', (e) => {
    if (!menu.hidden && !e.target.closest('.start-menu, #start-btn')) close();
  });
}
