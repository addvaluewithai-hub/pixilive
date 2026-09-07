import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const baseUrl = process.env.PIXILIVE_PREVIEW_URL ?? 'http://127.0.0.1:4173';
const outputDir = path.resolve('visual-artifacts');

await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
});

try {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.locator('.character-stage canvas').waitFor({ state: 'visible' });

  const characterSelect = page.locator('#character-select');
  const options = await characterSelect.locator('option').evaluateAll((nodes) =>
    nodes.map((node) => ({
      value: node.value,
      label: node.textContent?.trim() || node.value,
    })),
  );

  if (options.length === 0) {
    throw new Error('No characters found in #character-select');
  }

  for (const option of options) {
    await characterSelect.selectOption(option.value);
    await page.waitForTimeout(700);

    // Exercise the exact interaction that previously revealed the hover-box bug.
    await page.mouse.move(720, 410);
    await page.waitForTimeout(250);

    const safeName = option.value.replace(/[^a-z0-9-_]/gi, '-').toLowerCase();
    const screenshotPath = path.join(outputDir, `${safeName}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`Captured ${option.label} -> ${screenshotPath}`);
  }
} finally {
  await browser.close();
}
