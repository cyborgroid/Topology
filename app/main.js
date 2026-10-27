// Topology 데스크톱 셸의 메인 프로세스.
// 화면(renderer)은 3D Topology 이고, 여기서는 실제 OS(파일, 앱, 네트워크, 시스템)와 연결한다.
const { app, BrowserWindow, ipcMain, shell, protocol, net } = require('electron');
const { execFile, exec, spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..');
const HOME = os.homedir();

// GPU 가 없는 환경(VM, 가상 디스플레이)에서는 소프트웨어 WebGL 로 그린다.
if (process.env.TOPOLOGY_SOFTWARE_GL) {
  app.commandLine.appendSwitch('use-gl', 'angle');
  app.commandLine.appendSwitch('use-angle', 'swiftshader');
  app.commandLine.appendSwitch('enable-unsafe-swiftshader');
  app.commandLine.appendSwitch('ignore-gpu-blocklist');
}

protocol.registerSchemesAsPrivileged([
  { scheme: 'topology', privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

function run(file, args) {
  return new Promise((resolve) => {
    execFile(file, args, { timeout: 8000 }, (err, stdout) => resolve(err ? '' : stdout));
  });
}

// nmcli -t 출력은 ':' 로 구분되고 값 안의 ':' 는 '\:' 로 이스케이프된다.
function splitTerse(line) {
  return line.split(/(?<!\\):/).map((v) => v.replace(/\\:/g, ':'));
}

async function xdgDir(name, fallback) {
  const out = (await run('xdg-user-dir', [name])).trim();
  return out && out !== HOME ? out : path.join(HOME, fallback);
}

// --- 파일 시스템 ------------------------------------------------------------
ipcMain.handle('fs:places', async () => ({
  home: HOME,
  desktop: await xdgDir('DESKTOP', 'Desktop'),
  documents: await xdgDir('DOCUMENTS', 'Documents'),
  downloads: await xdgDir('DOWNLOAD', 'Downloads'),
  music: await xdgDir('MUSIC', 'Music'),
  pictures: await xdgDir('PICTURES', 'Pictures'),
  public: await xdgDir('PUBLICSHARE', 'Public'),
  templates: await xdgDir('TEMPLATES', 'Templates'),
  videos: await xdgDir('VIDEOS', 'Videos'),
}));

ipcMain.handle('fs:list', async (_e, dir, { hidden = false, limit = 500 } = {}) => {
  const target = path.resolve(dir || HOME);
  try {
    const dirents = await fs.readdir(target, { withFileTypes: true });
    const visible = dirents.filter((d) => hidden || !d.name.startsWith('.'));
    const entries = await Promise.all(visible.slice(0, limit).map(async (d) => {
      const full = path.join(target, d.name);
      const st = await fs.stat(full).catch(() => null);
      return { name: d.name, path: full, dir: st ? st.isDirectory() : d.isDirectory(), size: st ? st.size : 0 };
    }));
    entries.sort((a, b) => (b.dir - a.dir) || a.name.localeCompare(b.name, 'ko'));
    return { path: target, entries, total: visible.length };
  } catch (err) {
    return { path: target, entries: [], total: 0, error: err.message };
  }
});

ipcMain.handle('fs:open', (_e, p) => shell.openPath(p));

// --- 터미널 -----------------------------------------------------------------
ipcMain.handle('term:exec', async (_e, cmd, cwd) => {
  const cd = cmd.match(/^\s*cd(?:\s+(.+?))?\s*$/);
  if (cd) {
    const arg = (cd[1] || '~').replace(/^~(?=\/|$)/, HOME);
    const next = path.resolve(cwd, arg);
    const st = await fs.stat(next).catch(() => null);
    return st && st.isDirectory()
      ? { stdout: '', stderr: '', cwd: next }
      : { stdout: '', stderr: `cd: ${cd[1]}: 그런 디렉터리가 없습니다\n`, cwd };
  }
  return new Promise((resolve) => {
    exec(cmd, { cwd, shell: '/bin/bash', timeout: 30000, maxBuffer: 4 << 20 }, (err, stdout, stderr) => {
      resolve({ stdout, stderr: stderr || (err && !stdout ? `${err.message}\n` : ''), cwd });
    });
  });
});

// --- 시스템 / 네트워크 --------------------------------------------------------
async function battery() {
  const base = '/sys/class/power_supply';
  const names = await fs.readdir(base).catch(() => []);
  const bat = names.find((n) => n.startsWith('BAT'));
  if (!bat) return null;
  const read = (f) => fs.readFile(path.join(base, bat, f), 'utf8').then((s) => s.trim()).catch(() => '');
  return { capacity: Number(await read('capacity')), status: await read('status') };
}

ipcMain.handle('sys:info', async () => ({
  hostname: os.hostname(),
  user: os.userInfo().username,
  platform: `${os.type()} ${os.release()}`,
  cpu: os.cpus()[0]?.model ?? '',
  cores: os.cpus().length,
  load: os.loadavg(),
  memTotal: os.totalmem(),
  memFree: os.freemem(),
  uptime: os.uptime(),
  battery: await battery(),
}));

ipcMain.handle('net:info', async () => {
  const active = (await run('nmcli', ['-t', '-f', 'NAME,TYPE,DEVICE', 'connection', 'show', '--active']))
    .split('\n').filter(Boolean).map(splitTerse)
    .map(([name, type, device]) => ({ name, type, device }));
  const wifi = (await run('nmcli', ['-t', '-f', 'IN-USE,SSID,SIGNAL,SECURITY', 'device', 'wifi', 'list', '--rescan', 'no']))
    .split('\n').filter(Boolean).map(splitTerse)
    .map(([inUse, ssid, signal, security]) => ({ inUse: inUse === '*', ssid, signal: Number(signal), security }))
    .filter((w) => w.ssid);
  const addresses = Object.entries(os.networkInterfaces()).flatMap(([iface, list]) =>
    list.filter((a) => !a.internal).map((a) => ({ iface, family: a.family, address: a.address })));
  return { active, wifi, addresses };
});

// --- 설치된 앱 ----------------------------------------------------------------
const APP_DIRS = [
  '/usr/share/applications',
  '/var/lib/snapd/desktop/applications',
  '/var/lib/flatpak/exports/share/applications',
  path.join(HOME, '.local/share/applications'),
];

function parseDesktopEntry(text) {
  const entry = {};
  let inMain = false;
  for (const line of text.split('\n')) {
    if (line.startsWith('[')) { inMain = line.trim() === '[Desktop Entry]'; continue; }
    if (!inMain) continue;
    const i = line.indexOf('=');
    if (i > 0) entry[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return entry;
}

ipcMain.handle('apps:list', async () => {
  const apps = new Map();
  for (const dir of APP_DIRS) {
    const files = await fs.readdir(dir).catch(() => []);
    for (const f of files.filter((f) => f.endsWith('.desktop'))) {
      const e = parseDesktopEntry(await fs.readFile(path.join(dir, f), 'utf8').catch(() => ''));
      const id = f.slice(0, -'.desktop'.length);
      if (e.Type !== 'Application' || e.NoDisplay === 'true' || e.Hidden === 'true') { apps.delete(id); continue; }
      apps.set(id, { id, name: e['Name[ko]'] || e.Name || id, comment: e['Comment[ko]'] || e.Comment || '' });
    }
  }
  return [...apps.values()].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
});

ipcMain.handle('apps:launch', (_e, id) => {
  spawn('gtk-launch', [id], { detached: true, stdio: 'ignore' }).unref();
});

ipcMain.handle('app:quit', () => app.quit());

// --- 창 ---------------------------------------------------------------------
function createWindow() {
  const windowed = !!process.env.TOPOLOGY_WINDOWED;
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    fullscreen: !windowed,
    frame: windowed,
    backgroundColor: '#04223a',
    icon: path.join(ROOT, 'assets/icon.png'),
    title: 'Topology',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true },
  });
  win.setMenuBarVisibility(false);

  const snapshot = process.env.TOPOLOGY_SNAPSHOT;
  win.loadURL(`topology://app/index.html${process.env.TOPOLOGY_DEMO ? '?demo' : ''}`);

  // 개발 확인용: 화면을 캡처해서 파일로 저장하고 종료한다.
  if (snapshot) {
    win.webContents.once('did-finish-load', () => setTimeout(async () => {
      await fs.writeFile(snapshot, (await win.webContents.capturePage()).toPNG());
      app.quit();
    }, 5000));
  }
}

app.whenReady().then(() => {
  protocol.handle('topology', (req) => {
    const file = path.join(ROOT, decodeURIComponent(new URL(req.url).pathname));
    if (!file.startsWith(ROOT + path.sep)) return new Response('', { status: 403 });
    return net.fetch(pathToFileURL(file).toString());
  });
  createWindow();
});

app.on('window-all-closed', () => app.quit());
