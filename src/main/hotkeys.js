const {
  uIOhook,
  isAvailable,
  ensureStarted,
  KEY_NAME_BY_CODE,
  MOUSE_BUTTON_LABELS,
} = require('./rawInput');

const bindings = new Map();

let captureCallback = null;
let captureTimeout = null;
let captureExcludeLeftClick = false;

let listening = false;

const MODIFIER_KEYWORDS = ['Ctrl', 'Shift', 'Alt', 'Meta'];

function isModifierKey(keyName) {
  return MODIFIER_KEYWORDS.some((m) => keyName.includes(m));
}

function modsFromEvent(evt) {
  return {
    ctrl: !!evt.ctrlKey,
    shift: !!evt.shiftKey,
    alt: !!evt.altKey,
    meta: !!evt.metaKey,
  };
}

function modsLabel(mods) {
  if (!mods) return '';
  const parts = [];
  if (mods.ctrl) parts.push('Ctrl');
  if (mods.shift) parts.push('Shift');
  if (mods.alt) parts.push('Alt');
  if (mods.meta) parts.push('Meta');
  return parts.length ? parts.join('+') + '+' : '';
}

function bindingLabel(binding) {
  if (!binding) return null;
  const prefix = modsLabel(binding.modifiers);
  if (binding.type === 'keyboard') return prefix + binding.keyName;
  if (binding.type === 'mouse') {
    return prefix + (MOUSE_BUTTON_LABELS[binding.button] || `Mouse ${binding.button}`);
  }
  return null;
}

function modsMatch(a, b) {
  const A = a || { ctrl: false, shift: false, alt: false, meta: false };
  const B = b || { ctrl: false, shift: false, alt: false, meta: false };
  return A.ctrl === B.ctrl && A.shift === B.shift && A.alt === B.alt && A.meta === B.meta;
}

function bindingsMatch(a, b) {
  if (!a || !b || a.type !== b.type) return false;
  if (!modsMatch(a.modifiers, b.modifiers)) return false;
  if (a.type === 'keyboard') return a.keyName === b.keyName;
  if (a.type === 'mouse') return a.button === b.button;
  return false;
}

function finishCapture(binding) {
  const cb = captureCallback;
  captureCallback = null;
  captureExcludeLeftClick = false;
  if (captureTimeout) {
    clearTimeout(captureTimeout);
    captureTimeout = null;
  }
  cb?.(binding);
}

function handleKeyDown(evt) {
  const keyName = KEY_NAME_BY_CODE[evt.keycode] || `Key${evt.keycode}`;
  if (captureCallback) {
    if (isModifierKey(keyName)) return;
    finishCapture({ type: 'keyboard', keyName, modifiers: modsFromEvent(evt) });
    return;
  }
  const macro = require('./macro');
  if (macro.isPlaying()) return;
  const evtBinding = { type: 'keyboard', keyName, modifiers: modsFromEvent(evt) };
  for (const { binding, handlers } of bindings.values()) {
    if (bindingsMatch(binding, evtBinding)) handlers?.onDown?.();
  }
}

function handleKeyUp(evt) {
  if (captureCallback) return;
  const keyName = KEY_NAME_BY_CODE[evt.keycode] || `Key${evt.keycode}`;
  for (const { binding, handlers } of bindings.values()) {
    if (binding?.type === 'keyboard' && binding.keyName === keyName) handlers?.onUp?.();
  }
}

function handleMouseDown(evt) {
  // console.log('[hotkeys] mousedown button:', evt.button);
  if (captureCallback) {
    if (captureExcludeLeftClick && evt.button === 1) return;
    finishCapture({ type: 'mouse', button: evt.button, modifiers: modsFromEvent(evt) });
    return;
  }
  const macro = require('./macro');
  if (macro.isPlaying()) return;
  const evtBinding = { type: 'mouse', button: evt.button, modifiers: modsFromEvent(evt) };
  for (const { binding, handlers } of bindings.values()) {
    if (bindingsMatch(binding, evtBinding)) handlers?.onDown?.();
  }
}

function handleMouseUp(evt) {
  if (captureCallback) return;
  for (const { binding, handlers } of bindings.values()) {
    if (binding?.type === 'mouse' && binding.button === evt.button) handlers?.onUp?.();
  }
}

function ensureListening() {
  if (!isAvailable || listening) return;
  ensureStarted();
  uIOhook.on('keydown', handleKeyDown);
  uIOhook.on('keyup', handleKeyUp);
  uIOhook.on('mousedown', handleMouseDown);
  uIOhook.on('mouseup', handleMouseUp);
  listening = true;
}

const CLICKER_BINDING_ID = '__clicker__';

function registerActivation(binding, handlers) {
  return registerBinding(CLICKER_BINDING_ID, binding, handlers);
}

function registerBinding(id, binding, handlers) {
  ensureListening();
  if (binding) bindings.set(id, { binding, handlers });
  else bindings.delete(id);
  return isAvailable;
}

function unregisterBinding(id) {
  bindings.delete(id);
}

function unregisterAll() {
  bindings.clear();
}

function startCapture(onCaptured, { excludeLeftClick = false } = {}) {
  ensureListening();
  if (!isAvailable) {
    onCaptured?.(null);
    return;
  }
  captureCallback = onCaptured;
  captureExcludeLeftClick = excludeLeftClick;
  captureTimeout = setTimeout(() => {
    const cb = captureCallback;
    captureCallback = null;
    captureExcludeLeftClick = false;
    cb?.(null);
  }, 15000);
}

function cancelCapture() {
  captureCallback = null;
  captureExcludeLeftClick = false;
  if (captureTimeout) {
    clearTimeout(captureTimeout);
    captureTimeout = null;
  }
}

function shutdown() {
  unregisterAll();
  cancelCapture();
}

module.exports = {
  registerActivation,
  registerBinding,
  unregisterBinding,
  unregisterAll,
  startCapture,
  cancelCapture,
  bindingLabel,
  shutdown,
};