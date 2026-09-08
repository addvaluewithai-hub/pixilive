import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const harnessUrl = process.env.PIXILIVE_VISUAL_HARNESS_URL ?? 'http://127.0.0.1:4174';
const outputDir = path.resolve('visual-artifacts');
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 720, height: 780 }, deviceScaleFactor: 1 });
const motions = ['touchFace', 'greet', 'celebrate', 'explain'];
const checkpoints = [1, 5, 9, 14, 20, 28, 38, 52];

try {
  await page.goto(harnessUrl, { waitUntil: 'domcontentloaded' });
  const continuity = await page.evaluate(async () => {
    const harness = await import('/src/visual/rig2dHarness.ts');
    return harness.validateMiloMotionContinuity();
  });
  console.log('Milo motion continuity:', continuity);

  for (const motion of motions) {
    for (const frames of checkpoints) {
      await page.goto(harnessUrl, { waitUntil: 'domcontentloaded' });
      await page.evaluate(async ({ motion, frames }) => {
        const harness = await import('/src/visual/rig2dHarness.ts');
        await harness.mountMiloInteractionHarness(motion, frames);
      }, { motion, frames });
      await page.waitForTimeout(35);
      const label = String(frames).padStart(2, '0');
      await page.locator('#rig2d-harness').screenshot({
        path: path.join(outputDir, `milo-motion-${motion}-${label}.png`),
      });
    }
  }
} finally {
  await browser.close();
}
