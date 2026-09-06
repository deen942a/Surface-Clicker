const appLock = require('./appLock');
const { performance } = require('perf_hooks');

let mouse, Button;
try {
  ({ mouse, Button } = require('@nut-tree-fork/nut-js'));
  mouse.config.autoDelayMs = 0;
  mouse.config.mouseSpeed = 9999;
} catch (err) {
  console.warn('Could not load @nut-tree-fork/nut-js...');
}

// Map button names to nut-js Button enum values, cached once on load
const BUTTON_CACHE = {};
function resolveButton(name) {
  if (BUTTON_CACHE[name] !== undefined) return BUTTON_CACHE[name];
  if (!Button) { BUTTON_CACHE[name] = 0; return 0; }
  const map = {
    left:   Button.LEFT,
    right:  Button.RIGHT,
    middle: Button.MIDDLE,
    x1:     Button.BUTTON_4,
    x2:     Button.BUTTON_5,
  };
  BUTTON_CACHE[name] = map[name] ?? Button.LEFT;
  return BUTTON_CACHE[name];
}

const DUTY_CYCLE_THRESHOLD_CPS = 30;
const TIGHT_LOOP_THRESHOLD_CPS = 80;
// Max ms drift before we reset the timing anchor (avoids spiral catch-up)
const MAX_DRIFT_MS = 200;

let running = false;
let scheduledTimer = null;
let cfg = { cps: 1, dutyCycle: 50, clickButton: 'left' };
let resolvedButton = 0;

let sessionClicks = 0;
let sessionStart = 0;
let appSessionClicks = 0;

// AppLock polling: check at most once per 100 ms instead of per-click
let appLockAllowed = true;
let appLockPollTimer = null;

function startAppLockPoll() {
  stopAppLockPoll();
  // Do an immediate check, then poll every 100 ms
  appLock.isAllowed().then((v) => { appLockAllowed = v; });
  appLockPollTimer = setInterval(() => {
    appLock.isAllowed().then((v) => { appLockAllowed = v; });
  }, 100);
}

function stopAppLockPoll() {
  if (appLockPollTimer) { clearInterval(appLockPollTimer); appLockPollTimer = null; }
  appLockAllowed = true;
}

// Synchronous-ish click — avoids extra promise chains on every tick
async function doClick(holdMs) {
  if (!mouse) return;
  const btn = resolvedButton;
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
  } catch (err) {
    // Suppress per-click errors; nut-js can throw if the window focus changes
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

  // Drift guard: if we've fallen too far behind, re-anchor rather than
  // hammering a burst of missed clicks
  const now = performance.now();
  if (now - targetTime > MAX_DRIFT_MS) targetTime = now;

  const cycleMs = 1000 / Math.max(0.1, cfg.cps);
  const holdMs = cfg.cps < DUTY_CYCLE_THRESHOLD_CPS
    ? cycleMs * (cfg.dutyCycle / 100)
    : 0;

  if (appLockAllowed) await doClick(holdMs);

  if (!running) return;
  scheduleNext(targetTime + cycleMs);
}

async function runBurst(targetTime) {
  if (!running) return;

  const cycleMs = 1000 / Math.max(0.1, cfg.cps);
  const now = performance.now();

  // Drift guard for burst path too
  if (now - targetTime > MAX_DRIFT_MS) targetTime = now;

  let t = targetTime;
  while (t <= now + 0.5 && running) {
    if (appLockAllowed) await doClick(0);
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
  resolvedButton = resolveButton(cfg.clickButton); // resolve once, not per-click
  sessionClicks = 0;
  sessionStart = Date.now();
  startAppLockPoll();
  onStatus?.({ running: true, cps, dutyCycle, clickButton: cfg.clickButton });
  scheduleNext(performance.now());
}

function stop(onStatus) {
  running = false;
  stopAppLockPoll();
  if (scheduledTimer) { clearTimeout(scheduledTimer); scheduledTimer = null; }
  const session = {
    clicks: sessionClicks,
    durationMs: sessionStart ? Date.now() - sessionStart : 0,
  };
  onStatus?.({ running: false, ...session });
  return session;
}

function getSessionStats() {
  return {
    running,
    clicks: sessionClicks,
    durationMs: running && sessionStart ? Date.now() - sessionStart : 0,
  };
}

function getAppSessionClicks() { return appSessionClicks; }
function isRunning() { return running; }

module.exports = { start, stop, isRunning, getSessionStats, getAppSessionClicks };