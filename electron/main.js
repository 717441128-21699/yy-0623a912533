const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

const isDev = !app.isPackaged;
const userDataPath = app.getPath('userData');
const dataDir = path.join(userDataPath, 'data');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const getDataFilePath = (filename) => path.join(dataDir, `${filename}.json`);

const readData = (filename, defaultData = []) => {
  const filePath = getDataFilePath(filename);
  if (!fs.existsSync(filePath)) return defaultData;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return defaultData;
  }
};

const writeData = (filename, data) => {
  const filePath = getDataFilePath(filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  return true;
};

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1200,
    minHeight: 760,
    backgroundColor: '#f0f2f5',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('data:read', (_e, filename, defaultData) => {
  return readData(filename, defaultData);
});

ipcMain.handle('data:write', (_e, filename, data) => {
  return writeData(filename, data);
});

ipcMain.handle('dialog:openFile', async (_e, filters) => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: filters || [
      { name: 'Excel/CSV 文件', extensions: ['xlsx', 'xls', 'csv'] },
      { name: '所有文件', extensions: ['*'] }
    ]
  });
  return result.filePaths;
});

ipcMain.handle('dialog:saveFile', async (_e, defaultPath, filters) => {
  const result = await dialog.showSaveDialog({
    defaultPath,
    filters: filters || [{ name: '所有文件', extensions: ['*'] }]
  });
  return result.filePath;
});
