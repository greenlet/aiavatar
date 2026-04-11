const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  
  const dir = path.join(__dirname, 'screenshots');
  const fs = require('fs');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });
  await page.waitForTimeout(4000);

  // Jake rest
  await page.screenshot({ path: path.join(dir, '1_jake_rest.png') });

  // Jake greeting
  await page.locator('button:has-text("Greeting")').first().click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(dir, '2_jake_greeting.png') });

  // Jake idle
  await page.locator('button:has-text("Standing Idle")').first().click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(dir, '3_jake_idle.png') });

  // Switch to Frank
  await page.locator('button:has-text("Frank")').first().click();
  await page.waitForTimeout(5000);

  // Frank rest
  await page.screenshot({ path: path.join(dir, '4_frank_rest.png') });

  // Frank greeting
  await page.locator('button:has-text("Greeting")').first().click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(dir, '5_frank_greeting.png') });

  // Frank idle
  await page.locator('button:has-text("Standing Idle")').first().click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(dir, '6_frank_idle.png') });

  await browser.close();
  console.log('Done!');
})();
