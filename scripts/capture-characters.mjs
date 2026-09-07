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

const visemePoses = {
  mbp: { open: 0.01, width: 0.4, round: 0.03, energy: 0.65, viseme: 'MBP', lipPress: 1, teeth: 0, tongue: 0, cornerPull: 0.04 },
  fv: { open: 0.17, width: 0.56, round: 0.02, energy: 0.62, viseme: 'FV', lowerLipBite: 0.95, teeth: 0.8, tongue: 0, cornerPull: 0.2 },
  ee: { open: 0.3, width: 0.9, round: 0.01, energy: 0.72, viseme: 'EE', teeth: 0.52, tongue: 0.04, cornerPull: 0.82 },
  aa: { open: 0.8, width: 0.68, round: 0.08, energy: 0.78, viseme: 'AA', teeth: 0.18, tongue: 0.45, cornerPull: 0.28 },
  oh: { open: 0.68, width: 0.42, round: 0.76, energy: 0.72, viseme: 'OH', teeth: 0.1, tongue: 0.18, cornerPull: 0.05 },
  oo: { open: 0.45, width: 0.29, round: 0.98, energy: 0.68, viseme: 'OO', teeth: 0.03, tongue: 0.04, cornerPull: 0 },
  l: { open: 0.42, width: 0.61, round: 0.04, energy: 0.66, viseme: 'L', teeth: 0.34, tongue: 0.88, cornerPull: 0.32 },
};

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

  for (const [name, pose] of Object.entries(visemePoses)) {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await page.evaluate(async (mouthPose) => {
      const harness = await import('/src/visual/visemeHarness.ts');
      await harness.mountMiloVisemeHarness(mouthPose);
    }, pose);
    await page.waitForTimeout(150);
    const screenshotPath = path.join(outputDir, `milo-viseme-${name}.png`);
    await page.locator('#viseme-harness').screenshot({ path: screenshotPath });
    console.log(`Captured Milo ${name.toUpperCase()} viseme -> ${screenshotPath}`);
  }
} finally {
  await browser.close();
}
