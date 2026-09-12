const { uIOhook, isAvailable, ensureStarted, KEY_NAME_BY_CODE } = require('./rawInput');
const { performance } = require('perf_hooks');

let mouse, keyboard, Button, Key, Point;
try {
  ({ mouse, keyboard, Button, Key, Point } = require('@nut-tree-fork/nut-js'));
  mouse.config.autoDelayMs = 0;
  mouse.config.mouseSpeed = 9999;
} catch (err) {
  console.warn('Could not load nut-js for macro playback');
}

let recording = false;
let recordStart = 0;
let events = [];
let recordingTriggerBinding = null;
let recordingStopBinding = null;
let blockedBindings = [];

const MOVE_INTERVAL_MS = 16;
let lastMoveRecorded = 0;

// Named handler refs so we can remove them cleanly
let _onMove = null;
let _onMouseDown = null;
let _onMouseUp = null;
let _onKeyDown = null;
let _onKeyUp = null;
let _onWheel = null;

function detachRecordListeners() {
  if (!uIOhook) return;
  if (_onMove) uIOhook.off('mousemove', _onMove);
  if (_onMouseDown) uIOhook.off('mousedown', _onMouseDown);
  if (_onMouseUp) uIOhook.off('mouseup', _onMouseUp);
  if (_onKeyDown) uIOhook.off('keydown', _onKeyDown);
  if (_onKeyUp) uIOhook.off('keyup', _onKeyUp);
  if (_onWheel) uIOhook.off('wheel', _onWheel);
  _onMove = _onMouseDown = _onMouseUp = _onKeyDown = _onKeyUp = _onWheel = null;
}

function attachRecordListeners() {
  if (!isAvailable) return;
  ensureStarted();
  detachRecordListeners();

  _onMove = (e) => {
    if (!recording) return;
    const now = performance.now();
    if (now - lastMoveRecorded < MOVE_INTERVAL_MS) return;
    lastMoveRecorded = now;
    events.push({ t: now - recordStart, type: 'move', x: e.x, y: e.y });
  };

  _onMouseDown = (e) => {
    if (!recording) return;
    if (recordingTriggerBinding?.type === 'mouse' && recordingTriggerBinding.button === e.button) { recording = false; return; }
    if (recordingStopBinding?.type === 'mouse' && recordingStopBinding.button === e.button) { recording = false; return; }
    events.push({ t: performance.now() - recordStart, type: 'mousedown', button: e.button });
  };

  _onMouseUp = (e) => {
    if (!recording) return;
    events.push({ t: performance.now() - recordStart, type: 'mouseup', button: e.button });
  };

  _onKeyDown = (e) => {
    if (!recording) return;
    const keyName = KEY_NAME_BY_CODE[e.keycode];
    if (recordingTriggerBinding?.type === 'keyboard' && recordingTriggerBinding.keyName === keyName) { recording = false; return; }
    if (recordingStopBinding?.type === 'keyboard' && recordingStopBinding.keyName === keyName) { recording = false; return; }
    events.push({ t: performance.now() - recordStart, type: 'keydown', keyName });
  };

  _onKeyUp = (e) => {
    if (!recording) return;
    const keyName = KEY_NAME_BY_CODE[e.keycode];
    events.push({ t: performance.now() - recordStart, type: 'keyup', keyName });
  };

  _onWheel = (e) => {
    if (!recording) return;
    events.push({
      t: performance.now() - recordStart,
      type: 'wheel',
      rotation: e.rotation,
      direction: e.direction,
    });
  };

  uIOhook.on('mousemove', _onMove);
  uIOhook.on('mousedown', _onMouseDown);
  uIOhook.on('mouseup', _onMouseUp);
  uIOhook.on('keydown', _onKeyDown);
  uIOhook.on('keyup', _onKeyUp);
  uIOhook.on('wheel', _onWheel);
}

function startRecording(triggerBinding, stopBinding) {
  recordingTriggerBinding = triggerBinding || null;
  recordingStopBinding = stopBinding || null;
  blockedBindings = [triggerBinding, stopBinding].filter(Boolean);
  attachRecordListeners();
  events = [];
  recordStart = performance.now();
  lastMoveRecorded = 0;
  recording = true;
  if (mouse) {
    mouse.getPosition().then((pos) => {
      events.unshift({ t: 0, type: 'move', x: pos.x, y: pos.y });
    }).catch(() => {});
  }
}

function stopRecording() {
  recording = false;
  detachRecordListeners();
  events.push({ t: performance.now() - recordStart, type: 'end' });
  const result = events;
  blockedBindings = [];
  return result;
}

const MOUSE_BTN_MAP = { 1: () => Button.LEFT, 2: () => Button.RIGHT, 3: () => Button.MIDDLE };

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
const heldKeys = new Set();
const heldButtons = new Set();

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function playOnce(macroEvents, token, triggerBinding, instantStart) {
  let last = instantStart && macroEvents.length ? macroEvents[0].t : 0;
  let lastX = null;
  let lastY = null;

  for (const ev of macroEvents) {
    if (token !== playToken) return false;
    const wait = ev.t - last;
    last = ev.t;
    if (ev.type === 'move' && mouse && Point) {
      if (wait > 0) await sleep(wait);
      if (token !== playToken) return false;
      try {
        await mouse.setPosition(new Point(ev.x, ev.y));
      } catch (err) {
        // skip failed step
      }
      lastX = ev.x;
      lastY = ev.y;
      continue;
    }

    if (wait > 0) await sleep(wait);
    if (token !== playToken) return false;

      try {
      if ((ev.type === 'mousedown' || ev.type === 'mouseup') && mouse) {
        if (triggerBinding?.type === 'mouse' && triggerBinding.button === ev.button) {
          // skip trigger button
        } else if (ev.type === 'mousedown') {
          const btn = (MOUSE_BTN_MAP[ev.button] || MOUSE_BTN_MAP[1])();
          await mouse.pressButton(btn);
          heldButtons.add(ev.button);
        } else {
          const btn = (MOUSE_BTN_MAP[ev.button] || MOUSE_BTN_MAP[1])();
          await mouse.releaseButton(btn);
          heldButtons.delete(ev.button);
        }
      } else if ((ev.type === 'keydown' || ev.type === 'keyup') && keyboard) {
        if (triggerBinding?.type === 'keyboard' && triggerBinding.keyName === ev.keyName) {
          // skip trigger key
        } else {
          const k = resolveNutKey(ev.keyName);
          if (ev.type === 'keydown') {
            if (k !== null) { await keyboard.pressKey(k); heldKeys.add(k); }
            else console.warn('macro: no key mapping for', ev.keyName);
          } else {
            if (k !== null) { await keyboard.releaseKey(k); heldKeys.delete(k); }
          }
        }
      } else if (ev.type === 'wheel' && mouse) {
        const amount = Math.max(1, Math.abs(Math.round(ev.rotation || 1)));
        const horizontal = ev.direction === 4;
        if (horizontal) {
          if (ev.rotation < 0) await mouse.scrollLeft(amount);
          else await mouse.scrollRight(amount);
        } else {
          if (ev.rotation < 0) await mouse.scrollUp(amount);
          else await mouse.scrollDown(amount);
        }
      }
    } catch (err) {
      // skip failed step
    }
  }
  return true;
}

async function play(macroEvents, { loop = 1, speed = 1, instant = false, instantStart = false, triggerBinding = null } = {}, onDone) {
  if (playing) stop();
  playing = true;
  const token = ++playToken;

  let scaled;
  if (instant) {
    scaled = macroEvents.map((e) => ({ ...e, t: 0 }));
  } else if (speed !== 1) {
    scaled = macroEvents.map((e) => ({ ...e, t: e.t / speed }));
  } else {
    scaled = macroEvents;
  }

  const infinite = !loop || loop <= 0;
  let count = 0;

  while (playing && token === playToken && (infinite || count < loop)) {
    const completed = await playOnce(scaled, token, triggerBinding, instantStart);
    if (!completed) break;
    count++;
  }
  if (token === playToken) {
    playing = false;
    onDone?.();
  }
}

async function releaseAll() {
  if (keyboard) {
    for (const k of heldKeys) {
      try { await keyboard.releaseKey(k); } catch (_) {}
    }
  }
  if (mouse) {
    for (const b of heldButtons) {
      try { await mouse.releaseButton((MOUSE_BTN_MAP[b] || MOUSE_BTN_MAP[1])()); } catch (_) {}
    }
  }
  heldKeys.clear();
  heldButtons.clear();
}

function stop() {
  playing = false;
  playToken++;
  releaseAll();
}

function isPlaying() { return playing; }
function isRecording() { return recording; }

module.exports = { startRecording, stopRecording, isRecording, play, stop, isPlaying };