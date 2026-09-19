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

async function setExpression(expression, intensity = 1, energy = 0.5) {
  await page.evaluate(({ expression, intensity, energy }) => {
    const frame = document.querySelector('.ember-character-stage iframe');
    if (!(frame instanceof HTMLIFrameElement) || !frame.contentWindow?.EmberHost) {
      throw new Error('Ember host bridge is not ready');
    }
    frame.contentWindow.EmberHost.setExpression(expression, intensity, energy);
  }, { expression, intensity, energy });
}

async function runAction(action) {
  await page.evaluate((nextAction) => {
    const frame = document.querySelector('.ember-character-stage iframe');
    if (!(frame instanceof HTMLIFrameElement) || !frame.contentWindow?.EmberHost) {
      throw new Error('Ember host bridge is not ready');
    }
    frame.contentWindow.EmberHost.runAction(nextAction);
  }, action);
}

async function setPace(pace) {
  await page.evaluate((nextPace) => {
    const frame = document.querySelector('.ember-character-stage iframe');
    if (!(frame instanceof HTMLIFrameElement) || !frame.contentWindow?.EmberHost) {
      throw new Error('Ember host bridge is not ready');
    }
    frame.contentWindow.EmberHost.setPace(nextPace);
  }, pace);
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

  await setPace('idle');
  await setExpression('happy', 0.7, 0.35);
  await shot(stage, '00-neutral-master', 420);

  console.log('Captured Ember: all 9 client expressions, wave, jump, blink, walk, run and neutral master.');
} finally {
  await browser.close();
}
