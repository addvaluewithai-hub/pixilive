import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const appUrl = process.env.PIXILIVE_PREVIEW_URL ?? 'http://127.0.0.1:4173';
const harnessUrl = process.env.PIXILIVE_VISUAL_HARNESS_URL ?? 'http://127.0.0.1:4174';
const outputDir = path.resolve('visual-artifacts');

await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });

const visemePoses = {
  mbp: { open: 0.01, width: 0.4, round: 0.03, energy: 0.65, viseme: 'MBP', lipPress: 1, teeth: 0, tongue: 0, cornerPull: 0.04 },
  fv: { open: 0.17, width: 0.56, round: 0.02, energy: 0.62, viseme: 'FV', lowerLipBite: 0.95, teeth: 0.8, tongue: 0, cornerPull: 0.2 },
  ee: { open: 0.3, width: 0.9, round: 0.01, energy: 0.72, viseme: 'EE', teeth: 0.52, tongue: 0.04, cornerPull: 0.82 },
  aa: { open: 0.8, width: 0.68, round: 0.08, energy: 0.78, viseme: 'AA', teeth: 0.18, tongue: 0.45, cornerPull: 0.28 },
  oh: { open: 0.68, width: 0.42, round: 0.76, energy: 0.72, viseme: 'OH', teeth: 0.1, tongue: 0.18, cornerPull: 0.05 },
  oo: { open: 0.45, width: 0.29, round: 0.98, energy: 0.68, viseme: 'OO', teeth: 0.03, tongue: 0.04, cornerPull: 0 },
  l: { open: 0.42, width: 0.61, round: 0.04, energy: 0.66, viseme: 'L', teeth: 0.34, tongue: 0.88, cornerPull: 0.32 },
};

const performanceCases = {
  explain: { cue: { affect: 'enthusiastic', intensity: 0.68, gesture: 'explain', posture: 'engaged', gaze: 'user' }, mode: 'speaking', frames: 58 },
  emphasize: { cue: { affect: 'neutral', intensity: 0.7, gesture: 'emphasize', posture: 'engaged', gaze: 'user' }, mode: 'speaking', frames: 46 },
  reassure: { cue: { affect: 'reassuring', intensity: 0.55, gesture: 'reassure', posture: 'lean_in', gaze: 'user' }, mode: 'speaking', frames: 58 },
  think: { cue: { affect: 'thoughtful', intensity: 0.58, gesture: 'think', posture: 'lean_back', gaze: 'thinking_up' }, mode: 'thinking', frames: 60 },
  celebrate: { cue: { affect: 'enthusiastic', intensity: 0.86, gesture: 'celebrate', posture: 'open', gaze: 'user' }, mode: 'speaking', frames: 54 },
  shrug: { cue: { affect: 'playful', intensity: 0.65, gesture: 'shrug', posture: 'open', gaze: 'user' }, mode: 'speaking', frames: 54 },
  agree: { cue: { affect: 'warm', intensity: 0.62, gesture: 'agree', posture: 'engaged', gaze: 'user' }, mode: 'speaking', frames: 44 },
  disagree: { cue: { affect: 'concerned', intensity: 0.62, gesture: 'disagree', posture: 'engaged', gaze: 'user' }, mode: 'speaking', frames: 44 },
  greet: { cue: { affect: 'warm', intensity: 0.72, gesture: 'greet', posture: 'open', gaze: 'user' }, mode: 'speaking', frames: 48 },
  warm: { cue: { affect: 'warm', intensity: 0.7, gesture: 'none', posture: 'engaged', gaze: 'user' }, mode: 'listening', frames: 48 },
  curious: { cue: { affect: 'curious', intensity: 0.72, gesture: 'none', posture: 'engaged', gaze: 'user' }, mode: 'thinking', frames: 44 },
  enthusiastic: { cue: { affect: 'enthusiastic', intensity: 0.78, gesture: 'none', posture: 'open', gaze: 'user' }, mode: 'speaking', frames: 38 },
  playful: { cue: { affect: 'playful', intensity: 0.75, gesture: 'none', posture: 'engaged', gaze: 'user' }, mode: 'speaking', frames: 38 },
  concerned: { cue: { affect: 'concerned', intensity: 0.72, gesture: 'none', posture: 'lean_in', gaze: 'user' }, mode: 'speaking', frames: 38 },
  surprised: { cue: { affect: 'surprised', intensity: 0.78, gesture: 'none', posture: 'neutral', gaze: 'user' }, mode: 'speaking', frames: 38 },
  listening: { cue: { affect: 'warm', intensity: 0.42, gesture: 'none', posture: 'engaged', gaze: 'user' }, mode: 'listening', frames: 150 },
};

const autonomousCases = {
  enthusiastic: { transcript: 'This is absolutely amazing! I love how well this works.', dynamics: { energy: 0.82, pitchHz: 220, pitchNorm: 0.62, pitchDelta: 0.22, brightness: 0.58, voiced: 0.8, onset: 0.44 }, frames: 88 },
  reassuring: { transcript: "Don't worry, we can fix this and it will be okay.", dynamics: { energy: 0.42, pitchHz: 145, pitchNorm: 0.31, pitchDelta: -0.08, brightness: 0.3, voiced: 0.78, onset: 0.2 }, frames: 88 },
  curious: { transcript: 'Interesting — why would that happen?', dynamics: { energy: 0.58, pitchHz: 195, pitchNorm: 0.52, pitchDelta: 0.34, brightness: 0.5, voiced: 0.74, onset: 0.4 }, frames: 88 },
  arabicWarm: { transcript: 'أكيد، نقدر نحل الموضوع ده مع بعض.', dynamics: { energy: 0.46, pitchHz: 158, pitchNorm: 0.36, pitchDelta: 0.03, brightness: 0.34, voiced: 0.77, onset: 0.28 }, frames: 88 },
};

const rigInteractionCases = ['rest', 'point', 'reach', 'touchFace', 'openArms', 'unreachable'];

try {
  await page.goto(appUrl, { waitUntil: 'networkidle' });
  await page.locator('.character-stage canvas').waitFor({ state: 'visible' });

  const characterSelect = page.locator('#character-select');
  const options = await characterSelect.locator('option').evaluateAll((nodes) => nodes.map((node) => ({ value: node.value, label: node.textContent?.trim() || node.value })));
  if (options.length === 0) throw new Error('No characters found in #character-select');

  for (const option of options) {
    await characterSelect.selectOption(option.value);
    await page.waitForTimeout(700);
    await page.mouse.move(720, 410);
    await page.waitForTimeout(250);
    const safeName = option.value.replace(/[^a-z0-9-_]/gi, '-').toLowerCase();
    const screenshotPath = path.join(outputDir, `${safeName}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`Captured ${option.label} -> ${screenshotPath}`);
  }

  for (const [name, pose] of Object.entries(visemePoses)) {
    await page.goto(harnessUrl, { waitUntil: 'domcontentloaded' });
    await page.evaluate(async (mouthPose) => {
      const harness = await import('/src/visual/visemeHarness.ts');
      await harness.mountMiloVisemeHarness(mouthPose);
    }, pose);
    await page.waitForTimeout(120);
    const screenshotPath = path.join(outputDir, `milo-viseme-${name}.png`);
    await page.locator('#viseme-harness').screenshot({ path: screenshotPath });
  }

  for (const [name, testCase] of Object.entries(performanceCases)) {
    await page.goto(harnessUrl, { waitUntil: 'domcontentloaded' });
    await page.evaluate(async ({ cue, mode, frames }) => {
      const harness = await import('/src/visual/performanceHarness.ts');
      await harness.mountMiloPerformanceHarness(cue, mode, frames);
    }, testCase);
    await page.waitForTimeout(120);
    const screenshotPath = path.join(outputDir, `milo-performance-${name}.png`);
    await page.locator('#performance-harness').screenshot({ path: screenshotPath });
  }

  for (const [name, testCase] of Object.entries(autonomousCases)) {
    await page.goto(harnessUrl, { waitUntil: 'domcontentloaded' });
    await page.evaluate(async (input) => {
      const harness = await import('/src/visual/autonomousPerformanceHarness.ts');
      await harness.mountMiloAutonomousPerformanceHarness(input);
    }, testCase);
    await page.waitForTimeout(120);
    const screenshotPath = path.join(outputDir, `milo-autonomous-${name}.png`);
    await page.locator('#autonomous-performance-harness').screenshot({ path: screenshotPath });
  }

  await page.goto(harnessUrl, { waitUntil: 'domcontentloaded' });
  const rigValidation = await page.evaluate(async () => {
    const harness = await import('/src/visual/rig2dHarness.ts');
    return harness.validateRig2DInvariants();
  });
  console.log(`Rig2D invariant validation passed for ${rigValidation.bones.length} bones`);

  for (const interaction of rigInteractionCases) {
    await page.goto(harnessUrl, { waitUntil: 'domcontentloaded' });
    await page.evaluate(async (name) => {
      const harness = await import('/src/visual/rig2dHarness.ts');
      await harness.mountMiloInteractionHarness(name, 90);
    }, interaction);
    await page.waitForTimeout(120);
    const screenshotPath = path.join(outputDir, `milo-rig2d-${interaction}.png`);
    await page.locator('#rig2d-harness').screenshot({ path: screenshotPath });
  }
} finally {
  await browser.close();
}
