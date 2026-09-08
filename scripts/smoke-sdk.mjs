import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const previewUrl = process.env.PIXILIVE_PREVIEW_URL ?? 'http://127.0.0.1:4173';
const outputDir = path.resolve('visual-artifacts');
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 760, height: 720 }, deviceScaleFactor: 1 });

try {
  await page.setContent(`<!doctype html><html><body style="margin:0;background:#0a0d27"><div id="mount" style="width:760px;height:720px"></div></body></html>`);
  await page.evaluate(async (url) => {
    await import(url);
    await customElements.whenDefined('pixilive-nova');
    const nova = document.createElement('pixilive-nova');
    nova.setAttribute('transparent', '');
    nova.style.display = 'block';
    nova.style.width = '760px';
    nova.style.height = '720px';
    document.querySelector('#mount')?.appendChild(nova);
    await new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error('pixilive-ready timeout')), 6000);
      nova.addEventListener('pixilive-ready', () => { window.clearTimeout(timer); resolve(undefined); }, { once: true });
    });
    nova.perform({ affect: 'enthusiastic', intensity: 0.9, gesture: 'celebrate', posture: 'open', gaze: 'user' });
    nova.flyTo({ x: 520, y: 270, speed: 1.1 });
  }, `${previewUrl}/sdk/pixilive-nova.js`);

  await page.waitForTimeout(1100);
  await page.screenshot({ path: path.join(outputDir, 'sdk-nova-embed-smoke.png'), fullPage: true });
  const state = await page.evaluate(() => ({ defined: Boolean(customElements.get('pixilive-nova')), canvases: document.querySelectorAll('canvas').length }));
  if (!state.defined || state.canvases !== 1) throw new Error(`SDK smoke failed: ${JSON.stringify(state)}`);
  console.log('PixiLive SDK smoke passed:', state);
} finally {
  await browser.close();
}
