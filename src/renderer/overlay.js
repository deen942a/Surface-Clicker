const cps = document.getElementById('cps');
const dc = document.getElementById('dc');
const cpsVal = document.getElementById('cpsVal');
const dcVal = document.getElementById('dcVal');
const pinBtn = document.getElementById('pin');
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');

const THEME_NAMES = ['violet', 'cyber', 'sunset', 'toxic', 'ocean', 'vaporwave'];

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

function applyTheme(theme, customAccent) {
  THEME_NAMES.forEach((t) => document.body.classList.remove(`theme-${t}`));
  ['--accent', '--accent-rgb', '--accent-light', '--accent-lighter'].forEach((v) =>
    document.body.style.removeProperty(v)
  );
  if (customAccent) {
    document.body.style.setProperty('--accent', customAccent);
    document.body.style.setProperty('--accent-rgb', hexToRgb(customAccent));
    document.body.style.setProperty('--accent-light', shade(customAccent, 0.25));
    document.body.style.setProperty('--accent-lighter', shade(customAccent, 0.55));
  } else if (theme && theme !== 'violet') {
    document.body.classList.add(`theme-${theme}`);
  }
}

function applyPerfMode(performanceMode) {
  document.body.classList.toggle('perf-mode', !!performanceMode);
}

document.getElementById('close').addEventListener('click', () => window.overlayAPI.close());

cps.addEventListener('input', () => {
  cpsVal.innerHTML = fmt(cps.value) + '<span class="unit">/s</span>';
});
cps.addEventListener('change', () => window.overlayAPI.setCps(parseFloat(cps.value)));

dc.addEventListener('input', () => {
  dcVal.innerHTML = fmt(dc.value) + '<span class="unit">%</span>';
});
dc.addEventListener('change', () => window.overlayAPI.setDutyCycle(parseFloat(dc.value)));

let pinned = true;
pinBtn.classList.add('active');
pinBtn.addEventListener('click', () => {
  pinned = !pinned;
  pinBtn.classList.toggle('active', pinned);
  window.overlayAPI.setAlwaysOnTop(pinned);
});

function fmt(n) {
  n = parseFloat(n);
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

function makeValueEditable(valueEl, slider, { min, max }, onCommit) {
  valueEl.addEventListener('click', (e) => {
    e.stopPropagation();
    const startingValue = parseFloat(slider.value);
    const unit = valueEl.querySelector('.unit')?.textContent || '';

    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'row-val-input';
    input.value = startingValue;
    input.min = min;
    input.max = max;
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
      onCommit(n, unit);
    }

    input.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') input.blur();
      if (ev.key === 'Escape') commit(true);
    });
    input.addEventListener('blur', () => commit(false));
  });
}

makeValueEditable(cpsVal, cps, { min: 1, max: 100 }, (n) => {
  cps.value = n;
  cpsVal.innerHTML = fmt(n) + '<span class="unit">/s</span>';
  window.overlayAPI.setCps(n);
});

makeValueEditable(dcVal, dc, { min: 1, max: 1000 }, (n) => {
  dc.value = n;
  dcVal.innerHTML = fmt(n) + '<span class="unit">%</span>';
  window.overlayAPI.setDutyCycle(n);
});

window.overlayAPI.onUpdate(({ cps: c, dutyCycle: d, theme, customAccent, performanceMode }) => {
  cps.value = c; dc.value = d;
  cpsVal.innerHTML = fmt(c) + '<span class="unit">/s</span>';
  dcVal.innerHTML = fmt(d) + '<span class="unit">%</span>';
  applyTheme(theme, customAccent);
  applyPerfMode(performanceMode);
});

window.overlayAPI.onStatus(({ running }) => {
  statusDot.classList.toggle('running', running);
  statusText.textContent = running ? 'running' : 'idle';
});

(async () => {
  const s = await window.overlayAPI.getState();
  cps.value = Math.min(100, s.cps); dc.value = s.dutyCycle;
  cpsVal.innerHTML = fmt(cps.value) + '<span class="unit">/s</span>';
  dcVal.innerHTML = fmt(s.dutyCycle) + '<span class="unit">%</span>';
  applyTheme(s.theme, s.customAccent);
  applyPerfMode(s.performanceMode);
})();