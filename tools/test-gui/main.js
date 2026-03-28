/**
 * Electron 主进程
 * @file tools/test-gui/main.js
 */

const { app, BrowserWindow, ipcMain, clipboard } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    title: '🧪 御魂传说 - 自动化测试',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    autoHideMenuBar: true,
  });

  mainWindow.loadFile('index.html');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// ============================================================
// IPC 处理：运行测试
// ============================================================

ipcMain.handle('run-test', async (event, testType) => {
  return new Promise((resolve) => {
    const projectRoot = path.resolve(__dirname, '..', '..');
    let cwd, args;
    
    switch (testType) {
      case 'yokai':
        cwd = path.join(projectRoot, 'shared');
        args = ['test', '--', 'YokaiEffects'];
        break;
      case 'boss':
        cwd = path.join(projectRoot, 'shared');
        args = ['test', '--', 'BossEffects'];
        break;
      case 'shikigami':
        cwd = path.join(projectRoot, 'shared');
        args = ['test', '--', 'ShikigamiSkills'];
        break;
      case 'gameFlow':
        cwd = path.join(projectRoot, 'server');
        args = ['test', '--', 'gameFlow'];
        break;
      case 'consistency':
        cwd = path.join(projectRoot, 'shared');
        args = ['test', '--', 'consistency'];
        break;
      case 'all-shared':
        cwd = path.join(projectRoot, 'shared');
        args = ['test'];
        break;
      case 'all-server':
        cwd = path.join(projectRoot, 'server');
        args = ['test'];
        break;
      case 'all':
        // 运行全部：先 shared 后 server
        runAllTests(event, projectRoot, resolve);
        return;
      default:
        resolve({ success: false, output: '未知测试类型' });
        return;
    }
    
    runNpmTest(cwd, args, event, resolve);
  });
});

function runNpmTest(cwd, args, event, resolve) {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const proc = spawn(npm, args, { cwd, shell: true });
  
  let output = '';
  
  proc.stdout.on('data', (data) => {
    const text = data.toString();
    output += text;
    // 实时发送输出到渲染进程
    mainWindow.webContents.send('test-output', text);
  });
  
  proc.stderr.on('data', (data) => {
    const text = data.toString();
    output += text;
    mainWindow.webContents.send('test-output', text);
  });
  
  proc.on('close', (code) => {
    resolve({
      success: code === 0,
      output,
      exitCode: code,
    });
  });
  
  proc.on('error', (err) => {
    resolve({
      success: false,
      output: `执行错误: ${err.message}`,
      exitCode: -1,
    });
  });
}

// ============================================================
// IPC 处理：复制到剪贴板
// ============================================================

ipcMain.handle('copy-to-clipboard', (event, text) => {
  clipboard.writeText(text);
  return true;
});

function runAllTests(event, projectRoot, resolve) {
  const sharedCwd = path.join(projectRoot, 'shared');
  const serverCwd = path.join(projectRoot, 'server');
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  
  let output = '';
  let sharedSuccess = false;
  
  mainWindow.webContents.send('test-output', '\n📦 ===== 运行 Shared 测试 =====\n\n');
  
  const sharedProc = spawn(npm, ['test'], { cwd: sharedCwd, shell: true });
  
  sharedProc.stdout.on('data', (data) => {
    const text = data.toString();
    output += text;
    mainWindow.webContents.send('test-output', text);
  });
  
  sharedProc.stderr.on('data', (data) => {
    const text = data.toString();
    output += text;
    mainWindow.webContents.send('test-output', text);
  });
  
  sharedProc.on('close', (code) => {
    sharedSuccess = code === 0;
    
    mainWindow.webContents.send('test-output', '\n\n🖥️ ===== 运行 Server 测试 =====\n\n');
    
    const serverProc = spawn(npm, ['test'], { cwd: serverCwd, shell: true });
    
    serverProc.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;
      mainWindow.webContents.send('test-output', text);
    });
    
    serverProc.stderr.on('data', (data) => {
      const text = data.toString();
      output += text;
      mainWindow.webContents.send('test-output', text);
    });
    
    serverProc.on('close', (serverCode) => {
      const serverSuccess = serverCode === 0;
      resolve({
        success: sharedSuccess && serverSuccess,
        output,
        exitCode: (sharedSuccess && serverSuccess) ? 0 : 1,
      });
    });
  });
}
