// Refreshes the landing-page screenshots in public/marketing from the running
// dev app, using headless Edge over the DevTools protocol (no extra deps).
//
// Prereqs: Postgres + API + web dev server running, and the demo account
// seeded with today fully logged:
//   SEED_SHOWCASE=1 npm run seed:demo -w @arcadia/api
// Then:
//   npm run capture:marketing -w @arcadia/web
// Env: ONLY=dashboard captures one shot; DASHBOARD_SCROLL (px) scrolls the
// hero past the promo banner (440 frames the week + rings + charts); EDGE
// overrides the browser path; DEMO_PASSWORD matches the seeded account.
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const EDGE =
  process.env.EDGE ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const APP = 'http://localhost:5174';
// A fresh port per run: a stray Edge from an aborted run must never be mistaken
// for ours (its profile is deleted below, which leaves it a blank shell).
const PORT = 9400 + Math.floor(Math.random() * 400);
const OUT = process.argv[2] ?? fileURLToPath(new URL('../public/marketing', import.meta.url));
const WIDTH = 1600;
const HEIGHT = 1000;
const EMAIL = 'demo@arcadia.dev';
const PASSWORD = process.env.DEMO_PASSWORD ?? 'demo1234';
const ONLY = process.env.ONLY; // capture a single shot, e.g. ONLY=dashboard
const DASHBOARD_SCROLL = Number(process.env.DASHBOARD_SCROLL ?? 440);

const profile = join(process.env.TEMP ?? '.', 'atlas-capture-profile');
rmSync(profile, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const edge = spawn(
  EDGE,
  [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    `--window-size=${WIDTH},${HEIGHT}`,
    '--hide-scrollbars',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    'about:blank',
  ],
  { stdio: 'ignore' },
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function pageTarget() {
  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json`);
      const targets = await res.json();
      const page = targets.find((t) => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(200);
  }
  throw new Error('Edge did not expose a page target');
}

const ws = new WebSocket(await pageTarget());
await new Promise((r) => (ws.onopen = r));
let nextId = 1;
const pending = new Map();
const events = [];
ws.onmessage = (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
  } else if (msg.method === 'Runtime.consoleAPICalled') {
    events.push(`[${msg.params.type}] ${msg.params.args.map((a) => a.value ?? a.description ?? '').join(' ')}`);
  } else if (msg.method === 'Runtime.exceptionThrown') {
    events.push(`[exception] ${msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text}`);
  }
};
function send(method, params = {}) {
  const id = nextId++;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

async function evaluate(expression) {
  const r = await send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + JSON.stringify(r.exceptionDetails.exception?.description ?? ''));
  return r.result.value;
}

async function goto(path) {
  await send('Page.navigate', { url: `${APP}${path}` });
  await sleep(1500);
}

/** Waits until the page text satisfies `test`; reloads when the local
 * database open timed out (the app shows onboarding or stays empty). */
async function waitForText(test, { timeoutMs = 120_000, path } = {}) {
  const started = Date.now();
  let reloads = 0;
  let lastReloadAt = started;
  for (;;) {
    const text = await evaluate('document.body.innerText').catch(() => '');
    if (test(text)) return text;
    const stuck =
      /What are you training for\?/.test(text) ||
      /Local database unavailable|Something broke/.test(text);
    // Give each attempt time to open the store and finish the first sync
    // before judging it: the onboarding screen appears briefly on a slow
    // open and clears once the synced profile lands.
    const attemptAge = Date.now() - lastReloadAt;
    if ((stuck && attemptAge > 15_000) || attemptAge > 30_000) {
      if (reloads >= 5 || !path) {
        throw new Error(
          `Gave up after ${reloads} reloads. Last text:\n${text.slice(0, 400)}\nConsole:\n${(() => { const w = events.filter((e) => /^\[(warn|error|exception)\]/.test(e)); return `${w.length} warnings; first 12:\n${w.slice(0, 12).join('\n')}`; })()}`,
        );
      }
      reloads += 1;
      lastReloadAt = Date.now();
      await goto(path);
      continue;
    }
    if (Date.now() - started > timeoutMs) {
      throw new Error(`Timed out waiting for page text. Last text:\n${text.slice(0, 800)}`);
    }
    await sleep(500);
  }
}

async function shoot(name) {
  await sleep(1200); // charts animate in
  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  const file = join(OUT, `${name}.png`);
  writeFileSync(file, Buffer.from(data, 'base64'));
  console.log(`saved ${file}`);
}

/** Sets a React-controlled input's value so its onChange fires. */
const setInput = (selectorExpr, value) => `
  (() => {
    const el = ${selectorExpr};
    if (!el) return 'missing';
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(el, ${JSON.stringify(String(value))});
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return 'ok';
  })()`;

try {
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: WIDTH,
    height: HEIGHT,
    deviceScaleFactor: 2,
    mobile: false,
  });

  // Sign in through the API (same-origin cookie), then let the app sync.
  await goto('/signin');
  await sleep(1000);
  const status = await evaluate(`fetch('/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ${JSON.stringify(EMAIL)}, password: ${JSON.stringify(PASSWORD)} }),
  }).then((r) => r.status)`);
  if (status !== 200) throw new Error(`login failed: ${status}`);

  // Dashboard — wait for synced targets to show up.
  await goto('/');
  await waitForText((t) => /of 2,\d{3}/.test(t) && /Workouts/.test(t) && /This week/.test(t), { path: '/' });
  // The app scrolls its main panel, not the window: scroll whichever
  // ancestor of the page content actually overflows.
  await evaluate(`(() => {
    const scroller = [...document.querySelectorAll('main, main *, body *')].find((e) =>
      e.scrollHeight > e.clientHeight + 100 && /auto|scroll/.test(getComputedStyle(e).overflowY));
    (scroller ?? document.scrollingElement).scrollTop = ${DASHBOARD_SCROLL};
    return scroller ? scroller.tagName + '.' + scroller.className.slice(0, 40) : 'window';
  })()`).then((w) => console.log('scrolled', w));
  await shoot('dashboard');
  if (ONLY === 'dashboard') throw new Error('__done__');

  // Progress.
  await goto('/you');
  await waitForText((t) => /Your gains/.test(t) && /Top lifts/.test(t), { path: '/you' });
  await shoot('progress');

  // Nutrition: today's diary.
  await goto('/eat');
  await waitForText((t) => /Breakfast/i.test(t) && /Dinner/i.test(t), { path: '/eat' });
  await shoot('eat');

  // Friends.
  await goto('/friends');
  await waitForText((t) => /Maya Chen/.test(t) && /Garage Gang/.test(t), { path: '/friends' });
  await shoot('social');

  // Live session: open Upper Strength from the library and log a few sets.
  await goto('/train/library');
  await waitForText((t) => /Upper Strength/.test(t), { path: '/train/library' });
  const href = await evaluate(`[...document.querySelectorAll('a[href^="/workouts/"]')]
    .find((a) => a.textContent.includes('Upper Strength'))?.getAttribute('href') ?? ''`);
  if (!href) throw new Error('Upper Strength link not found');
  await goto(href);
  await waitForText((t) => /Start workout/.test(t), { path: href });
  await evaluate(`[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Start workout').click(); 'clicked'`);
  await waitForText((t) => /Log set/.test(t) && /Finish workout/.test(t));
  const sets = [
    [0, 5, 185],
    [0, 5, 185],
    [0, 5, 185],
    [1, 5, 165],
    [1, 5, 165],
  ];
  for (const [exercise, reps, lb] of sets) {
    const rows = `[...document.querySelectorAll('button')].filter((b) => b.textContent.trim() === 'Log set')`;
    const container = `${rows}[${exercise}].parentElement`;
    await evaluate(setInput(`${container}.querySelectorAll('input[type="number"]')[0]`, reps));
    await evaluate(setInput(`${container}.querySelectorAll('input[type="number"]')[1]`, lb));
    await sleep(150);
    await evaluate(`${rows}[${exercise}].click(); 'ok'`);
    await sleep(500);
  }
  // Leave the next set pre-filled so the form reads as mid-session.
  const rows = `[...document.querySelectorAll('button')].filter((b) => b.textContent.trim() === 'Log set')`;
  await evaluate(setInput(`${rows}[1].parentElement.querySelectorAll('input[type="number"]')[0]`, 5));
  await evaluate(setInput(`${rows}[1].parentElement.querySelectorAll('input[type="number"]')[1]`, 165));
  await evaluate('window.scrollTo(0, 0)');
  await shoot('train');
} catch (err) {
  if (err.message !== '__done__') throw err;
} finally {
  ws.close();
  // Edge is a process tree; killing only the launcher leaves renderers behind.
  if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(edge.pid), '/T', '/F'], { stdio: 'ignore' });
  else edge.kill();
}
