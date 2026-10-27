const { contextBridge, ipcRenderer } = require('electron');

const NAMES = ['places', 'listDir', 'open', 'exec', 'sysInfo', 'netInfo', 'apps', 'launch', 'loadProgram', 'saveProgram'];

contextBridge.exposeInMainWorld('topology', {
  ...Object.fromEntries(NAMES.map((name) => [name, (...args) => ipcRenderer.invoke('api', name, args)])),
  quit: () => ipcRenderer.invoke('quit'),
});
