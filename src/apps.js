// 데스크톱 뷰의 창 안에서 동작하는 내장 앱. 모두 실제 OS(api)를 통해 동작한다.
// 폴더 탐색은 창이 아니라 다이어그램 뷰에서 스크롤로 한다.
import { api } from './bridge.js';

function h(tag, props = {}, ...children) {
  const el = Object.assign(document.createElement(tag), props);
  el.append(...children);
  return el;
}

function formatBytes(n) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(i ? 1 : 0)} ${units[i]}`;
}

export function terminalApp(start) {
  return {
    title: '터미널', icon: '⌨', width: 680, height: 420,
    build(body, win) {
      body.classList.add('app-terminal');
      const out = h('pre', { className: 'out' });
      const prompt = h('span', { className: 'prompt' });
      const input = h('input', { spellcheck: false, autocomplete: 'off' });
      const form = h('form', {}, prompt, input);
      body.append(out, form);
      const history = [];
      let cwd = start, cursor = 0;

      const setPrompt = () => {
        prompt.textContent = `${cwd.split('/').pop() || '/'} $`;
        win.setTitle(`터미널 — ${cwd.split('/').pop() || '/'}`);
      };
      const print = (text, cls) => {
        out.append(h('span', { className: cls || '', textContent: text }));
        out.scrollTop = out.scrollHeight;
      };

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const cmd = input.value;
        input.value = '';
        print(`${prompt.textContent} ${cmd}\n`, 'cmd');
        if (!cmd.trim()) return;
        if (cmd.trim() === 'clear') { out.replaceChildren(); return; }
        history.push(cmd);
        cursor = history.length;
        input.disabled = true;
        const r = await api.exec(cmd, cwd);
        input.disabled = false;
        input.focus();
        if (r.stdout) print(r.stdout);
        if (r.stderr) print(r.stderr, 'err');
        cwd = r.cwd;
        setPrompt();
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowUp' && cursor > 0) input.value = history[--cursor];
        if (e.key === 'ArrowDown') input.value = history[++cursor] ?? (cursor = history.length, '');
      });

      print('Topology 터미널 — 명령은 bash 로 실행됩니다. (vim 같은 대화형 프로그램은 지원하지 않음)\n', 'dim');
      setPrompt();
      body.addEventListener('pointerup', () => input.focus());
      setTimeout(() => input.focus(), 50);
    },
  };
}

export function systemApp() {
  return {
    title: '시스템', icon: '🖥', width: 520, height: 340,
    build(body, win) {
      body.classList.add('app-system');
      async function refresh() {
        const s = await api.sysInfo();
        const used = s.memTotal - s.memFree;
        const rows = [
          ['호스트', `${s.user}@${s.hostname}`],
          ['OS', s.platform],
          ['CPU', `${s.cpu} (${s.cores}코어)`],
          ['부하', s.load.map((n) => n.toFixed(2)).join(' / ')],
          ['메모리', `${formatBytes(used)} / ${formatBytes(s.memTotal)} (${Math.round((used / s.memTotal) * 100)}%)`],
          ['가동 시간', `${Math.floor(s.uptime / 3600)}시간 ${Math.floor((s.uptime % 3600) / 60)}분`],
        ];
        if (s.battery) rows.push(['배터리', `${s.battery.capacity}% (${s.battery.status})`]);
        body.replaceChildren(h('table', {}, ...rows.map(([k, v]) => h('tr', {}, h('th', { textContent: k }), h('td', { textContent: v })))));
      }
      refresh();
      const timer = setInterval(refresh, 2000);
      win.cleanup.push(() => clearInterval(timer));
    },
  };
}

export function networkApp() {
  return {
    title: '네트워크', icon: '📶', width: 560, height: 440,
    build(body) {
      body.classList.add('app-network');
      async function refresh() {
        body.replaceChildren(h('div', { className: 'dim', textContent: '불러오는 중…' }));
        const n = await api.netInfo();
        const section = (title, items) => h('section', {}, h('h3', { textContent: title }),
          ...(items.length ? items : [h('div', { className: 'dim', textContent: '없음' })]));
        const btn = h('button', { textContent: '새로 고침' });
        btn.addEventListener('click', refresh);
        body.replaceChildren(
          btn,
          section('연결됨', n.active.map((c) => h('div', { textContent: `${c.name} · ${c.type} · ${c.device}` }))),
          section('주소', n.addresses.map((a) => h('div', { textContent: `${a.iface}  ${a.family}  ${a.address}` }))),
          section('Wi-Fi', n.wifi.map((w) => h('div', { className: w.inUse ? 'active' : '',
            textContent: `${w.inUse ? '● ' : ''}${w.ssid}  ${w.signal}%  ${w.security || '개방'}` }))),
        );
      }
      refresh();
    },
  };
}
