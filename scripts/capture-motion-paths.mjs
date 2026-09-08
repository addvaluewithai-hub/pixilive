import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const harnessUrl = process.env.PIXILIVE_VISUAL_HARNESS_URL ?? 'http://127.0.0.1:4174';
const outputDir = path.resolve('visual-artifacts');
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 720, height: 780 }, deviceScaleFactor: 1 });
const motions = ['touchFace', 'greet', 'celebrate', 'explain'];
// Entry, safe-unfold, travel, peak, hold, return-unfold and settle are all visible.
const checkpoints = [1, 6, 12, 20, 32, 48, 66, 90, 120, 150];

try {
  // Capture the trajectory first. If a numeric invariant later fails we still
  // want the visual evidence in the artifact instead of losing the bad frames.
  for (const motion of motions) {
    for (const frames of checkpoints) {
      await page.goto(harnessUrl, { waitUntil: 'domcontentloaded' });
      await page.evaluate(async ({ motion, frames }) => {
        const harness = await import('/src/visual/rig2dHarness.ts');
        await harness.mountMiloInteractionHarness(motion, frames);
      }, { motion, frames });
      await page.waitForTimeout(35);
      const label = String(frames).padStart(3, '0');
      await page.locator('#rig2d-harness').screenshot({
        path: path.join(outputDir, `milo-motion-${motion}-${label}.png`),
      });
    }
  }

  await page.goto(harnessUrl, { waitUntil: 'domcontentloaded' });
  const anatomy = await page.evaluate(async () => {
    const harness = await import('/src/visual/rig2dHarness.ts');
    return harness.validateMiloAnatomicalBends();
  });
  console.log('Milo anatomical bend validation:', anatomy);

  const continuity = await page.evaluate(async () => {
    const harness = await import('/src/visual/rig2dHarness.ts');
    return harness.validateMiloMotionContinuity();
  });
  console.log('Milo motion continuity:', continuity);
} finally {
  await browser.close();
}
