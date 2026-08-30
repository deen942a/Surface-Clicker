

const appLock = require('./appLock');
const { performance } = require('perf_hooks');

let mouse, Button;
try {
  ({ mouse, Button } = require('@nut-tree-fork/nut-js'));
  mouse.config.autoDelayMs = 0;
  console.log('nut-js loaded OK');
} catch (err) {
  console.error('Failed to load @nut-tree-fork/nut-js:', err);
}

const BUTTON_MAP = {
  left: () => Button.LEFT,
  right: () => Button.RIGHT,
  middle: () => Button.MIDDLE,
  x1: () => Button.BUTTON_4,
  x2: () => Button.BUTTON_5,
};

function resolveButton(name) {
  return (BUTTON_MAP[name] || BUTTON_MAP.left)();
}

let running = false;
let scheduledTimer = null;
let cfg = { cps: 1, dutyCycle: 50, clickButton: 'left' };
let sessionClicks = 0;
let sessionStart = 0;
let sessionDuration = 0;
let appSessionClicks = 0; 

const DUTY_CYCLE_THRESHOLD_CPS = 30;
const TIGHT_LOOP_THRESHOLD_CPS = 80;

async function doClick(holdMs) {
  if (!mouse) return;
  const btn = resolveButton(cfg.clickButton);
  try {
    if (holdMs >= 4) {
      await mouse.pressButton(btn);
      await new Promise((r) => setTimeout(r, holdMs));
      await mouse.releaseButton(btn);
    } else {
      await mouse.click(btn);
    }
    sessionClicks++;
    appSessionClicks++;
    if (sessionClicks % 10 === 0) console.log('clicks:', sessionClicks);
  } catch (err) {
    console.error('Click simulation error:', err);
  }
}

function scheduleNext(targetTime) {
  const delay = targetTime - performance.now();

  if (cfg.cps >= TIGHT_LOOP_THRESHOLD_CPS) {
    setImmediate(() => runBurst(targetTime));
  } else if (delay <= 1) {
    setImmediate(() => runCycle(targetTime));
  } else {
    scheduledTimer = setTimeout(() => runCycle(targetTime), Math.max(0, delay - 1));
  }
}

async function runCycle(targetTime) {
  if (!running) return;
  if (!(await appLock.isAllowed())) {
    scheduleNext(targetTime + (1000 / Math.max(0.1, cfg.cps)));
    return;
  }
  const cycleMs = 1000 / Math.max(0.1, cfg.cps);
  const holdMs =
    cfg.cps < DUTY_CYCLE_THRESHOLD_CPS ? cycleMs * (cfg.dutyCycle / 100) : 0;

  await doClick(holdMs);

  if (!running) return;
  scheduleNext(targetTime + cycleMs);
}

async function runBurst(targetTime) {
  if (!running) return;

  const cycleMs = 1000 / Math.max(0.1, cfg.cps);
  const now = performance.now();

  let t = targetTime;
  while (t <= now + 0.5 && running) {
    if (await appLock.isAllowed()) {
      await doClick(0);
    }
    t += cycleMs;
  }

  if (!running) return;

  const delay = t - performance.now();
  if (delay <= 1) {
    setImmediate(() => runBurst(t));
  } else {
    scheduledTimer = setTimeout(() => runBurst(t), Math.max(0, delay - 1));
  }
}

function start({ cps, dutyCycle, clickButton }, onStatus) {
  if (running) stop();
  running = true;
  cfg = { cps, dutyCycle, clickButton: clickButton || 'left' };
  sessionClicks = 0;
  sessionStart = Date.now();
  onStatus?.({ running: true, cps, dutyCycle, clickButton: cfg.clickButton });
  scheduleNext(performance.now());
}

function stop(onStatus) {
  running = false;
  if (scheduledTimer) {
    clearTimeout(scheduledTimer);
    scheduledTimer = null;
  }
  sessionDuration = sessionStart ? Date.now() - sessionStart : 0;
  const session = { clicks: sessionClicks, durationMs: sessionDuration };
  onStatus?.({ running: false, ...session });
  return session;
}

function getSessionStats() {
  return {
    running,
    clicks: sessionClicks,
    durationMs: running && sessionStart ? Date.now() - sessionStart : sessionDuration,
  };
}

function getAppSessionClicks() {
  return appSessionClicks;
}

function isRunning() {
  return running;
}

module.exports = { start, stop, isRunning, getSessionStats, getAppSessionClicks };