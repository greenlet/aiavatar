/**
 * Download Mixamo animations via Playwright.
 *
 * Usage:
 *   node download_mixamo.mjs
 *
 * The browser stays open so you can log in manually. Once logged in,
 * press Enter in the terminal and the script will download each animation.
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import readline from 'readline';

const DEST_DIR = path.join(import.meta.dirname, 'models', 'animations');

// Animations to download — exact Mixamo animation name → local filename
// Use the exact title shown under the thumbnail on mixamo.com
const ANIMATIONS = [
  { search: 'Shrug',                name: 'shrug' },
  { search: 'Pointing',             name: 'pointing' },
  { search: 'Clapping',             name: 'clapping' },
  { search: 'Agreeing',             name: 'agreeing' },
  { search: 'Disappointed',         name: 'disappointed' },
  { search: 'Excited',              name: 'excited' },
  { search: 'Thankful',             name: 'thankful' },
  { search: 'Salute',               name: 'salute' },
  { search: 'Weight Shift',         name: 'weight_shift' },
  { search: 'Talking',              name: 'talking' },
];

function askUser(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (ans) => { rl.close(); resolve(ans); }));
}

async function dismissCookieBanner(page) {
  // Mixamo shows a cookie consent banner — dismiss it once
  const enableAll = page.getByRole('button', { name: 'Enable all' });
  if (await enableAll.isVisible({ timeout: 2000 }).catch(() => false)) {
    await enableAll.click();
    console.log('  Dismissed cookie banner.');
    await page.waitForTimeout(1000);
  }
}

async function searchAnimation(page, searchTerm) {
  const searchInput = page.locator('input[type="search"]').first();
  await searchInput.click();
  await searchInput.press('Meta+a');
  await page.waitForTimeout(200);
  await searchInput.fill(searchTerm);
  await searchInput.press('Enter');
  await page.waitForTimeout(3000);
}

// Words that indicate a pose unsuitable for a standing conversational avatar
const REJECT_WORDS = /\b(lay|lying|laying|kneel|kneeling|seated|sitting|crouch|crouching|prone|floor|ground|crawl|dead|dying|zombie)\b/i;

async function selectBestResult(page, searchTerm) {
  // Close any open dropdown/genre panel by clicking on the main content area
  await page.mouse.click(400, 400);
  await page.waitForTimeout(500);

  // Find all animation card labels — generic approach using position
  // Cards are in the left panel (x < 640), below search bar (y > 90)
  const labels = await page.evaluate(() => {
    const results = [];
    document.querySelectorAll('p, span').forEach((el, globalIdx) => {
      const text = el.textContent?.trim();
      if (!text || text.length < 3 || text.length > 60) return;
      if (el.children.length > 0) return; // skip container elements
      const r = el.getBoundingClientRect();
      if (r.left < 640 && r.top > 80 && r.width > 30 && r.height > 5 && r.height < 40) {
        // Find the nearest clickable ancestor that looks like a card
        let card = el.parentElement;
        for (let i = 0; i < 5 && card; i++) {
          const cr = card.getBoundingClientRect();
          if (cr.width > 100 && cr.height > 100) break;
          card = card.parentElement;
        }
        results.push({ text, index: results.length, globalIdx });
      }
    });
    return results;
  });

  // Filter to likely animation names (skip nav, footer, genre labels)
  const SKIP = /^(combat|adventure|sport|dance|fantasy|superhero|skinning|privacy|terms|cookie|animation genre)/i;
  const animLabels = labels.filter(l => !SKIP.test(l.text));
  console.log('  Results:', animLabels.map(l => l.text).slice(0, 10).join(', ') || '(none)');

  if (animLabels.length === 0) throw new Error('No animation cards found');

  // Score each result
  const lowerSearch = searchTerm.toLowerCase();
  let best = null;
  let bestScore = -Infinity;

  for (const label of animLabels) {
    const t = label.text.toLowerCase();
    if (REJECT_WORDS.test(t)) continue;

    let score = 0;
    if (t === lowerSearch || t === lowerSearch + 'ing' || t + 'ing' === lowerSearch) score += 100;
    else if (t.startsWith(lowerSearch)) score += 50;
    else if (t.includes(lowerSearch)) score += 30;
    score -= t.length;

    if (score > bestScore) {
      bestScore = score;
      best = label;
    }
  }

  if (!best) {
    best = animLabels.find(l => !REJECT_WORDS.test(l.text)) || animLabels[0];
  }

  // Click the card: find the label element again and click its card ancestor
  const clicked = await page.evaluate((targetText) => {
    const allEls = document.querySelectorAll('p, span');
    for (const el of allEls) {
      if (el.textContent?.trim() === targetText && el.children.length === 0) {
        const r = el.getBoundingClientRect();
        if (r.left >= 640 || r.top < 80) continue;
        // Walk up to find a clickable card container
        let card = el.parentElement;
        for (let i = 0; i < 5 && card; i++) {
          const cr = card.getBoundingClientRect();
          if (cr.width > 100 && cr.height > 100) {
            card.click();
            return targetText;
          }
          card = card.parentElement;
        }
        // Fallback: just click the label itself
        el.click();
        return targetText + ' (label click)';
      }
    }
    return null;
  }, best.text);

  if (!clicked) throw new Error(`Failed to click card for "${best.text}"`);
  console.log(`  Selected: "${clicked}" (score: ${bestScore})`);
  await page.waitForTimeout(2000);
}

async function downloadAnimation(page, destPath) {
  // 1. Click the orange DOWNLOAD button in the right panel (opens the dialog)
  await page.evaluate(() => {
    const els = document.querySelectorAll('a, button');
    for (const el of els) {
      if (el.textContent?.trim().toUpperCase() === 'DOWNLOAD') {
        const r = el.getBoundingClientRect();
        if (r.right > 900) { el.click(); return; }
      }
    }
  });
  console.log('  Opened download dialog...');
  await page.waitForTimeout(2000);

  // 2. Set Skin dropdown to "Without Skin"
  const skinSelect = page.locator('select').filter({ has: page.locator('option', { hasText: 'Without Skin' }) });
  if (await skinSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
    await skinSelect.selectOption({ label: 'Without Skin' });
    console.log('  Set skin to "Without Skin"');
    await page.waitForTimeout(500);
  }

  // 3. Listen for the S3 download URL — it's a signed URL we can re-fetch
  let downloadUrl = null;
  const responseHandler = (resp) => {
    const url = resp.url();
    if (url.includes('mixamo-storage') && url.includes('export')) {
      if (!downloadUrl) downloadUrl = url; // capture the first one
    }
  };
  page.on('response', responseHandler);

  // Also accept Playwright download event in case it does fire
  const downloadPromise = page.waitForEvent('download', { timeout: 1000 }).catch(() => null);

  // 4. Click the modal's DOWNLOAD button
  const btns = page.locator('a, button').filter({ hasText: /^DOWNLOAD$/i });
  const count = await btns.count();
  console.log(`  Found ${count} DOWNLOAD button(s), clicking last (modal)...`);
  const target = count > 1 ? btns.last() : btns.first();
  await target.click({ force: true });

  // 5. Wait for export URL to appear
  console.log('  Waiting for Mixamo to process export...');
  const start = Date.now();

  // First check if the standard download event fires
  const dl = await downloadPromise;
  if (dl) {
    await dl.saveAs(destPath);
    console.log(`  ✓ Saved (download event): ${destPath}`);
    page.off('response', responseHandler);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);
    return;
  }

  while (Date.now() - start < 120000) {
    if (downloadUrl) break;
    await page.waitForTimeout(2000);
    process.stdout.write('.');
  }
  console.log('');

  page.off('response', responseHandler);

  if (!downloadUrl) {
    await page.screenshot({ path: path.join(DEST_DIR, `_debug_${path.basename(destPath, '.fbx')}.png`) });
    throw new Error('No export URL captured');
  }

  console.log(`  Got URL: ${downloadUrl.substring(0, 100)}...`);

  // 6. Re-fetch the signed S3 URL
  const resp = await page.request.get(downloadUrl);
  if (!resp.ok()) throw new Error(`Re-fetch failed: ${resp.status()}`);
  const fbxBuffer = await resp.body();

  if (fbxBuffer.length < 1000) {
    throw new Error(`File too small: ${fbxBuffer.length} bytes`);
  }

  fs.writeFileSync(destPath, fbxBuffer);
  console.log(`  ✓ Saved: ${destPath} (${(fbxBuffer.length / 1024).toFixed(0)} KB)`);

  // Close modal
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1000);
}

(async () => {
  fs.mkdirSync(DEST_DIR, { recursive: true });

  console.log('Launching browser with your Chrome profile (make sure Chrome is fully closed)...');
  const userDataDir = '/tmp/chrome-mixamo';
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    slowMo: 100,
    acceptDownloads: true,
    channel: 'chrome',            // use installed Chrome, not bundled Chromium
    args: ['--disable-blink-features=AutomationControlled'],
  });
  const page = context.pages()[0] || await context.newPage();

  await page.goto('https://www.mixamo.com/#/', { waitUntil: 'domcontentloaded' });
  console.log('Waiting for Mixamo to load (should be already logged in)...');
  await page.waitForTimeout(4000);
  console.log('Press Enter when the animation library is visible.\n');
  await askUser('Press Enter when ready...');

  console.log('Checking Mixamo is ready...');
  await page.waitForTimeout(2000);

  // Dismiss cookie consent banner if present
  await dismissCookieBanner(page);

  // Log page structure for debugging
  const pageInfo = await page.evaluate(() => {
    const html = document.body.innerHTML.substring(0, 2000);
    const inputs = [...document.querySelectorAll('input')].map(i => ({
      type: i.type, placeholder: i.placeholder, className: i.className?.substring(0, 40)
    }));
    return { inputs, bodySnippet: html.substring(0, 500) };
  });
  console.log('Page inputs:', JSON.stringify(pageInfo.inputs));

  for (let i = 0; i < ANIMATIONS.length; i++) {
    const anim = ANIMATIONS[i];
    const destPath = path.join(DEST_DIR, `${anim.name}.fbx`);

    if (fs.existsSync(destPath)) {
      console.log(`[${i + 1}/${ANIMATIONS.length}] SKIP (exists): ${anim.name}`);
      continue;
    }

    console.log(`\n[${i + 1}/${ANIMATIONS.length}] Searching: "${anim.search}" → ${anim.name}.fbx`);

    try {
      await searchAnimation(page, anim.search);
      await selectBestResult(page, anim.search);
      await downloadAnimation(page, destPath);
    } catch (err) {
      console.error(`  ✗ FAILED: ${anim.name} — ${err.message}`);
      await page.screenshot({ path: path.join(DEST_DIR, `error_${anim.name}.png`) });
      console.log(`  Screenshot saved: error_${anim.name}.png`);
      
      // Press Escape to dismiss any dialogs
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
      
      const answer = await askUser('  Continue with next? (y/n) ');
      if (answer.toLowerCase() === 'n') break;
    }
  }

  console.log('\n=== Download session complete ===');
  const answer = await askUser('Close browser? (y/n) ');
  if (answer.toLowerCase() === 'y') {
    await context.close();
  } else {
    console.log('Browser left open. Press Ctrl+C to exit.');
    await new Promise(() => {});
  }
})();
