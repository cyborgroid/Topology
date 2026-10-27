// QE Analog Topology 가 실제 컴퓨터(파일, 앱, 네트워크, 시스템)에 닿는 통로.
// run.sh 의 로컬 서버(server/server.js)와 vmware.sh 의 Electron 셸(app/main.js)이 함께 쓴다.
const { execFile, exec, spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const HOME = os.homedir();

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

async function places() {
  return {
    home: HOME,
    desktop: await xdgDir('DESKTOP', 'Desktop'),
    documents: await xdgDir('DOCUMENTS', 'Documents'),
    downloads: await xdgDir('DOWNLOAD', 'Downloads'),
    music: await xdgDir('MUSIC', 'Music'),
    pictures: await xdgDir('PICTURES', 'Pictures'),
    public: await xdgDir('PUBLICSHARE', 'Public'),
    templates: await xdgDir('TEMPLATES', 'Templates'),
    videos: await xdgDir('VIDEOS', 'Videos'),
  };
}

// 폴더 먼저, 이름순으로 정렬한 뒤 offset 부터 limit 개를 돌려준다.
async function listDir(dir, { hidden = false, limit = 500, offset = 0 } = {}) {
  const target = path.resolve(dir || HOME);
  try {
    const dirents = (await fs.readdir(target, { withFileTypes: true }))
      .filter((d) => hidden || !d.name.startsWith('.'));
    const all = await Promise.all(dirents.map(async (d) => {
      const full = path.join(target, d.name);
      const isDir = d.isDirectory() || (d.isSymbolicLink() && (await fs.stat(full).catch(() => null))?.isDirectory() === true);
      return { name: d.name, path: full, dir: isDir, size: 0 };
    }));
    all.sort((a, b) => (b.dir - a.dir) || a.name.localeCompare(b.name, 'ko'));
    const entries = all.slice(offset, offset + limit);
    await Promise.all(entries.filter((e) => !e.dir).map(async (e) => {
      e.size = (await fs.stat(e.path).catch(() => null))?.size ?? 0;
    }));
    return { path: target, entries, total: all.length, offset };
  } catch (err) {
    return { path: target, entries: [], total: 0, offset, error: err.message };
  }
}

function open(p) {
  spawn('xdg-open', [p], { detached: true, stdio: 'ignore' }).unref();
}

async function execCommand(cmd, cwd) {
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
}

async function battery() {
  const base = '/sys/class/power_supply';
  const names = await fs.readdir(base).catch(() => []);
  const bat = names.find((n) => n.startsWith('BAT'));
  if (!bat) return null;
  const read = (f) => fs.readFile(path.join(base, bat, f), 'utf8').then((s) => s.trim()).catch(() => '');
  return { capacity: Number(await read('capacity')), status: await read('status') };
}

async function sysInfo() {
  return {
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
  };
}

async function netInfo() {
  const active = (await run('nmcli', ['-t', '-f', 'NAME,TYPE,DEVICE', 'connection', 'show', '--active']))
    .split('\n').filter(Boolean).map(splitTerse)
    .map(([name, type, device]) => ({ name, type, device }));
  const wifi = (await run('nmcli', ['-t', '-f', 'IN-USE,SSID,SIGNAL,SECURITY', 'device', 'wifi', 'list', '--rescan', 'no']))
    .split('\n').filter(Boolean).map(splitTerse)
    .map(([inUse, ssid, signal, security]) => ({ inUse: inUse === '*', ssid, signal: Number(signal), security }))
    .filter((w) => w.ssid);
  const addresses = Object.entries(os.networkInterfaces()).flatMap(([iface, list]) =>
    list.filter((a) => !a.internal).map((a) => ({ iface, family: a.family, address: a.address })));
  // tun/wg/ppp/tap 이나 이름에 vpn·proton 이 들어간 인터페이스가 있으면 VPN 이 켜진 것으로 본다.
  const vpn = Object.keys(os.networkInterfaces()).some((n) => /^(tun|wg|ppp|tap)|vpn|proton/i.test(n));
  return { active, wifi, addresses, vpn };
}

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

async function apps() {
  const found = new Map();
  for (const dir of APP_DIRS) {
    const files = await fs.readdir(dir).catch(() => []);
    for (const f of files.filter((f) => f.endsWith('.desktop'))) {
      const e = parseDesktopEntry(await fs.readFile(path.join(dir, f), 'utf8').catch(() => ''));
      const id = f.slice(0, -'.desktop'.length);
      if (e.Type !== 'Application' || e.NoDisplay === 'true' || e.Hidden === 'true') { found.delete(id); continue; }
      found.set(id, { id, name: e['Name[ko]'] || e.Name || id, comment: e['Comment[ko]'] || e.Comment || '' });
    }
  }
  return [...found.values()].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
}

function launch(id) {
  spawn('gtk-launch', [String(id)], { detached: true, stdio: 'ignore' }).unref();
}

// 양자 뉴런 블록 프로그램: 사용자가 쌓은 블록을 컴퓨터에 저장해 다음에 이어서 쌓는다.
const PROGRAM = path.join(HOME, '.config', 'qe-analog-topology', 'program.json');

async function loadProgram() {
  try {
    return JSON.parse(await fs.readFile(PROGRAM, 'utf8'));
  } catch {
    return null;
  }
}

async function saveProgram(program) {
  if (!program || !Array.isArray(program.blocks)) throw new Error('잘못된 프로그램');
  await fs.mkdir(path.dirname(PROGRAM), { recursive: true });
  await fs.writeFile(PROGRAM, JSON.stringify(program, null, 2));
  return true;
}

module.exports = { places, listDir, open, exec: execCommand, sysInfo, netInfo, apps, launch, loadProgram, saveProgram };
