const { uIOhook, isAvailable, ensureStarted, KEY_NAME_BY_CODE } = require('./rawInput');
const { performance } = require('perf_hooks');

let mouse, keyboard, Button, Key, Point;
try {
  ({ mouse, keyboard, Button, Key, Point } = require('@nut-tree-fork/nut-js'));
  mouse.config.autoDelayMs = 0;
} catch (err) {
  console.warn('Could not load nut-js for macro playback');
}

let recording = false;
let recordStart = 0;
let events = [];
let listenersAttached = false;

const MOVE_INTERVAL_MS = 16; // throttle mousemove to ~60fps to keep files small
let lastMoveRecorded = 0;

function attachListeners() {
  if (listenersAttached || !isAvailable) return;
  ensureStarted();
  uIOhook.on('mousemove', (e) => {
    if (!recording) return;
    const now = performance.now();
    if (now - lastMoveRecorded < MOVE_INTERVAL_MS) return;
    lastMoveRecorded = now;
    events.push({ t: now - recordStart, type: 'move', x: e.x, y: e.y });
  });
  uIOhook.on('mousedown', (e) => {
    if (recording) events.push({ t: performance.now() - recordStart, type: 'mousedown', button: e.button });
  });
  uIOhook.on('mouseup', (e) => {
    if (recording) events.push({ t: performance.now() - recordStart, type: 'mouseup', button: e.button });
  });
  uIOhook.on('keydown', (e) => {
    if (recording) events.push({ t: performance.now() - recordStart, type: 'keydown', keyName: KEY_NAME_BY_CODE[e.keycode] });
  });
  uIOhook.on('keyup', (e) => {
    if (recording) events.push({ t: performance.now() - recordStart, type: 'keyup', keyName: KEY_NAME_BY_CODE[e.keycode] });
  });
  listenersAttached = true;
}

function startRecording() {
  attachListeners();
  events = [];
  recordStart = performance.now();
  lastMoveRecorded = 0;
  recording = true;
}

function stopRecording() {
  recording = false;
  return events;
}

const MOUSE_BTN_MAP = { 1: () => Button.LEFT, 2: () => Button.RIGHT, 3: () => Button.MIDDLE };

// Best-effort uiohook keyName -> nut-js Key resolution. Reliable for letters/
// digits/F-keys; special keys fall back to a small alias table and otherwise
// are skipped (with a console warning) rather than throwing.
const KEY_ALIASES = {
  Escape: 'Escape', Space: 'Space', Backspace: 'Backspace', Tab: 'Tab',
  Return: 'Return', Enter: 'Return', Shift: 'LeftShift', ShiftRight: 'RightShift',
  Ctrl: 'LeftControl', CtrlRight: 'RightControl', Alt: 'LeftAlt', AltRight: 'RightAlt',
  ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right',
};

function resolveNutKey(keyName) {
  if (!keyName || !Key) return null;
  if (Key[keyName] !== undefined) return Key[keyName];
  const alias = KEY_ALIASES[keyName];
  if (alias && Key[alias] !== undefined) return Key[alias];
  return null;
}

let playing = false;
let playToken = 0;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function playOnce(macroEvents, token) {
  let last = 0;
  for (const ev of macroEvents) {
    if (token !== playToken) return false;
    const wait = ev.t - last;
    if (wait > 0) await sleep(wait);
    last = ev.t;
    if (token !== playToken) return false;

    try {
      if (ev.type === 'move' && mouse && Point) {
        await mouse.setPosition(new Point(ev.x, ev.y));
      } else if (ev.type === 'mousedown' && mouse) {
        await mouse.pressButton((MOUSE_BTN_MAP[ev.button] || MOUSE_BTN_MAP[1])());
      } else if (ev.type === 'mouseup' && mouse) {
        await mouse.releaseButton((MOUSE_BTN_MAP[ev.button] || MOUSE_BTN_MAP[1])());
      } else if (ev.type === 'keydown' && keyboard) {
        const k = resolveNutKey(ev.keyName);
        if (k !== null) await keyboard.pressKey(k);
        else console.warn('macro: no key mapping for', ev.keyName);
      } else if (ev.type === 'keyup' && keyboard) {
        const k = resolveNutKey(ev.keyName);
        if (k !== null) await keyboard.releaseKey(k);
      }
    } catch (err) {
      // skip failed step, keep macro going
    }
  }
  return true;
}

async function play(macroEvents, { loop = 1, speed = 1 } = {}, onDone) {
  if (playing) stop();
  playing = true;
  const token = ++playToken;

  const scaled = speed !== 1 ? macroEvents.map((e) => ({ ...e, t: e.t / speed })) : macroEvents;
  const infinite = !loop || loop <= 0;
  let count = 0;

  while (playing && token === playToken && (infinite || count < loop)) {
    const completed = await playOnce(scaled, token);
    if (!completed) break;
    count++;
  }
  if (token === playToken) {
    playing = false;
    onDone?.();
  }
}

function stop() {
  playing = false;
  playToken++;
}

function isPlaying() {
  return playing;
}

function isRecording() {
  return recording;
}

module.exports = { startRecording, stopRecording, isRecording, play, stop, isPlaying };