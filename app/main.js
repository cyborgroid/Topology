// vmware.sh 용 Electron 셸: QE Analog Topology 를 전체 화면 데스크톱으로 띄운다.
const { app, BrowserWindow, ipcMain, protocol, net } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const api = require('./os-api.js');

const ROOT = path.resolve(__dirname, '..');

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

ipcMain.handle('api', (_e, name, args) => {
  if (!Object.hasOwn(api, name)) throw new Error(`unknown api: ${name}`);
  return api[name](...args);
});
ipcMain.handle('quit', () => app.quit());

function createWindow() {
  const windowed = !!process.env.TOPOLOGY_WINDOWED;
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    fullscreen: !windowed,
    frame: windowed,
    backgroundColor: '#04223a',
    icon: path.join(ROOT, 'assets/icon.png'),
    title: 'QE Analog Topology',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true },
  });
  win.setMenuBarVisibility(false);
  win.loadURL(`topology://app/index.html${process.env.TOPOLOGY_QUERY ?? ''}`);

  // 개발 확인용: 화면을 캡처해서 파일로 저장하고 종료한다.
  const snapshot = process.env.TOPOLOGY_SNAPSHOT;
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
