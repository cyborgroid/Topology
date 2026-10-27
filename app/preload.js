const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('topology', {
  places: () => ipcRenderer.invoke('fs:places'),
  listDir: (dir, opts) => ipcRenderer.invoke('fs:list', dir, opts),
  open: (p) => ipcRenderer.invoke('fs:open', p),
  exec: (cmd, cwd) => ipcRenderer.invoke('term:exec', cmd, cwd),
  sysInfo: () => ipcRenderer.invoke('sys:info'),
  netInfo: () => ipcRenderer.invoke('net:info'),
  apps: () => ipcRenderer.invoke('apps:list'),
  launch: (id) => ipcRenderer.invoke('apps:launch', id),
  quit: () => ipcRenderer.invoke('app:quit'),
});
