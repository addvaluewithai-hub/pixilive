import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const appUrl = process.env.PIXILIVE_PREVIEW_URL ?? 'http://127.0.0.1:4173';
const outputDir = path.resolve('visual-artifacts');
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });

try {
  await page.goto(appUrl, { waitUntil: 'networkidle' });
  const characterSelect = page.locator('#character-select');
  await characterSelect.selectOption('kiro');
  await page.locator('.rive-character-stage canvas').waitFor({ state: 'visible' });
  await page.waitForTimeout(900);

  const canvas = page.locator('.rive-character-stage canvas');
  await canvas.screenshot({ path: path.join(outputDir, 'kiro-calm.png') });

  await page.locator('.mood-pack-grid button', { hasText: 'Happy' }).click();
  await page.waitForTimeout(350);
  await canvas.screenshot({ path: path.join(outputDir, 'kiro-happy.png') });

  await page.locator('.mood-pack-grid button', { hasText: 'Thinking' }).click();
  await page.waitForTimeout(350);
  await canvas.screenshot({ path: path.join(outputDir, 'kiro-thinking.png') });

  await page.locator('.action-pack-grid button', { hasText: 'Celebrate' }).click();
  await page.waitForTimeout(430);
  await canvas.screenshot({ path: path.join(outputDir, 'kiro-celebrate.png') });

  await page.locator('.action-pack-grid button', { hasText: 'Cry' }).click();
  await page.waitForTimeout(600);
  await canvas.screenshot({ path: path.join(outputDir, 'kiro-cry.png') });

  await page.locator('.motion-lab-toggle').click();
  const speechMotionButton = page.getByRole('button', { name: /Speech motion (on|off)/i });
  await speechMotionButton.waitFor({ state: 'visible' });

  console.log('Captured calm, happy, thinking, celebrate and cry behavior-pack states; universal performance engine control is present.');
} finally {
  await browser.close();
}
