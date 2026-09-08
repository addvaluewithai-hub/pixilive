import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const harnessUrl = process.env.PIXILIVE_VISUAL_HARNESS_URL ?? 'http://127.0.0.1:4174';
const outputDir = path.resolve('visual-artifacts');
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 760, height: 760 }, deviceScaleFactor: 1 });

const neutralCue = { affect: 'neutral', intensity: 0.5, gesture: 'none', posture: 'neutral', gaze: 'user' };
const faceCases = {
  happy: { emotion: 'happy', mode: 'idle' },
  warm: { emotion: 'calm', cue: { affect: 'warm', intensity: 0.92, gesture: 'none', posture: 'engaged', gaze: 'user' }, mode: 'listening' },
  curious: { emotion: 'calm', cue: { affect: 'curious', intensity: 0.92, gesture: 'none', posture: 'engaged', gaze: 'user' }, mode: 'thinking' },
  enthusiastic: { emotion: 'calm', cue: { affect: 'enthusiastic', intensity: 0.94, gesture: 'none', posture: 'open', gaze: 'user' }, mode: 'thinking' },
  reassuring: { emotion: 'calm', cue: { affect: 'reassuring', intensity: 0.92, gesture: 'none', posture: 'lean_in', gaze: 'user' }, mode: 'listening' },
  concerned: { emotion: 'calm', cue: { affect: 'concerned', intensity: 0.94, gesture: 'none', posture: 'lean_in', gaze: 'user' }, mode: 'thinking' },
  surprised: { emotion: 'calm', cue: { affect: 'surprised', intensity: 0.96, gesture: 'none', posture: 'neutral', gaze: 'user' }, mode: 'thinking' },
  thoughtful: { emotion: 'calm', cue: { affect: 'thoughtful', intensity: 0.92, gesture: 'none', posture: 'lean_back', gaze: 'thinking_side' }, mode: 'thinking' },
  playful: { emotion: 'calm', cue: { affect: 'playful', intensity: 0.94, gesture: 'none', posture: 'engaged', gaze: 'user' }, mode: 'listening' },
};

const openPose = {
  open: 0.74,
  width: 0.66,
  round: 0.08,
  energy: 0.82,
  viseme: 'AA',
  lipPress: 0,
  lowerLipBite: 0,
  teeth: 0.18,
  tongue: 0.42,
  cornerPull: 0.3,
};
const mouthFrames = [1, 2, 3, 5, 8, 12, 18, 26];
const tailFrames = [1, 18, 36, 54, 72, 90];

try {
  for (const [name, input] of Object.entries(faceCases)) {
    await page.goto(harnessUrl, { waitUntil: 'domcontentloaded' });
    await page.evaluate(async (value) => {
      const harness = await import('/src/visual/novaQaHarness.ts');
      await harness.mountNovaFaceHarness({ ...value, frames: 66 });
    }, input);
    await page.waitForTimeout(45);
    await page.locator('#nova-face-harness').screenshot({ path: path.join(outputDir, `nova-face-${name}.png`) });
  }

  for (const frames of mouthFrames) {
    await page.goto(harnessUrl, { waitUntil: 'domcontentloaded' });
    await page.evaluate(async ({ frames, pose }) => {
      const harness = await import('/src/visual/novaQaHarness.ts');
      await harness.mountNovaMouthTransitionHarness({ frames, pose });
    }, { frames, pose: openPose });
    await page.waitForTimeout(35);
    const label = String(frames).padStart(2, '0');
    await page.locator('#nova-mouth-harness').screenshot({ path: path.join(outputDir, `nova-mouth-open-${label}.png`) });
  }

  // Tail/whole-body strip: neutral idle at deterministic frame counts.
  for (const frames of tailFrames) {
    await page.goto(harnessUrl, { waitUntil: 'domcontentloaded' });
    await page.evaluate(async ({ cue, frames }) => {
      const harness = await import('/src/visual/novaPerformanceHarness.ts');
      await harness.mountNovaPerformanceHarness(cue, 'idle', frames);
    }, { cue: neutralCue, frames });
    await page.waitForTimeout(35);
    const label = String(frames).padStart(2, '0');
    await page.locator('#nova-performance-harness').screenshot({ path: path.join(outputDir, `nova-tail-idle-${label}.png`) });
  }
} finally {
  await browser.close();
}
