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

  await page.locator('.emotion-grid button', { hasText: 'happy' }).click();
  await page.waitForTimeout(250);
  await canvas.screenshot({ path: path.join(outputDir, 'kiro-happy.png') });

  await page.locator('.emotion-grid button', { hasText: 'curious' }).click();
  await page.mouse.move(860, 280);
  await page.waitForTimeout(250);
  await canvas.screenshot({ path: path.join(outputDir, 'kiro-curious-gaze.png') });

  await page.locator('.motion-lab-toggle').click();
  const bodyAiButton = page.getByRole('button', { name: /Body AI (on|off)/i });
  await bodyAiButton.waitFor({ state: 'visible' });
  const motionButton = page.getByRole('button', { name: /Motion sweep/i });
  await motionButton.click();
  await page.waitForTimeout(700);
  await canvas.screenshot({ path: path.join(outputDir, 'kiro-motion-sweep.png') });

  console.log('Captured clean Kiro calm, happy, curious gaze, and motion sweep states; Body AI control is present.');
} finally {
  await browser.close();
}
