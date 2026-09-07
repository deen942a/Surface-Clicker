const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('surfaceClicker', {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (partial) => ipcRenderer.invoke('settings:set', partial),
  uninstallApp: () => ipcRenderer.invoke('app:uninstall'),

  listPresets: () => ipcRenderer.invoke('presets:list'),
  savePreset: (preset) => ipcRenderer.invoke('presets:save', preset),
  deletePreset: (id) => ipcRenderer.invoke('presets:delete', id),

  getStats: () => ipcRenderer.invoke('stats:get'),
  getSessionStats: () => ipcRenderer.invoke('clicker:sessionStats'),
  getAppSessionStats: () => ipcRenderer.invoke('clicker:appSessionStats'),
  onStatsUpdated: (callback) => {
    ipcRenderer.on('stats:updated', (_event, stats) => callback(stats));
  },

  startClicking: (params) => ipcRenderer.invoke('clicker:start', params),
  stopClicking: () => ipcRenderer.invoke('clicker:stop'),
  onStatus: (callback) => {
    ipcRenderer.on('clicker:status', (_event, status) => callback(status));
  },

  startHotkeyCapture: () => ipcRenderer.invoke('hotkey:startCapture'),
  cancelHotkeyCapture: () => ipcRenderer.invoke('hotkey:cancelCapture'),
  onHotkeyCaptured: (callback) => {
    ipcRenderer.on('hotkey:captured', (_event, binding) => callback(binding));
  },
  onHotkeyDown: (callback) => {
    ipcRenderer.on('hotkey:down', () => callback());
  },
  onHotkeyUp: (callback) => {
    ipcRenderer.on('hotkey:up', () => callback());
  },

  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),

  onSettingsUpdated: (callback) => {
    ipcRenderer.on('settings:updated', (_event, settings) => callback(settings));
  },

  getCurrentWindowTitle: () => ipcRenderer.invoke('applock:getCurrentTitle'),
  listOpenWindows: () => ipcRenderer.invoke('applock:listWindows'),

  toggleOverlay: (enabled) => ipcRenderer.invoke('overlay:toggle', enabled),
  checkUpdate: () => ipcRenderer.invoke('app:checkUpdate'),
  openExternal: (url) => ipcRenderer.invoke('app:openExternal', url),
  getVersion: () => ipcRenderer.invoke('app:getVersion'),

  macroStartRecord: () => ipcRenderer.invoke('macro:startRecord'),
  macroStopRecord: () => ipcRenderer.invoke('macro:stopRecord'),
  macroList: () => ipcRenderer.invoke('macro:list'),
  macroSave: (m) => ipcRenderer.invoke('macro:save', m),
  macroDelete: (id) => ipcRenderer.invoke('macro:delete', id),
  macroPlay: (opts) => ipcRenderer.invoke('macro:play', opts),
  macroStopPlay: () => ipcRenderer.invoke('macro:stopPlay'),
  onMacroPlayDone: (callback) => { ipcRenderer.on('macro:playDone', () => callback()); },

  macroStartHotkeyCapture: (id) => ipcRenderer.invoke('macro:startHotkeyCapture', id),
  macroCancelHotkeyCapture: () => ipcRenderer.invoke('macro:cancelHotkeyCapture'),
  onMacroHotkeyCaptured: (callback) => { ipcRenderer.on('macro:hotkeyCaptured', (_e, data) => callback(data)); },

  macroCaptureNewHotkey: () => ipcRenderer.invoke('macro:captureNewHotkey'),
  macroSetRecordHotkey: () => ipcRenderer.invoke('macro:startRecordHotkeyCapture'),
  macroCancelRecordHotkeyCapture: () => ipcRenderer.invoke('macro:cancelRecordHotkeyCapture'),
  onMacroRecordHotkeySet: (callback) => ipcRenderer.on('macro:recordHotkeySet', (_e, binding) => callback(binding)),
  onMacroRecordHotkeyTriggered: (callback) => ipcRenderer.on('macro:recordHotkeyTriggered', () => callback()),
  macroCancelNewHotkeyCapture: () => ipcRenderer.invoke('macro:cancelNewHotkeyCapture'),
  onNewMacroHotkeyCaptured: (callback) => { ipcRenderer.on('macro:newHotkeyCaptured', (_e, binding) => callback(binding)); },
  }
);