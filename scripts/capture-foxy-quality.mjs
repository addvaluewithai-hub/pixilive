import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const appUrl = process.env.PIXILIVE_PREVIEW_URL ?? 'http://127.0.0.1:4173';
const outputDir = path.resolve('visual-artifacts', 'foxy-v4');
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 900, height: 900 }, deviceScaleFactor: 1 });

async function selectCharacter(id) {
  await page.locator('#character-select').selectOption(id);
}

async function waitForEmber() {
  const stage = page.locator('.ember-character-stage');
  await stage.locator('iframe').waitFor({ state: 'visible' });
  await page.waitForFunction(() => {
    const frame = document.querySelector('.ember-character-stage iframe');
    return frame instanceof HTMLIFrameElement && Boolean(frame.contentWindow?.EmberHost);
  });
  return stage;
}

async function withBridge(callback, arg) {
  await page.evaluate(({ callbackText, arg }) => {
    const frame = document.querySelector('.ember-character-stage iframe');
    if (!(frame instanceof HTMLIFrameElement) || !frame.contentWindow?.EmberHost) {
      throw new Error('Ember host bridge is not ready');
    }
    const fn = new Function('bridge', 'arg', `return (${callbackText})(bridge, arg);`);
    return fn(frame.contentWindow.EmberHost, arg);
  }, { callbackText: callback.toString(), arg });
}

async function setExpression(expression, intensity = 1, energy = 0.5) {
  await withBridge((bridge, payload) => bridge.setExpression(payload.expression, payload.intensity, payload.energy), {
    expression,
    intensity,
    energy,
  });
}

async function runAction(action) {
  await withBridge((bridge, nextAction) => bridge.runAction(nextAction), action);
}

async function setPace(pace) {
  await withBridge((bridge, nextPace) => bridge.setPace(nextPace), pace);
}

async function setMouth(pose, speaking) {
  await withBridge((bridge, payload) => bridge.setMouth(payload.pose, payload.speaking), { pose, speaking });
}

async function shot(stage, name, waitMs = 460) {
  await page.waitForTimeout(waitMs);
  await stage.screenshot({ path: path.join(outputDir, `${name}.png`) });
}

try {
  await page.goto(appUrl, { waitUntil: 'networkidle' });
  await selectCharacter('foxy');
  const stage = await waitForEmber();

  await page.addStyleTag({ content: `
    .brand, .copy, .controls { display: none !important; }
    html, body, #root, .shell, .hero { width: 900px !important; height: 900px !important; min-height: 900px !important; margin: 0 !important; overflow: hidden !important; }
    .hero { display: block !important; position: relative !important; }
    .stage-wrap { position: absolute !important; inset: 50px !important; width: 800px !important; height: 800px !important; margin: 0 !important; }
    .ember-character-stage, .ember-character-stage iframe { width: 800px !important; height: 800px !important; min-height: 800px !important; }
  ` });
  await page.waitForTimeout(300);

  const expressions = [
    ['happy', '01-happy', 0.58],
    ['sad', '02-sad', 0.24],
    ['crying', '03-crying', 0.32],
    ['surprised', '04-surprised', 0.72],
    ['thinking', '05-thinking', 0.34],
    ['angry', '06-angry', 0.68],
    ['sleepy', '07-sleepy', 0.16],
    ['laughing', '08-laughing', 0.82],
    ['excited', '09-excited', 0.9],
  ];

  for (const [expression, name, energy] of expressions) {
    await setExpression(expression, 1, energy);
    await shot(stage, name);
  }

  await setExpression('happy', 1, 0.65);
  await runAction('wave');
  await shot(stage, '10-wave', 500);

  await runAction('jump');
  await shot(stage, '11-jump', 330);

  await runAction('blink');
  await shot(stage, '12-blink', 70);

  await setPace('walk');
  await shot(stage, '13-walk', 420);

  await setPace('run');
  await shot(stage, '14-run', 320);

  // Exercise the exact bridge used by outgoing Gemini audio/visemes. The client
  // controller keeps authoring the mouth path while this overlay only applies the
  // live articulation transform, so customer source remains untouched.
  await setPace('idle');
  await setExpression('happy', 1, 0.58);
  await setMouth({ open: 0.88, width: 0.72, round: 0.12, energy: 0.9, viseme: 'AA' }, true);
  await shot(stage, '15-speaking-aa', 120);
  await setMouth({ open: 0.62, width: 0.34, round: 0.9, energy: 0.7, viseme: 'OH' }, true);
  await shot(stage, '16-speaking-oh', 120);
  await setMouth({ open: 0.045, width: 0.37, round: 0.08, energy: 0, viseme: 'REST' }, false);

  await setExpression('happy', 0.7, 0.35);
  await shot(stage, '00-neutral-master', 420);

  console.log('Captured Ember: all 9 client expressions, native actions/pace, and live mouth articulation bridge.');
} finally {
  await browser.close();
}
