const cpsSlider = document.getElementById('cps-slider');
const cpsValue = document.getElementById('cps-value');
const cdcSlider = document.getElementById('cdc-slider');
const cdcValue = document.getElementById('cdc-value');

const modeOptions = document.querySelectorAll('.mode-option[data-mode]');
const buttonOptions = document.querySelectorAll('#button-toggle .mode-option');

const keyField = document.getElementById('key-field');
const setKeyBtn = document.getElementById('set-key-btn');

const startBtn = document.getElementById('start-btn');
const startBtnLabel = document.getElementById('start-btn-label');
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');

const minimizeBtn = document.getElementById('minimize-btn');
const closeBtn = document.getElementById('close-btn');

const presetList = document.getElementById('preset-list');
const presetEmpty = document.getElementById('preset-empty');
const presetNameInput = document.getElementById('preset-name');
const savePresetBtn = document.getElementById('save-preset-btn');

const navItems = document.querySelectorAll('.nav-item');
const pages = document.querySelectorAll('.page');

const themeSwatches = document.querySelectorAll('.theme-swatch');
const startupToggle = document.getElementById('startup-toggle');
const uninstallBtn = document.getElementById('uninstall-btn');

const THEME_NAMES = ['violet', 'cyber', 'sunset', 'toxic', 'ocean', 'vaporwave']; 

const customPreview = document.getElementById('custom-preview');
const customHexInput = document.getElementById('custom-hex');
const colorPopover = document.getElementById('color-popover');
const svCanvas = document.getElementById('sv-canvas');
const svCursor = document.getElementById('sv-cursor');
const svCtx = svCanvas.getContext('2d');
const hueWrap = document.getElementById('hue-wrap');
const hueThumb = document.getElementById('hue-thumb');
const statsToggle = document.getElementById('stats-toggle');
const soundToggle = document.getElementById('sound-toggle');
soundToggle.addEventListener('change', () => {
  state.soundEnabled = soundToggle.checked;
  persistSettings();
});

if (statsToggle) statsToggle.addEventListener('change', () => {
  state.statsEnabled = statsToggle.checked;
  persistSettings();
  if (state.statsEnabled) {
    startSessionPolling();
  } else {
    stopSessionPolling();
  }
});

let audioCtx = null;
function beep(freq, duration, gain = 0.08) {
  if (state.soundEnabled === false) return;
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  g.gain.value = gain;
  osc.connect(g);
  g.connect(audioCtx.destination);
  osc.start();
  g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
  osc.stop(audioCtx.currentTime + duration);
}

const startupSoundToggle = document.getElementById('startup-sound-toggle');
startupSoundToggle.addEventListener('change', () => {
  state.startupSoundEnabled = startupSoundToggle.checked;
  persistSettings();
});

let hsv = { h: 271, s: 0.66, v: 0.97 }; 

function isValidHex(v) { return /^#([0-9a-f]{6})$/i.test(v); }

function hsvToRgb(h, s, v) {
  const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
  let r=0,g=0,b=0;
  if (h < 60) [r,g,b] = [c,x,0];
  else if (h < 120) [r,g,b] = [x,c,0];
  else if (h < 180) [r,g,b] = [0,c,x];
  else if (h < 240) [r,g,b] = [0,x,c];
  else if (h < 300) [r,g,b] = [x,0,c];
  else [r,g,b] = [c,0,x];
  return [Math.round((r+m)*255), Math.round((g+m)*255), Math.round((b+m)*255)];
}
function rgbToHex(r,g,b) {
  return '#' + [r,g,b].map(n => n.toString(16).padStart(2,'0')).join('');
}
function hexToHsv(hex) {
  const f = parseInt(hex.slice(1), 16);
  const r = (f>>16)/255, g = ((f>>8)&0xff)/255, b = (f&0xff)/255;
  const max = Math.max(r,g,b), min = Math.min(r,g,b), d = max-min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = 60 * (((g-b)/d) % 6);
    else if (max === g) h = 60 * ((b-r)/d + 2);
    else h = 60 * ((r-g)/d + 4);
  }
  if (h < 0) h += 360;
  return { h, s: max === 0 ? 0 : d/max, v: max };
}

function drawSV() {
  const [r,g,b] = hsvToRgb(hsv.h, 1, 1);
  const w = svCanvas.width, h = svCanvas.height;
  svCtx.fillStyle = `rgb(${r},${g},${b})`;
  svCtx.fillRect(0,0,w,h);
  const satGrad = svCtx.createLinearGradient(0,0,w,0);
  satGrad.addColorStop(0, 'rgba(255,255,255,1)');
  satGrad.addColorStop(1, 'rgba(255,255,255,0)');
  svCtx.fillStyle = satGrad;
  svCtx.fillRect(0,0,w,h);
  const valGrad = svCtx.createLinearGradient(0,0,0,h);
  valGrad.addColorStop(0, 'rgba(0,0,0,0)');
  valGrad.addColorStop(1, 'rgba(0,0,0,1)');
  svCtx.fillStyle = valGrad;
  svCtx.fillRect(0,0,w,h);
}

function updateCursors() {
  svCursor.style.left = (hsv.s * 100) + '%';
  svCursor.style.top = ((1 - hsv.v) * 100) + '%';
  hueThumb.style.left = (hsv.h / 360 * 100) + '%';
}

function currentHex() {
  const [r,g,b] = hsvToRgb(hsv.h, hsv.s, hsv.v);
  return rgbToHex(r,g,b);
}

function applyLive() {
  const hex = currentHex();
  customPreview.style.background = hex;
  customHexInput.value = hex;
  customHexInput.classList.remove('invalid');
  applyCustomAccent(hex);
}

function commitCustomAccent() {
  const hex = currentHex();
  state.customAccent = hex;
  persistSettings();
}

drawSV();
updateCursors();

let justInteracted = false;

customPreview.addEventListener('click', (e) => {
  e.stopPropagation();
  colorPopover.classList.toggle('open');
});
document.addEventListener('click', (e) => {
  if (justInteracted) return;
  if (!e.target.closest('.custom-color-card')) colorPopover.classList.remove('open');
});

function svPointerHandler(e) {
  const rect = svCanvas.getBoundingClientRect();
  const x = Math.min(Math.max(e.clientX - rect.left, 0), rect.width);
  const y = Math.min(Math.max(e.clientY - rect.top, 0), rect.height);
  hsv.s = x / rect.width;
  hsv.v = 1 - y / rect.height;
  updateCursors();
  applyLive();
}
let draggingSV = false;
document.getElementById('sv-wrap').addEventListener('mousedown', (e) => {
  draggingSV = true;
  justInteracted = true;
  svPointerHandler(e);
});
window.addEventListener('mousemove', (e) => { if (draggingSV) svPointerHandler(e); });
window.addEventListener('mouseup', () => {
  if (draggingSV) { draggingSV = false; commitCustomAccent(); }
  setTimeout(() => { justInteracted = false; }, 0);
});

function huePointerHandler(e) {
  const rect = hueWrap.getBoundingClientRect();
  const x = Math.min(Math.max(e.clientX - rect.left, 0), rect.width);
  hsv.h = (x / rect.width) * 360;
  drawSV();
  updateCursors();
  applyLive();
}
let draggingHue = false;
hueWrap.addEventListener('mousedown', (e) => {
  draggingHue = true;
  justInteracted = true;
  huePointerHandler(e);
});
window.addEventListener('mousemove', (e) => { if (draggingHue) huePointerHandler(e); });
window.addEventListener('mouseup', () => {
  if (draggingHue) { draggingHue = false; commitCustomAccent(); }
  setTimeout(() => { justInteracted = false; }, 0);
});

customHexInput.addEventListener('input', () => {
  const v = customHexInput.value.trim();
  if (isValidHex(v)) {
    customHexInput.classList.remove('invalid');
    hsv = hexToHsv(v);
    drawSV(); updateCursors();
    customPreview.style.background = v;
    applyCustomAccent(v);
  } else {
    customHexInput.classList.add('invalid');
  }
});
customHexInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') customHexInput.blur(); });
customHexInput.addEventListener('blur', () => {
  const v = customHexInput.value.trim();
  if (isValidHex(v)) commitCustomAccent();
  else { customHexInput.value = state.customAccent || currentHex(); customHexInput.classList.remove('invalid'); }
});


const appLockToggle = document.getElementById('applock-toggle');

appLockToggle.addEventListener('change', () => {
  state.appLockEnabled = appLockToggle.checked;
  persistSettings();
});

const edgeStopToggle = document.getElementById('edgestop-toggle');
if (edgeStopToggle) {
  edgeStopToggle.addEventListener('change', () => {
    state.edgeStop = edgeStopToggle.checked;
    persistSettings();
  });
}

const overlayToggle = document.getElementById('overlay-toggle');
overlayToggle.addEventListener('change', () => {
  window.surfaceClicker.toggleOverlay(overlayToggle.checked);
});

const performanceToggle = document.getElementById('performance-toggle');
performanceToggle.addEventListener('change', () => {
  state.performanceMode = performanceToggle.checked;
  document.body.classList.toggle('perf-mode', state.performanceMode);
  persistSettings();
});

function shade(hex, pct) {
  const f = parseInt(hex.slice(1), 16);
  const t = pct < 0 ? 0 : 255;
  const p = Math.abs(pct);
  const R = f >> 16, G = (f >> 8) & 0xff, B = f & 0xff;
  return '#' + (0x1000000 +
    (Math.round((t - R) * p) + R) * 0x10000 +
    (Math.round((t - G) * p) + G) * 0x100 +
    (Math.round((t - B) * p) + B)
  ).toString(16).slice(1);
}

function hexToRgb(hex) {
  const f = parseInt(hex.slice(1), 16);
  return `${f >> 16}, ${(f >> 8) & 0xff}, ${f & 0xff}`;
}

function applyCustomAccent(hex) {
  const body = document.body;
  body.style.setProperty('--accent', hex);
  body.style.setProperty('--accent-rgb', hexToRgb(hex));
  body.style.setProperty('--accent-dark', shade(hex, -0.2));
  body.style.setProperty('--accent-dark-rgb', hexToRgb(shade(hex, -0.2)));
  body.style.setProperty('--accent-darker', shade(hex, -0.35));
  body.style.setProperty('--accent-light', shade(hex, 0.25));
  body.style.setProperty('--accent-lighter', shade(hex, 0.55));
}

function clearCustomAccent() {
  ['--accent','--accent-rgb','--accent-dark','--accent-dark-rgb','--accent-darker','--accent-light','--accent-lighter']
    .forEach((v) => document.body.style.removeProperty(v));
}

const statsEls = {
  sessionClicks: document.getElementById('stat-session-clicks'),
  sessionDuration: document.getElementById('stat-session-duration'),
  allTimeClicks: document.getElementById('stat-alltime-clicks'),
  totalTime: document.getElementById('stat-total-time'),
  startStopCount: document.getElementById('stat-start-stop-count'),
  mostPreset: document.getElementById('stat-most-preset'),
  longestSession: document.getElementById('stat-longest-session'),
  mostMode: document.getElementById('stat-most-mode'),
  streak: document.getElementById('stat-streak'),
};

function formatDuration(ms) {
  const totalSec = Math.floor((ms || 0) / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function topEntry(obj) {
  const entries = Object.entries(obj || {});
  if (!entries.length) return '—';
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][0];
}

function renderLifetimeStats(stats) {
  statsEls.allTimeClicks.textContent = stats.allTimeClicks.toLocaleString();
  statsEls.totalTime.textContent = formatDuration(stats.totalTimeRunning);
  statsEls.startStopCount.textContent = stats.startStopCount.toLocaleString();
  statsEls.mostPreset.textContent = topEntry(stats.presetUsage);
  statsEls.longestSession.textContent = formatDuration(stats.longestSession);
  statsEls.mostMode.textContent = topEntry(stats.modeUsage);
  statsEls.streak.textContent = `${stats.streak?.count || 0} day${stats.streak?.count === 1 ? '' : 's'}`;
}

let sessionPollInterval = null;
async function pollSessionStats() {
  const s = await window.surfaceClicker.getAppSessionStats();
  statsEls.sessionClicks.textContent = s.clicks.toLocaleString();
  statsEls.sessionDuration.textContent = formatDuration(s.durationMs);
}
function startSessionPolling() {
  stopSessionPolling();
  if (state.statsEnabled === false) return;
  pollSessionStats();
  sessionPollInterval = setInterval(pollSessionStats, 1000);
}
function stopSessionPolling() {
  if (sessionPollInterval) {
    clearInterval(sessionPollInterval);
    sessionPollInterval = null;
  }
}

window.surfaceClicker.onStatsUpdated((stats) => {
  renderLifetimeStats(stats);
});


let state = {
  cps: 12.5,
  dutyCycle: 65,
  mode: 'toggle',
  clickButton: 'left',
  theme: 'violet',
  launchOnStartup: false,
  activationKey: { type: 'keyboard', keyName: 'F6', label: 'F6' },
  running: false,
  statsEnabled: true,
};

let listeningForKey = false;
let holdKeyDown = false;

function fmt(n) {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

function updateStatUI() {
  cpsSlider.value = state.cps;
  cpsValue.textContent = fmt(state.cps);
  cdcSlider.value = state.dutyCycle;
  cdcValue.textContent = fmt(state.dutyCycle);
}

function updateModeUI() {
  modeOptions.forEach((el) => {
    el.classList.toggle('active', el.dataset.mode === state.mode);
  });
}

function applyTheme(theme) {
  THEME_NAMES.forEach((t) => document.body.classList.remove(`theme-${t}`));
  if (theme && theme !== 'violet') {
    document.body.classList.add(`theme-${theme}`);
  }
}

let themeDebounce = null;
themeSwatches.forEach((el) => {
  el.addEventListener('click', () => {
    state.theme = el.dataset.theme;
    state.customAccent = null;
    clearCustomAccent();
    applyTheme(state.theme);
    clearTimeout(themeDebounce);
    themeDebounce = setTimeout(persistSettings, 150);
  });
});

  startupToggle.addEventListener('change', () => {
    state.launchOnStartup = startupToggle.checked;
    persistSettings();
  });

  document.getElementById('check-update-btn').addEventListener('click', async () => {
    const btn = document.getElementById('check-update-btn');
    const status = document.getElementById('update-status');
    btn.disabled = true;
    btn.textContent = 'Checking…';
    const result = await window.surfaceClicker.checkUpdate();
    btn.disabled = false;
    btn.textContent = 'Check';
    const downloadBtn = document.getElementById('download-update-btn');
    if (result.error) {
      status.textContent = `Error: ${result.error}`;
      downloadBtn.style.display = 'none';
    } else if (result.hasUpdate) {
      status.textContent = `Update available: v${result.latest} (you have v${result.current})`;
      downloadBtn.style.display = '';
      downloadBtn.onclick = () => window.surfaceClicker.openExternal(result.url);
    } else {
      status.textContent = `You're up to date (v${result.current})`;
      downloadBtn.style.display = 'none';
    }
  });

  uninstallBtn.addEventListener('click', async () => {
    const result = await window.surfaceClicker.uninstallApp();
    if (!result.success && !result.cancelled && result.message) {
      alert(result.message);
    }
  });


function updateButtonUI() {
  buttonOptions.forEach((el) => {
    el.classList.toggle('active', el.dataset.button === state.clickButton);
  });
}

function updateKeyUI() {
  if (!listeningForKey) {
    const label = state.activationKey?.label;
    keyField.textContent = label || 'No key set';
    keyField.classList.toggle('set', !!label);
    keyField.classList.remove('listening');
  }
}

function updateRunningUI() {
  startBtnLabel.textContent = state.running ? 'Stop' : 'Start';
  startBtn.classList.toggle('running', state.running);
  statusDot.classList.toggle('running', state.running);
  statusText.textContent = state.running ? 'running' : 'idle';
  const icon = startBtn.querySelector('i');
  if (icon) {
    icon.className = state.running ? 'ti ti-player-stop' : 'ti ti-player-play';
  }
}

function renderPresets(presets) {
  presetList.querySelectorAll('.preset-item').forEach((el) => el.remove());

  if (!presets || presets.length === 0) {
    presetEmpty.style.display = 'flex';
    return;
  }
  presetEmpty.style.display = 'none';

  presets.forEach((preset) => {
    const item = document.createElement('div');
    item.className = 'preset-item';
    item.innerHTML = `
      <div class="preset-item-info">
        <div class="name">${escapeHtml(preset.name)}</div>
        <div class="details">${fmt(preset.cps)} cps · ${fmt(preset.dutyCycle)}% duty</div>
      </div>
      <div style="display:flex;align-items:center;gap:5px;flex-shrink:0;margin-left:10px;">
        <button class="preset-equip-btn" title="Load preset">Equip</button>
        <button class="preset-delete-btn" title="Delete preset">✕</button>
      </div>
    `;
    item.querySelector('.preset-equip-btn').addEventListener('click', () => {
      state.cps = preset.cps;
      state.dutyCycle = preset.dutyCycle;
      state.equippedPreset = preset.name;
      updateStatUI();
      persistSettings();
    });
    item.querySelector('.preset-delete-btn').addEventListener('click', async () => {
      const updated = await window.surfaceClicker.deletePreset(preset.id);
      renderPresets(updated);
    });
    presetList.appendChild(item);
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function persistSettings() {
  window.surfaceClicker.setSettings({
    cps: state.cps,
    dutyCycle: state.dutyCycle,
    mode: state.mode,
    clickButton: state.clickButton,
    activationKey: state.activationKey,
    theme: state.theme,
    customAccent: state.customAccent,
    launchOnStartup: state.launchOnStartup,
    appLockEnabled: state.appLockEnabled,
    appLockTarget: state.appLockTarget,
    overlayEnabled: state.overlayEnabled,
    soundEnabled: state.soundEnabled,
    statsEnabled: state.statsEnabled,
    performanceMode: state.performanceMode,
    startupSoundEnabled: state.startupSoundEnabled,
  });
}


navItems.forEach((item) => {
  item.addEventListener('click', () => {
    navItems.forEach((n) => n.classList.remove('active'));
    item.classList.add('active');

    const page = item.dataset.page;
    pages.forEach((p) => {
      p.style.display = p.dataset.page === page ? '' : 'none';
    });

    if (page === 'stats') {
      if (state.statsEnabled !== false && !state.performanceMode) {
        startSessionPolling();
      }
    } else {
      stopSessionPolling();
    }
  });
});


cpsSlider.addEventListener('input', () => {
  state.cps = parseFloat(cpsSlider.value);
  cpsValue.textContent = fmt(state.cps);
});
cpsSlider.addEventListener('change', persistSettings);

cdcSlider.addEventListener('input', () => {
  state.dutyCycle = parseFloat(cdcSlider.value);
  cdcValue.textContent = fmt(state.dutyCycle);
});
cdcSlider.addEventListener('change', persistSettings);


function makeValueEditable(valueEl, slider, { min, max, clampToSlider }, onCommit) {
  valueEl.addEventListener('click', () => {
    const startingValue = parseFloat(slider.value);

    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'stat-value-input';
    input.value = startingValue;
    input.min = clampToSlider ? slider.min : min;
    input.max = clampToSlider ? slider.max : max;
    input.step = slider.step || 'any';

    valueEl.replaceWith(input);
    input.focus();
    input.select();

    let settled = false;
    function commit(revert) {
      if (settled) return;
      settled = true;

      let n = revert ? startingValue : parseFloat(input.value);
      if (Number.isNaN(n)) n = startingValue;
      n = Math.min(max, Math.max(min, n));

      input.replaceWith(valueEl);
      onCommit(n);
    }

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') input.blur();
      if (e.key === 'Escape') commit(true);
    });
    input.addEventListener('blur', () => commit(false));
  });
}

makeValueEditable(
  cpsValue,
  cpsSlider,
  { min: 0.1, max: 1000, clampToSlider: false },
  (n) => {
    state.cps = n;
    slidersToState();
    persistSettings();
  }
);

makeValueEditable(
  cdcValue,
  cdcSlider,
  { min: 1, max: 1000, clampToSlider: false },
  (n) => {
    state.dutyCycle = n;
    slidersToState();
    persistSettings();
  }
);

function slidersToState() {
  cpsSlider.value = state.cps;
  cdcSlider.value = state.dutyCycle;
  cpsValue.textContent = fmt(state.cps);
  cdcValue.textContent = fmt(state.dutyCycle);
}



modeOptions.forEach((el) => {
  el.addEventListener('click', () => {
    state.mode = el.dataset.mode;
    updateModeUI();
    persistSettings();
  });
});



buttonOptions.forEach((el) => {
  el.addEventListener('click', () => {
    state.clickButton = el.dataset.button;
    updateButtonUI();
    persistSettings();
  });
});


setKeyBtn.addEventListener('click', async () => {
  listeningForKey = true;
  keyField.textContent = 'Press any key or button…';
  keyField.classList.add('listening');
  keyField.classList.remove('set');
  await window.surfaceClicker.startHotkeyCapture();
});

window.addEventListener('keydown', async (e) => {
  if (!listeningForKey) return;
  if (e.key === 'Escape') {
    e.preventDefault();
    await window.surfaceClicker.cancelHotkeyCapture();
    listeningForKey = false;
    updateKeyUI();
  }
});

window.surfaceClicker.onHotkeyCaptured((binding) => {
  state.activationKey = binding;
  listeningForKey = false;
  updateKeyUI();
});


async function startClicking() {
  if (state.running) return;
  await window.surfaceClicker.startClicking({
    cps: state.cps,
    dutyCycle: state.dutyCycle,
    clickButton: state.clickButton,
    mode: state.mode,
    presetName: state.equippedPreset || null,
  });
}

async function stopClicking() {
  if (!state.running) return;
  await window.surfaceClicker.stopClicking();
}

startBtn.addEventListener('click', async () => {
  if (state.running) {
    await stopClicking();
  } else {
    await startClicking();
  }
});


minimizeBtn.addEventListener('click', () => {
  console.log('minimize clicked');
  window.surfaceClicker.minimizeWindow();
});

closeBtn.addEventListener('click', () => {
  console.log('close clicked');
  window.surfaceClicker.closeWindow();
});


window.surfaceClicker.onStatus((status) => {
  const wasRunning = state.running;
  state.running = status.running;
  updateRunningUI();
  if (status.running && !wasRunning) beep(880, 0.12);
  if (!status.running && wasRunning) beep(440, 0.15);
});


window.surfaceClicker.onHotkeyDown(() => {
  if (state.mode === 'toggle') {
    if (state.running) {
      stopClicking();
    } else {
      startClicking();
    }
  } else if (state.mode === 'hold') {
    if (!state.running) {
      holdKeyDown = true;
      startClicking();
    }
  }
});

window.surfaceClicker.onHotkeyUp(() => {
  if (state.mode === 'hold') {
    holdKeyDown = false;
    if (state.running) {
      stopClicking();
    }
  }
});


savePresetBtn.addEventListener('click', async () => {
  const name = presetNameInput.value.trim();
  if (!name) {
    presetNameInput.focus();
    presetNameInput.style.borderColor = 'rgba(248,113,113,0.6)';
    setTimeout(() => {
      presetNameInput.style.borderColor = '';
    }, 1200);
    return;
  }
  const updated = await window.surfaceClicker.savePreset({
    name,
    cps: state.cps,
    dutyCycle: state.dutyCycle,
  });
  presetNameInput.value = '';
  renderPresets(updated);
});


async function init() {
  const settings = await window.surfaceClicker.getSettings();
  state = { ...state, ...settings, running: false };

  updateStatUI();
  updateModeUI();
  updateButtonUI();
  updateKeyUI();
  updateRunningUI();
  applyTheme(state.theme);
  startupToggle.checked = !!state.launchOnStartup;  

  if (state.customAccent) {
    customHexInput.value = state.customAccent;
    customPreview.style.background = state.customAccent;
    applyCustomAccent(state.customAccent);
  }

  if (edgeStopToggle) edgeStopToggle.checked = !!state.edgeStop;

  appLockToggle.checked = !!state.appLockEnabled;
  overlayToggle.checked = !!state.overlayEnabled;
  soundToggle.checked = state.soundEnabled !== false;
  startupSoundToggle.checked = state.startupSoundEnabled !== false;
  applockTrigger.textContent = state.appLockTarget || 'No app set';
  applockTrigger.classList.toggle('set', !!state.appLockTarget);
  await refreshOpenWindows();

  performanceToggle.checked = !!state.performanceMode;
  document.body.classList.toggle('perf-mode', !!state.performanceMode);
  statsToggle.checked = state.statsEnabled !== false;

  const presets = await window.surfaceClicker.listPresets();
  renderPresets(presets);

  const macros = await window.surfaceClicker.macroList();
  renderMacros(macros);
  if (state.recordHotkey) macroRecordHotkeyLabel.textContent = state.recordHotkey.label;

  const stats = await window.surfaceClicker.getStats();
  renderLifetimeStats(stats);

  pages.forEach((p) => {
    p.style.display = p.dataset.page === 'main' ? '' : 'none';
  });
  const ver = await window.surfaceClicker.getVersion();
  const verEl = document.getElementById('app-version');
  if (verEl) verEl.textContent = `v${ver}`;
}

let startupSoundPlayed = false;
function playStartupSound() {
  if (startupSoundPlayed || state.startupSoundEnabled === false) return;
  startupSoundPlayed = true;
  beep(660, 0.12);
  setTimeout(() => beep(880, 0.14), 100);
  document.removeEventListener('click', playStartupSound);
  document.removeEventListener('keydown', playStartupSound);
}
document.addEventListener('click', playStartupSound);
document.addEventListener('keydown', playStartupSound);

init();

window.surfaceClicker.onSettingsUpdated((settings) => {
  state.cps = settings.cps;
  state.dutyCycle = settings.dutyCycle;
  updateStatUI();

  if (settings.overlayEnabled !== undefined) {
    state.overlayEnabled = settings.overlayEnabled;
    overlayToggle.checked = settings.overlayEnabled;
  }
});

const applockTrigger = document.getElementById('applock-trigger');
const applockList = document.getElementById('applock-list');
const applockRefreshBtn = document.getElementById('applock-refresh-btn');

function selectAppLockTarget(title) {
  state.appLockTarget = title;
  applockTrigger.textContent = title || 'No app set';
  applockTrigger.classList.toggle('set', !!title);
  applockList.classList.remove('open');
  persistSettings();
}

async function refreshOpenWindows() {
  const titles = await window.surfaceClicker.listOpenWindows();
  applockList.innerHTML = '';

  const noneItem = document.createElement('div');
  noneItem.className = 'dropdown-item';
  noneItem.textContent = 'No app set';
  noneItem.addEventListener('click', () => selectAppLockTarget(''));
  applockList.appendChild(noneItem);

  titles.forEach((title) => {
    const item = document.createElement('div');
    item.className = 'dropdown-item';
    if (title === state.appLockTarget) item.classList.add('selected');
    item.textContent = title;
    item.addEventListener('click', () => selectAppLockTarget(title));
    applockList.appendChild(item);
  });
}

applockTrigger.addEventListener('click', () => {
  applockList.classList.toggle('open');
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('#applock-dropdown')) {
    applockList.classList.remove('open');
  }
});

applockRefreshBtn.addEventListener('click', refreshOpenWindows);

const macroSetHotkeyBtn = document.getElementById('macro-set-hotkey-btn');
const macroHotkeyLabel = document.getElementById('macro-hotkey-label');
const macroRecordBtn = document.getElementById('macro-record-btn');
const macroRecordLabel = document.getElementById('macro-record-label');
const macroList = document.getElementById('macro-list');
const macroEmpty = document.getElementById('macro-empty');
const macroSaveRow = document.getElementById('macro-save-row');
const macroNameInput = document.getElementById('macro-name');
const macroSaveBtn = document.getElementById('macro-save-btn');
const macroDiscardBtn = document.getElementById('macro-discard-btn');
const macroLoopInput = document.getElementById('macro-loop');
const macroSpeedSlider = document.getElementById('macro-speed');
const macroSpeedVal = document.getElementById('macro-speed-val');

let isRecordingMacro = false;
let pendingMacroEvents = null;
let pendingMacroHotkey = null;

macroSpeedSlider.addEventListener('input', () => {
  macroSpeedVal.textContent = parseFloat(macroSpeedSlider.value) + 'x';
});

function resetHotkeyStep() {
  pendingMacroHotkey = null;
  macroHotkeyLabel.textContent = 'Set Hotkey';
}

macroSetHotkeyBtn.addEventListener('click', async () => {
  macroHotkeyLabel.textContent = 'Press key/button…';
  await window.surfaceClicker.macroCaptureNewHotkey();
});

window.surfaceClicker.onNewMacroHotkeyCaptured((binding) => {
  if (!binding) {
    macroHotkeyLabel.textContent = 'Set Hotkey';
    return;
  }
  pendingMacroHotkey = binding;
  macroHotkeyLabel.textContent = binding.label;
});

async function toggleRecording() {
  if (!isRecordingMacro) {
    isRecordingMacro = true;
    macroRecordLabel.textContent = 'Stop';
    macroRecordBtn.classList.add('running');
    macroSaveRow.style.display = 'none';
    await window.surfaceClicker.macroStartRecord(pendingMacroHotkey, pendingMacroHotkey);
  } else {
    isRecordingMacro = false;
    macroRecordLabel.textContent = 'Record';
    macroRecordBtn.classList.remove('running');
    pendingMacroEvents = await window.surfaceClicker.macroStopRecord(pendingMacroHotkey);
    macroSaveRow.style.display = 'flex';
    macroNameInput.focus();
  }
}

macroRecordBtn.addEventListener('click', toggleRecording);

const macroSetRecordHotkeyBtn = document.getElementById('macro-set-record-hotkey-btn');
const macroRecordHotkeyLabel = document.getElementById('macro-record-hotkey-label');

macroSetRecordHotkeyBtn.addEventListener('click', async () => {
  macroRecordHotkeyLabel.textContent = 'Press key/button…';
  await window.surfaceClicker.macroSetRecordHotkey();
});

window.surfaceClicker.onMacroRecordHotkeySet((binding) => {
  macroRecordHotkeyLabel.textContent = binding ? binding.label : 'Record Hotkey';
});

window.surfaceClicker.onMacroRecordHotkeyTriggered(toggleRecording);

macroDiscardBtn.addEventListener('click', () => {
  pendingMacroEvents = null;
  macroNameInput.value = '';
  macroSaveRow.style.display = 'none';
  resetHotkeyStep();
});

macroSaveBtn.addEventListener('click', async () => {
  const name = macroNameInput.value.trim();
  if (!name || !pendingMacroEvents) { macroNameInput.focus(); return; }
  const loop = parseInt(macroLoopInput.value, 10) || 0;
  const speed = parseFloat(macroSpeedSlider.value) || 1;
  const updated = await window.surfaceClicker.macroSave({
    name, events: pendingMacroEvents, loop, speed, hotkey: pendingMacroHotkey,
  });
  pendingMacroEvents = null;
  macroNameInput.value = '';
  macroSaveRow.style.display = 'none';
  resetHotkeyStep();
  renderMacros(updated);
});

function renderMacros(macros) {
  macroList.querySelectorAll('.preset-item').forEach((el) => el.remove());
  if (!macros || macros.length === 0) { macroEmpty.style.display = 'flex'; return; }
  macroEmpty.style.display = 'none';

  macros.forEach((macro) => {
    const durationMs = macro.events.length ? macro.events[macro.events.length - 1].t : 0;
    const actionCount = Math.max(0, macro.events.length - 1);
    const item = document.createElement('div');
    item.className = 'preset-item';
    item.innerHTML = `
      <div class="preset-item-info">
        <div class="name">${escapeHtml(macro.name)}</div>
        <div class="details">${actionCount} events · ${(durationMs / 1000).toFixed(1)}s</div>
      </div>
      <div style="display:flex;align-items:center;gap:5px;flex-shrink:0;margin-left:10px;">
        <button class="preset-equip-btn macro-hotkey-btn" title="Set hotkey (any key, or mouse button other than left-click)" style="width:auto;min-width:60px;padding:0 8px;">${escapeHtml(macro.hotkey?.label || 'Hotkey')}</button>
        <button class="preset-equip-btn macro-play-btn" title="Play macro">Play</button>
        <button class="preset-delete-btn" title="Delete macro">✕</button>
      </div>
    `;
    const hotkeyBtn = item.querySelector('.macro-hotkey-btn');
    hotkeyBtn.addEventListener('click', async () => {
      hotkeyBtn.textContent = 'Press...';
      await window.surfaceClicker.macroStartHotkeyCapture(macro.id);
    });
    const playBtn = item.querySelector('.macro-play-btn');
    playBtn.addEventListener('click', async () => {
      if (playBtn.textContent === 'Stop') {
        await window.surfaceClicker.macroStopPlay();
        playBtn.textContent = 'Play';
        return;
      }
      const loop = parseInt(macroLoopInput.value, 10) || 0;
      const speed = parseFloat(macroSpeedSlider.value) || 1;
      const instant = document.getElementById('macro-instant')?.checked || false;
      const instantStart = document.getElementById('macro-instant-start')?.checked || false;
      playBtn.textContent = 'Stop';
      await window.surfaceClicker.macroPlay({ id: macro.id, loop, speed, instant, instantStart });
    });
    item.querySelector('.preset-delete-btn').addEventListener('click', async () => {
      const updated = await window.surfaceClicker.macroDelete(macro.id);
      renderMacros(updated);
    });
    macroList.appendChild(item);
  });
}

window.surfaceClicker.onMacroPlayDone(() => {
  document.querySelectorAll('.macro-play-btn').forEach((b) => { b.textContent = 'Play'; });
});

window.surfaceClicker.onMacroHotkeyCaptured(async () => {
  const macros = await window.surfaceClicker.macroList();
  renderMacros(macros);
});
