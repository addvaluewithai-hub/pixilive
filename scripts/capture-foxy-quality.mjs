import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const appUrl = process.env.PIXILIVE_PREVIEW_URL ?? 'http://127.0.0.1:4173';
const outputDir = path.resolve('visual-artifacts', 'foxy-v4');
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 900, height: 900 }, deviceScaleFactor: 1 });

async function clickPack(selector, label) {
  await page.evaluate(({ selector, label }) => {
    const button = [...document.querySelectorAll(selector)]
      .find((node) => node.textContent?.includes(label));
    if (!(button instanceof HTMLButtonElement)) throw new Error(`Missing pack button: ${label}`);
    button.click();
  }, { selector, label });
}

async function selectCharacter(id) {
  await page.evaluate((nextId) => {
    const select = document.querySelector('#character-select');
    if (!(select instanceof HTMLSelectElement)) throw new Error('Character select missing');
    select.value = nextId;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }, id);
}

async function resetFoxy() {
  // Character switching clears mood/action state and remounts the Rive runtime.
  await selectCharacter('benny');
  await page.waitForTimeout(90);
  await selectCharacter('foxy');
  await page.waitForTimeout(520);
}

async function shot(stage, name, waitMs = 420) {
  await page.waitForTimeout(waitMs);
  await stage.screenshot({ path: path.join(outputDir, `${name}.png`) });
}

async function mood(stage, label, name, waitMs = 520) {
  await resetFoxy();
  await clickPack('.mood-pack-grid button', label);
  await shot(stage, name, waitMs);
}

async function action(stage, label, name, peakWaitMs = 340) {
  await resetFoxy();
  await clickPack('.mood-pack-grid button', 'Calm');
  await page.waitForTimeout(160);
  await clickPack('.action-pack-grid button', label);
  // Capture near the attack/hold peak, not halfway through release. This makes the
  // QA plate judge the authored pose instead of a translucent transition frame.
  await shot(stage, name, peakWaitMs);
}

try {
  await page.goto(appUrl, { waitUntil: 'networkidle' });
  await page.locator('#character-select').selectOption('foxy');
  const stage = page.locator('.rive-character-stage');
  const canvas = stage.locator('canvas');
  await canvas.waitFor({ state: 'visible' });
  await page.waitForTimeout(900);

  const labLabel = stage.locator('.motion-lab-toggle em');
  await labLabel.waitFor({ state: 'visible' });
  const bindingText = (await labLabel.textContent()) ?? '';
  if (bindingText.includes('NOT BOUND')) throw new Error('Foxy ViewModel is not bound');

  // Turn browser captures into clean 800×800 character plates. Controls remain in
  // the DOM and are triggered programmatically, so QA screenshots contain only art.
  await page.addStyleTag({ content: `
    .brand, .copy, .controls, .motion-lab-toggle, .motion-lab { display: none !important; }
    html, body, #root, .shell, .hero { width: 900px !important; height: 900px !important; min-height: 900px !important; margin: 0 !important; overflow: hidden !important; }
    .hero { display: block !important; position: relative !important; }
    .stage-wrap { position: absolute !important; inset: 50px !important; width: 800px !important; height: 800px !important; margin: 0 !important; }
    .rive-character-stage { width: 800px !important; height: 800px !important; min-height: 800px !important; }
    .rive-character-stage canvas { width: 800px !important; height: 800px !important; }
  ` });
  await page.waitForTimeout(250);

  await mood(stage, 'Calm', '00-neutral-master', 620);
  await mood(stage, 'Happy', '01-happy');
  await mood(stage, 'Sad', '02-sad');
  await action(stage, 'Crying', '03-crying', 420);
  await action(stage, 'Celebrating', '04-celebrating', 320);
  await mood(stage, 'Angry', '05-angry');
  await action(stage, 'Surprised', '06-surprised', 300);
  await mood(stage, 'Sleepy', '07-sleepy');
  await action(stage, 'Laughing', '08-laughing', 330);
  await action(stage, 'Waving', '09-waving', 360);
  await mood(stage, 'Thinking', '10-thinking');
  await mood(stage, 'Curious', '11-curious');
  await mood(stage, 'Excited', '12-excited');
  await action(stage, 'Aha!', '13-aha', 300);
  await action(stage, 'Reassure', '14-reassure', 360);

  console.log('Captured Foxy v4 neutral master and 14 peak readability plates.');
} finally {
  await browser.close();
}
