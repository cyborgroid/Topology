// 3D 창 안에서 동작하는 내장 앱들. 모두 window.topology(실제 OS)를 통해 동작한다.
import { GROUPS, NODES, LINKS } from './topology.config.js';
import { reveal } from './filegraph.js';

const api = window.topology;

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

export function filesApp(start) {
  return {
    title: '파일', icon: '📁', width: 720, height: 460,
    build(body, win) {
      body.classList.add('app-files');
      const pathInput = h('input', { className: 'path', spellcheck: false });
      const up = h('button', { textContent: '↑', title: '상위 폴더' });
      const home = h('button', { textContent: '⌂', title: '홈' });
      const show3d = h('button', { textContent: '◈ Topology 에서 보기', title: '이 폴더를 3D Topology 에서 찾아간다' });
      const list = h('div', { className: 'list' });
      body.append(h('div', { className: 'toolbar' }, up, home, pathInput, show3d), list);
      let cwd = start;

      async function go(dir) {
        const r = await api.listDir(dir);
        if (r.error) { list.replaceChildren(h('div', { className: 'error', textContent: r.error })); return; }
        cwd = r.path;
        pathInput.value = cwd;
        win.setTitle(`파일 — ${cwd.split('/').pop() || '/'}`);
        list.replaceChildren(...r.entries.map((e) => {
          const row = h('div', { className: 'row', tabIndex: 0 },
            h('span', { className: 'glyph', textContent: e.dir ? '📁' : '📄' }),
            h('span', { className: 'name', textContent: e.name }),
            h('span', { className: 'size', textContent: e.dir ? '' : formatBytes(e.size) }));
          row.addEventListener('dblclick', () => (e.dir ? go(e.path) : api.open(e.path)));
          row.addEventListener('keydown', (k) => { if (k.key === 'Enter') row.dispatchEvent(new Event('dblclick')); });
          return row;
        }));
        if (r.total > r.entries.length) list.append(h('div', { className: 'more', textContent: `… ${r.total - r.entries.length}개 더 있음` }));
      }

      up.addEventListener('click', () => go(`${cwd}/..`));
      home.addEventListener('click', async () => go((await api.places()).home));
      pathInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(pathInput.value); });
      show3d.addEventListener('click', () => reveal(cwd));
      go(start);
    },
  };
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

      const setPrompt = () => { prompt.textContent = `${cwd.split('/').pop() || '/'} $`; };
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
      win.el.addEventListener('pointerup', () => input.focus());
      setTimeout(() => input.focus(), 50);
    },
  };
}

export function systemApp() {
  return {
    title: '시스템', icon: '🖥', width: 520, height: 360,
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

export function nodeApp(node) {
  const def = NODES.find((n) => n.id === node.id);
  const linked = LINKS.filter((l) => l.includes(node.id))
    .map((l) => NODES.find((n) => n.id === (l[0] === node.id ? l[1] : l[0])).name);
  return {
    title: node.name, icon: '◈', width: 420, height: 240,
    build(body) {
      body.classList.add('app-node');
      body.append(
        h('div', { className: 'dim', textContent: GROUPS[def.group].label }),
        h('p', { textContent: def.desc }),
        h('div', { className: 'dim', textContent: `연결: ${linked.join(', ')}` }),
      );
    },
  };
}
