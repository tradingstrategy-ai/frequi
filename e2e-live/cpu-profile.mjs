// CPU-profile the dashboard against the local dev server (readable function names).
//   node e2e-live/cpu-profile.mjs [path-to-click-label ...]
// Prints the self-time hot spots while: opening the app, then clicking Dashboard.
import { chromium } from '@playwright/test';

const BASE = process.env.DEV_URL ?? 'http://100.72.126.50:9298';
const phases = process.argv.slice(2).length ? process.argv.slice(2) : ['open', 'Dashboard'];
const browser = await chromium.launch({ channel: 'chrome' });
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
const page = await context.newPage();
const cdp = await context.newCDPSession(page);
await cdp.send('Profiler.enable');
await cdp.send('Profiler.setSamplingInterval', { interval: 500 });

const sites = new Map();

function summarize(profile, label) {
  const nodes = new Map(profile.nodes.map((n) => [n.id, n]));
  const self = new Map();
  const dt = profile.timeDeltas;
  profile.samples.forEach((id, i) => {
    const node = nodes.get(id);
    const cf = node.callFrame;
    const where = cf.url.replace(/^.*\/(src|node_modules)\//, '$1/').replace(/\?.*$/, '').replace(/^.*\/assets\//, '');
    const key = `${cf.functionName || '(anonymous)'}  ${where}:${cf.lineNumber + 1}:${cf.columnNumber + 1}`;
    sites.set(key, cf);
    self.set(key, (self.get(key) ?? 0) + (dt[i] ?? 0));
  });
  const total = [...self.values()].reduce((a, b) => a + b, 0);
  const idle = [...self.entries()].filter(([k]) => /^\((idle|program|garbage collector)\)/.test(k)).reduce((a, [, v]) => a + v, 0);
  console.log(`\n### ${label}: ${(total / 1e6).toFixed(1)} s sampled, ${((total - idle) / 1e6).toFixed(1)} s busy`);
  [...self.entries()]
    .filter(([k]) => !/^\((idle|program)\)/.test(k))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 14)
    .forEach(([k, v]) => console.log(`  ${(v / 1000).toFixed(0).padStart(6)} ms  ${k.slice(0, 150)}`));
  // Decode: print the minified source around each hot spot.
  return [...self.entries()].filter(([k]) => !/^\((idle|program|garbage)/.test(k)).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k]) => sites.get(k));
}

const snippets = [];

for (const phase of phases) {
  await cdp.send('Profiler.start');
  if (phase === 'open') {
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(14_000);
  } else {
    await page.getByRole('link', { name: phase, exact: true }).first().click({ timeout: 60_000 });
    await page.waitForTimeout(12_000);
  }
  const { profile } = await cdp.send('Profiler.stop');
  snippets.push(...summarize(profile, phase === 'open' ? 'opening the app (14 s)' : `clicking ${phase} (12 s)`));
}
const seen = new Set();
for (const cf of snippets) {
  if (!cf?.url || !cf.url.includes('/assets/') || seen.has(cf.url + cf.lineNumber + ':' + cf.columnNumber)) continue;
  seen.add(cf.url + cf.lineNumber + ':' + cf.columnNumber);
  const text = await (await fetch(cf.url)).text();
  const line = text.split('\n')[cf.lineNumber] ?? '';
  const at = cf.columnNumber;
  console.log(`\n--- ${cf.functionName || '(anonymous)'} @ ${cf.url.split('/').pop()}:${cf.lineNumber + 1}:${at + 1}\n${line.slice(Math.max(0, at - 160), at + 420)}`);
}
await browser.close();
