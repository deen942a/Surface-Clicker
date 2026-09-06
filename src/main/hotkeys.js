const {
  uIOhook,
  isAvailable,
  ensureStarted,
  KEY_NAME_BY_CODE,
  MOUSE_BUTTON_LABELS,
} = require('./rawInput');

let activeBinding = null;
let activeHandlers = null;

let captureCallback = null;
let captureTimeout = null;

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
  if (bindingsMatch(activeBinding, { type: 'keyboard', keyName, modifiers: modsFromEvent(evt) })) {
    activeHandlers?.onDown?.();
  }
}

function handleKeyUp(evt) {
  const keyName = KEY_NAME_BY_CODE[evt.keycode] || `Key${evt.keycode}`;
  if (
    activeBinding?.type === 'keyboard' &&
    activeBinding.keyName === keyName &&
    !captureCallback
  ) {
    activeHandlers?.onUp?.();
  }
}

function handleMouseDown(evt) {
  if (captureCallback) {
    finishCapture({ type: 'mouse', button: evt.button, modifiers: modsFromEvent(evt) });
    return;
  }
  if (bindingsMatch(activeBinding, { type: 'mouse', button: evt.button, modifiers: modsFromEvent(evt) })) {
    activeHandlers?.onDown?.();
  }
}

function handleMouseUp(evt) {
  // Guard type too — avoids phantom onUp when capture just consumed a mousedown
  if (
    activeBinding?.type === 'mouse' &&
    activeBinding.button === evt.button &&
    !captureCallback
  ) {
    activeHandlers?.onUp?.();
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

function registerActivation(binding, handlers) {
  ensureListening();
  activeBinding = binding || null;
  activeHandlers = handlers || null;
  return isAvailable;
}

function unregisterAll() {
  activeBinding = null;
  activeHandlers = null;
}

function startCapture(onCaptured) {
  ensureListening();
  if (!isAvailable) {
    onCaptured?.(null);
    return;
  }
  captureCallback = onCaptured;
  captureTimeout = setTimeout(() => {
    captureCallback = null;
  }, 15000);
}

function cancelCapture() {
  captureCallback = null;
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
  unregisterAll,
  startCapture,
  cancelCapture,
  bindingLabel,
  shutdown,
};