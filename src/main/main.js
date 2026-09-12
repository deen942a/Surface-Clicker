const { app, BrowserWindow, ipcMain, Menu, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');

const store = require('./store');
const clicker = require('./clicker');
const hotkeys = require('./hotkeys');
const edgeStop = require('./edgeStop');
const appLock = require('./appLock');
const overlay = require('./overlay');
const macro = require('./macro');

let mainWindow;
const appLaunchTime = Date.now();

function createWindow() {
  Menu.setApplicationMenu(null);

  mainWindow = new BrowserWindow({
      width: 940,
      height: 680,
      minWidth: 780,
      minHeight: 560,
      resizable: false,
      backgroundColor: '#050006',
      frame: false,
      icon: path.join(__dirname, '../../assets/SurfaceClicker.png'),
      webPreferences: {
        preload: path.join(__dirname, '../preload/preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
  mainWindow.on('close', async (e) => {
    if (clicker.isRunning()) {
      e.preventDefault();
      const { response } = await dialog.showMessageBox(mainWindow, {
        type: 'warning',
        buttons: ['Cancel', 'Stop & Close'],
        defaultId: 0,
        cancelId: 0,
        title: 'Clicker is running',
        message: 'Surface Clicker is still running.',
        detail: 'Close anyway? This will stop the autoclicker.',
      });
      if (response === 1) {
        clicker.stop();
        overlay.destroyOverlay();
        mainWindow.destroy();
      }
      return;
    }
    overlay.destroyOverlay();
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && (input.key === 'F5' || (input.control && input.key.toLowerCase() === 'r'))) {
      event.preventDefault();
    }
  });

  // mainWindow.webContents.openDevTools(); 
}

function applyLoginItemSettings(enabled) {
  app.setLoginItemSettings({ openAtLogin: !!enabled, path: process.execPath });
}

function registerCurrentBinding() {
  const { activationKey } = store.getSettings();
  hotkeys.registerActivation(activationKey, {
    onDown: () => mainWindow?.webContents.send('hotkey:down'),
    onUp: () => mainWindow?.webContents.send('hotkey:up'),
  });
}

function registerRecordHotkeyBinding() {
  const { recordHotkey } = store.getSettings();
  hotkeys.registerBinding('__macroRecord__', recordHotkey, {
    onDown: () => mainWindow?.webContents.send('macro:recordHotkeyTriggered'),
  });
}

app.whenReady().then(() => {
  try { os.setPriority(process.pid, os.constants.priority.PRIORITY_BELOW_NORMAL); } catch (err) {}
  createWindow();
  registerCurrentBinding();
  registerRecordHotkeyBinding();
  edgeStop.init(() => {
    if (clicker.isRunning()) {
      clicker.stop((status) => {
        mainWindow?.webContents.send('clicker:status', status);
        overlay.getWindow()?.webContents.send('overlay:status', status);
      });
      mainWindow?.webContents.send('clicker:status', { running: false });
      overlay.getWindow()?.webContents.send('overlay:status', { running: false });
    }
  });
  registerAllMacroHotkeys();
  edgeStop.setEnabled(store.getSettings().edgeStop);
  applyLoginItemSettings(store.getSettings().launchOnStartup);
  appLock.setEnabled(store.getSettings().appLockEnabled);
  appLock.setTarget(store.getSettings().appLockTarget);
  if (store.getSettings().overlayEnabled) overlay.createOverlay();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  hotkeys.shutdown();
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  macro.stop();
  clicker.stop();
  hotkeys.shutdown();          
  const { shutdown: rawShutdown } = require('./rawInput');
  rawShutdown();             
  overlay.destroyOverlay();
});


ipcMain.handle('settings:get', () => store.getSettings());

ipcMain.handle('settings:set', (_event, partial) => {
  const updated = store.setSettings(partial);
  if (partial.launchOnStartup !== undefined) {
    applyLoginItemSettings(partial.launchOnStartup);
  }
  if (partial.edgeStop !== undefined) edgeStop.setEnabled(partial.edgeStop);
  if (partial.appLockEnabled !== undefined) appLock.setEnabled(partial.appLockEnabled);
  if (partial.appLockTarget !== undefined) appLock.setTarget(partial.appLockTarget);
  mainWindow?.webContents.send('settings:updated', updated);

  if (partial.cps !== undefined || partial.dutyCycle !== undefined || partial.theme !== undefined || partial.customAccent !== undefined || partial.performanceMode !== undefined) {
    overlay.getWindow()?.webContents.send('overlay:update', {
      cps: updated.cps, dutyCycle: updated.dutyCycle, theme: updated.theme, customAccent: updated.customAccent, performanceMode: updated.performanceMode,
    });
  }
  return updated;
});

ipcMain.handle('app:uninstall', async () => {
  if (!app.isPackaged) {
    return { success: false, cancelled: false, message: 'Uninstall only works in a packaged build, not dev mode.' };
  }

  const { response } = await dialog.showMessageBox(mainWindow, {
    type: 'warning',
    buttons: ['Cancel', 'Uninstall'],
    defaultId: 0,
    cancelId: 0,
    title: 'Uninstall Surface Clicker',
    message: 'Are you sure you want to uninstall Surface Clicker?',
    detail: process.platform === 'win32'
      ? 'This will open the Windows uninstaller.'
      : 'This will move the app to Trash and quit.',
  });

  if (response !== 1) return { success: false, cancelled: true };

  try {
    if (process.platform === 'win32') {
      const uninstallerPath = path.join(path.dirname(process.execPath), 'Uninstall Surface Clicker.exe');
      if (!fs.existsSync(uninstallerPath)) {
        return { success: false, cancelled: false, message: 'Uninstaller not found.' };
      }
      spawn(uninstallerPath, [], { detached: true, stdio: 'ignore' }).unref();
    } else if (process.platform === 'darwin') {
      const appPath = process.execPath.split('.app')[0] + '.app';
      const script = `sleep 1 && osascript -e 'tell application "Finder" to delete POSIX file "${appPath}"'`;
      spawn('/bin/sh', ['-c', script], { detached: true, stdio: 'ignore' }).unref();
    } else if (process.platform === 'linux') {
      const appImagePath = process.env.APPIMAGE;
      if (!appImagePath) {
        return { success: false, cancelled: false, message: 'Could not detect AppImage path.' };
      }
      spawn('/bin/sh', ['-c', `sleep 1 && rm -f "${appImagePath}"`], { detached: true, stdio: 'ignore' }).unref();
    }

    setTimeout(() => app.quit(), 300);
    return { success: true, cancelled: false };
  } catch (err) {
    console.error('Uninstall failed:', err);
    return { success: false, cancelled: false, message: err.message };
  }
});

ipcMain.handle('presets:list', () => store.getPresets());

ipcMain.handle('presets:save', (_event, preset) => store.savePreset(preset));

ipcMain.handle('presets:delete', (_event, id) => store.deletePreset(id));

let currentPlayingMacroId = null;

function playMacroById(id, { loop, speed, instant = false, instantStart = true, triggerBinding } = {}) {
  const found = store.getMacros().find((m) => m.id === id);
  if (!found) return false;
  currentPlayingMacroId = id;
  const binding = triggerBinding ?? found.hotkey ?? null;
  console.log('[macro] playing with triggerBinding:', JSON.stringify(binding));
  macro.play(found.events, { loop: loop ?? found.loop ?? 1, speed: speed ?? found.speed ?? 1, instant, instantStart, triggerBinding: binding }, () => {
    currentPlayingMacroId = null;
    mainWindow?.webContents.send('macro:playDone');
  });
  return true;
}

function stopMacroPlayback() {
  macro.stop();
  currentPlayingMacroId = null;
  mainWindow?.webContents.send('macro:playDone');
}

const macroCooldowns = {};

function registerMacroHotkey(m) {
  if (!m.hotkey) return;
  hotkeys.registerBinding(`macro:${m.id}`, m.hotkey, {
    onDown: () => {
      const now = Date.now();
      const last = macroCooldowns[m.id] || 0;
      if (now - last < 500) return; // ignore re-triggers within 500ms
      macroCooldowns[m.id] = now;
      if (macro.isPlaying() && currentPlayingMacroId === m.id) {
        stopMacroPlayback();
      } else if (!macro.isPlaying()) {
        playMacroById(m.id, { triggerBinding: m.hotkey });
      }
    },
  });
}

function registerAllMacroHotkeys() {
  store.getMacros().forEach((m) => registerMacroHotkey(m));
}

ipcMain.handle('macro:startRecord', (_event, triggerBinding) => {
  const { recordHotkey } = store.getSettings();
  macro.startRecording(triggerBinding, recordHotkey);
  return true;
});
ipcMain.handle('macro:stopRecord', () => {
  return macro.stopRecording();
});
ipcMain.handle('macro:list', () => store.getMacros());
ipcMain.handle('macro:save', (_event, m) => {
  const updated = store.saveMacro(m);
  const saved = updated[updated.length - 1];
  registerMacroHotkey(saved);
  return updated;
});
ipcMain.handle('macro:delete', (_event, id) => {
  hotkeys.unregisterBinding(`macro:${id}`);
  return store.deleteMacro(id);
});
ipcMain.handle('macro:play', (_event, { id, loop, speed, instant, instantStart }) => playMacroById(id, { loop, speed, instant, instantStart }));
ipcMain.handle('macro:stopPlay', () => { stopMacroPlayback(); return true; });

ipcMain.handle('macro:startRecordHotkeyCapture', () => {
  hotkeys.startCapture((binding) => {
    const withLabel = binding ? { ...binding, label: hotkeys.bindingLabel(binding) } : null;
    store.setSettings({ recordHotkey: withLabel });
    registerRecordHotkeyBinding();
    mainWindow?.webContents.send('macro:recordHotkeySet', withLabel);
  }, { excludeLeftClick: true });
  return true;
});
ipcMain.handle('macro:cancelRecordHotkeyCapture', () => { hotkeys.cancelCapture(); return true; });

ipcMain.handle('macro:captureNewHotkey', () => {
  hotkeys.startCapture((binding) => {
    mainWindow?.webContents.send('macro:newHotkeyCaptured', binding ? { ...binding, label: hotkeys.bindingLabel(binding) } : null);
  }, { excludeLeftClick: true });
  return true;
});
ipcMain.handle('macro:cancelNewHotkeyCapture', () => { hotkeys.cancelCapture(); return true; });

ipcMain.handle('macro:startHotkeyCapture', (_event, id) => {
  hotkeys.startCapture((binding) => {
    if (!binding) return;
    const withLabel = { ...binding, label: hotkeys.bindingLabel(binding) };
    store.setMacroHotkey(id, withLabel);
    registerMacroHotkey({ id, hotkey: withLabel });
    mainWindow?.webContents.send('macro:hotkeyCaptured', { id });
  }, { excludeLeftClick: true, excludeEscape: true });
  return true;
});
ipcMain.handle('macro:cancelHotkeyCapture', () => { hotkeys.cancelCapture(); return true; });


let currentSessionMeta = { mode: null, presetName: null };

ipcMain.handle('clicker:start', (_event, { cps, dutyCycle, clickButton, mode, presetName }) => {
  currentSessionMeta = { mode: mode || null, presetName: presetName || null };
  clicker.start({ cps, dutyCycle, clickButton }, (status) => {
    mainWindow?.webContents.send('clicker:status', status);
    overlay.getWindow()?.webContents.send('overlay:status', status);
  });
  mainWindow?.webContents.send('clicker:status', { running: true });
  overlay.getWindow()?.webContents.send('overlay:status', { running: true });
  return true;
});

ipcMain.handle('clicker:stop', () => {
  const session = clicker.stop((status) => {
    mainWindow?.webContents.send('clicker:status', status);
    overlay.getWindow()?.webContents.send('overlay:status', status);
  });
  const stats = store.recordSession({
    clicks: session.clicks,
    durationMs: session.durationMs,
    mode: currentSessionMeta.mode,
    presetName: currentSessionMeta.presetName,
  });
  mainWindow?.webContents.send('clicker:status', { running: false });
  overlay.getWindow()?.webContents.send('overlay:status', { running: false });
  mainWindow?.webContents.send('stats:updated', stats);
  return true;
});

ipcMain.handle('stats:get', () => store.getStats());
ipcMain.handle('clicker:sessionStats', () => clicker.getSessionStats());
ipcMain.handle('clicker:appSessionStats', () => ({
  clicks: clicker.getAppSessionClicks(),
  durationMs: Date.now() - appLaunchTime,
}));

ipcMain.handle('hotkey:startCapture', () => {
  hotkeys.startCapture((binding) => {
    if (!binding) return;
    store.setSettings({ activationKey: binding });
    registerCurrentBinding();
    mainWindow?.webContents.send('hotkey:captured', {
      ...binding,
      label: hotkeys.bindingLabel(binding),
    });
  });
  return true;
});

ipcMain.handle('hotkey:cancelCapture', () => {
  hotkeys.cancelCapture();
  return true;
});

ipcMain.handle('window:minimize', () => {
  mainWindow?.minimize();
  return true;
});

ipcMain.handle('window:close', () => {
  mainWindow?.close();
  return true;
});

ipcMain.handle('applock:listWindows', () => appLock.listOpenWindows()); 

ipcMain.handle('overlay:getState', () => {
  const s = store.getSettings();
  return { cps: s.cps, dutyCycle: s.dutyCycle, theme: s.theme, customAccent: s.customAccent, performanceMode: s.performanceMode };
});
ipcMain.handle('overlay:setCps', (_e, cps) => {
  const updated = store.setSettings({ cps });
  mainWindow?.webContents.send('settings:updated', updated);
  return updated;
});
ipcMain.handle('overlay:setDutyCycle', (_e, dutyCycle) => {
  const updated = store.setSettings({ dutyCycle });
  mainWindow?.webContents.send('settings:updated', updated);
  return updated;
});
ipcMain.handle('overlay:close', () => {
  store.setSettings({ overlayEnabled: false });
  overlay.destroyOverlay();
  mainWindow?.webContents.send('settings:updated', store.getSettings());
});
ipcMain.handle('overlay:toggle', (_e, enabled) => {
  store.setSettings({ overlayEnabled: enabled });
  enabled ? overlay.createOverlay() : overlay.destroyOverlay();
  return enabled;
});
ipcMain.handle('app:openExternal', (_e, url) => {
  const { shell } = require('electron');
  shell.openExternal(url);
});

ipcMain.handle('app:checkUpdate', async () => {
  try {
    const { net } = require('electron');
    const request = net.request('https://api.github.com/repos/deen942a/Surface-Clicker/releases/latest');
    return await new Promise((resolve) => {
      let data = '';
      request.on('response', (response) => {
        response.on('data', (chunk) => { data += chunk.toString(); });
        response.on('end', () => {
          try {
            const json = JSON.parse(data);
            const latest = json.tag_name?.replace(/^v/, '');
            const current = require('../../package.json').version;
            resolve({ latest, current, hasUpdate: latest !== current, url: json.html_url });
          } catch {
            resolve({ error: 'Failed to parse response' });
          }
        });
      });
      request.on('error', () => resolve({ error: 'Network error' }));
      request.end();
    });
  } catch {
    return { error: 'Update check failed' };
  }
});

ipcMain.handle('app:getVersion', () => app.getVersion());

ipcMain.handle('overlay:setAlwaysOnTop', (_e, val) => {  
  overlay.getWindow()?.setAlwaysOnTop(!!val, 'screen-saver');
  return val;
});
