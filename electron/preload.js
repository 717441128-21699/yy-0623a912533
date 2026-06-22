const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  readData: (filename, defaultData) =>
    ipcRenderer.invoke('data:read', filename, defaultData),
  writeData: (filename, data) =>
    ipcRenderer.invoke('data:write', filename, data),
  openFile: (filters) => ipcRenderer.invoke('dialog:openFile', filters),
  saveFile: (defaultPath, filters) =>
    ipcRenderer.invoke('dialog:saveFile', defaultPath, filters)
});
