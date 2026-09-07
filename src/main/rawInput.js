
let uIOhook;
let UiohookKey;
try {
  ({ uIOhook, UiohookKey } = require('uiohook-napi'));
} catch (err) {
  console.warn(
    'Could not load uiohook-napi. Run `npm install` first. ' +
      'Global hotkeys / side-button support will be a no-op until then.'
  );
}

let started = false;

function ensureStarted() {
  if (!uIOhook || started) return;
  try {
    uIOhook.start();
    started = true;
  } catch (err) {
    console.error('Failed to start uiohook:', err);
  }
}

function shutdown() {
  if (!uIOhook || !started) return;
  try {
    uIOhook.removeAllListeners();
    // Give the event loop one tick to drain before stopping the native thread
    setImmediate(() => {
      try { uIOhook.stop(); } catch (err) { /* ignore */ }
    });
  } catch (err) {
    console.error('Failed to stop uiohook:', err);
  }
  started = false;
}

const KEY_NAME_BY_CODE = {};
if (UiohookKey) {
  for (const [name, code] of Object.entries(UiohookKey)) {
    if (!(code in KEY_NAME_BY_CODE)) {
      KEY_NAME_BY_CODE[code] = name;
    }
  }
}

const MOUSE_BUTTON_LABELS = {
  1: 'Mouse Left',
  2: 'Mouse Right',
  3: 'Mouse Middle',
  4: 'XButton1',
  5: 'XButton2',
};

module.exports = {
  uIOhook,
  UiohookKey,
  isAvailable: !!uIOhook,
  ensureStarted,
  shutdown,
  KEY_NAME_BY_CODE,
  MOUSE_BUTTON_LABELS,
};