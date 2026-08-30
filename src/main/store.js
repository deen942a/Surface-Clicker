const Store = require('electron-store');

const store = new Store({
  defaults: {
    settings: {
      cps: 12.5,
      dutyCycle: 65,
      activationKey: { type: 'keyboard', keyName: 'F6' },
      mode: 'toggle',
      clickButton: 'left',
      theme: 'violet',
      customAccent: null, 
      launchOnStartup: false,
      launchOnStartup: false,
      edgeStop: false,
      appLockEnabled: false,
      appLockTarget: '',
      overlayEnabled: false,
      performanceMode: false,
      soundEnabled: true,
      startupSoundEnabled: true,
      statsEnabled: true,
    },
    presets: [],
    stats: {
      allTimeClicks: 0,
      totalTimeRunning: 0,
      startStopCount: 0,
      longestSession: 0,
      presetUsage: {},
      modeUsage: { toggle: 0, hold: 0 },
      streak: { count: 0, lastDate: null },
    },
  },
});
function getSettings() {
  return store.get('settings');
}

function setSettings(partial) {
  const current = store.get('settings');
  const updated = { ...current, ...partial };
  store.set('settings', updated);
  return updated;
}

function getPresets() {
  return store.get('presets');
}

function savePreset({ name, cps, dutyCycle }) {
  const presets = store.get('presets');
  const preset = {
    id: Date.now().toString(36),
    name: name?.trim() || 'untitled',
    cps,
    dutyCycle,
  };
  const updated = [...presets, preset];
  store.set('presets', updated);
  return updated;
}

function deletePreset(id) {
  const presets = store.get('presets');
  const updated = presets.filter((p) => p.id !== id);
  store.set('presets', updated);
  return updated;
}

function getStats() {
  return store.get('stats');
}

function recordSession({ clicks, durationMs, mode, presetName }) {
  const stats = store.get('stats');

  stats.allTimeClicks += clicks || 0;
  stats.totalTimeRunning += durationMs || 0;
  stats.startStopCount += 1;
  stats.longestSession = Math.max(stats.longestSession, durationMs || 0);

  if (mode) stats.modeUsage[mode] = (stats.modeUsage[mode] || 0) + 1;
  if (presetName) stats.presetUsage[presetName] = (stats.presetUsage[presetName] || 0) + 1;

  const today = new Date().toISOString().slice(0, 10);
  if (stats.streak.lastDate !== today) {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    stats.streak.count = stats.streak.lastDate === yesterday ? stats.streak.count + 1 : 1;
    stats.streak.lastDate = today;
  }

  store.set('stats', stats);
  return stats;
}

module.exports = { getSettings, setSettings, getPresets, savePreset, deletePreset, getStats, recordSession };
