import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const appUrl = process.env.PIXILIVE_PREVIEW_URL ?? 'http://127.0.0.1:4173';
const outputDir = path.resolve('visual-artifacts', 'foxy-v2');
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });

async function shot(canvas, name, waitMs = 420) {
  await page.waitForTimeout(waitMs);
  await canvas.screenshot({ path: path.join(outputDir, `${name}.png`) });
}

async function mood(canvas, label, name, waitMs = 500) {
  await page.locator('.mood-pack-grid button', { hasText: label }).click();
  await shot(canvas, name, waitMs);
}

async function action(canvas, label, name, waitMs = 520) {
  await page.locator('.action-pack-grid button', { hasText: label }).click();
  await shot(canvas, name, waitMs);
}

try {
  await page.goto(appUrl, { waitUntil: 'networkidle' });
  await page.locator('#character-select').selectOption('foxy');
  const stage = page.locator('.rive-character-stage');
  const canvas = stage.locator('canvas');
  await canvas.waitFor({ state: 'visible' });
  await page.waitForTimeout(950);

  const labLabel = stage.locator('.motion-lab-toggle em');
  await labLabel.waitFor({ state: 'visible' });
  const bindingText = (await labLabel.textContent()) ?? '';
  if (bindingText.includes('NOT BOUND')) throw new Error('Foxy ViewModel is not bound');

  await mood(canvas, 'Calm', '00-neutral-master', 650);
  await mood(canvas, 'Happy', '01-happy');
  await mood(canvas, 'Sad', '02-sad');
  await action(canvas, 'Crying', '03-crying', 650);
  await action(canvas, 'Celebrating', '04-celebrating', 520);
  await mood(canvas, 'Angry', '05-angry');
  await action(canvas, 'Surprised', '06-surprised', 420);
  await mood(canvas, 'Sleepy', '07-sleepy');
  await action(canvas, 'Laughing', '08-laughing', 520);
  await action(canvas, 'Waving', '09-waving', 520);
  await mood(canvas, 'Thinking', '10-thinking');
  await mood(canvas, 'Curious', '11-curious');
  await mood(canvas, 'Excited', '12-excited');
  await action(canvas, 'Aha!', '13-aha', 420);
  await action(canvas, 'Reassure', '14-reassure', 480);

  await page.screenshot({ path: path.join(outputDir, 'foxy-full-page.png'), fullPage: true });
  console.log('Captured Foxy v2 neutral master and 14 expression/action QA states.');
} finally {
  await browser.close();
}
