import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const appUrl = process.env.PIXILIVE_PREVIEW_URL ?? 'http://127.0.0.1:4173';
const outputDir = path.resolve('visual-artifacts');
const characters = ['benny', 'dino', 'foxy', 'kiro'];
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });

async function captureCharacter(id) {
  const characterSelect = page.locator('#character-select');
  await characterSelect.selectOption(id);
  await page.locator('.rive-character-stage canvas').waitFor({ state: 'visible' });
  await page.waitForTimeout(750);
  const canvas = page.locator('.rive-character-stage canvas');

  await page.locator('.mood-pack-grid button', { hasText: 'Calm' }).click();
  await page.waitForTimeout(220);
  await canvas.screenshot({ path: path.join(outputDir, `${id}-calm.png`) });

  await page.locator('.mood-pack-grid button', { hasText: 'Happy' }).click();
  await page.waitForTimeout(280);
  await canvas.screenshot({ path: path.join(outputDir, `${id}-happy.png`) });

  await page.locator('.mood-pack-grid button', { hasText: 'Thinking' }).click();
  await page.waitForTimeout(300);
  await canvas.screenshot({ path: path.join(outputDir, `${id}-thinking.png`) });

  await page.locator('.mood-pack-grid button', { hasText: 'Angry' }).click();
  await page.waitForTimeout(260);
  await canvas.screenshot({ path: path.join(outputDir, `${id}-angry.png`) });

  await page.locator('.action-pack-grid button', { hasText: 'Celebrating' }).click();
  await page.waitForTimeout(430);
  await canvas.screenshot({ path: path.join(outputDir, `${id}-celebrating.png`) });

  await page.locator('.action-pack-grid button', { hasText: 'Crying' }).click();
  await page.waitForTimeout(600);
  await canvas.screenshot({ path: path.join(outputDir, `${id}-crying.png`) });

  await page.locator('.action-pack-grid button', { hasText: 'Waving' }).click();
  await page.waitForTimeout(420);
  await canvas.screenshot({ path: path.join(outputDir, `${id}-waving.png`) });
}

try {
  await page.goto(appUrl, { waitUntil: 'networkidle' });
  for (const id of characters) await captureCharacter(id);
  await page.locator('.motion-lab-toggle').click();
  await page.getByRole('button', { name: /Speech motion (on|off)/i }).waitFor({ state: 'visible' });
  console.log(`Captured shared behavior-pack states for ${characters.join(', ')}.`);
} finally {
  await browser.close();
}
