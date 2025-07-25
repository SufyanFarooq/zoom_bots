import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import AnonymizeUAPlugin from 'puppeteer-extra-plugin-anonymize-ua';
import RecaptchaPlugin from 'puppeteer-extra-plugin-recaptcha';

puppeteer.use(StealthPlugin());
puppeteer.use(AnonymizeUAPlugin());
puppeteer.use(
  RecaptchaPlugin({
    provider: { id: '2captcha', token: 'YOUR_2CAPTCHA_API_KEY' }, // Optional: add your 2captcha API key for auto-solving captchas
    visualFeedback: true
  })
);

function getRandomName() {
  const names = [
    'Ali', 'Sara', 'Omar', 'Ayesha', 'Zain', 'Fatima', 'Usman', 'Hira', 'Bilal', 'Mina',
    'Hamza', 'Noor', 'Danish', 'Iqra', 'Saad', 'Sana', 'Raza', 'Mariam', 'Tariq', 'Laila'
  ];
  return names[Math.floor(Math.random() * names.length)] + Math.floor(Math.random() * 1000);
}

async function handleCookieDialogs(page) {
  // Try to accept cookie dialogs if present
  try {
    // Common cookie button selectors
    const cookieSelectors = [
      'button#onetrust-accept-btn-handler', // OneTrust
      'button[aria-label="Accept cookies"]',
      'button:contains("Accept All")',
      'button:contains("I Agree")',
      'button:contains("Allow all cookies")',
    ];
    for (const sel of cookieSelectors) {
      const btn = await page.$(sel);
      if (btn) {
        await btn.click();
        await page.waitForTimeout(500);
      }
    }
  } catch (e) {
    // Ignore errors
  }
}

async function waitForAnySelector(page, selectors, timeout = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    for (const sel of selectors) {
      const el = await page.$(sel);
      if (el) return sel;
    }
    await page.waitForTimeout(300);
  }
  throw new Error('None of the selectors found: ' + selectors.join(', '));
}

// Helper to find button by visible text
async function findButtonByText(page, text) {
  const buttons = await page.$$('button');
  for (const btn of buttons) {
    const btnText = await page.evaluate(el => el.innerText, btn);
    if (btnText && btnText.trim().toLowerCase() === text.toLowerCase()) {
      return btn;
    }
  }
  return null;
}

export async function joinBots(meetingId, password, botCount = 1, joinUrl = null) {
  const results = [];
  const browser = await puppeteer.launch({
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1280,800'
    ]
  });
  const joinPromises = [];

  for (let i = 0; i < botCount; i++) {
    const name = getRandomName();
    joinPromises.push(
      (async () => {
        let page, context;
        if (typeof browser.createIncognitoBrowserContext === 'function') {
          context = await browser.createIncognitoBrowserContext();
          page = await context.newPage();
        } else {
          page = await browser.newPage();
        }
        try {
          await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
          const url = joinUrl ? joinUrl : `https://zoom.us/wc/join/${meetingId}`;
          await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
          await handleCookieDialogs(page);

          // Try to solve captchas if present
          try {
            const { captchas, solutions, solved, error } = await page.solveRecaptchas();
            if (error) {
              console.log('Captcha solve error:', error);
            } else if (solved && solved.length > 0) {
              console.log('Solved captchas:', solved.length);
            }
          } catch (e) {
            console.log('No captcha found or solveRecaptchas error:', e.message);
          }

          // Wait for spinner to disappear (try common selectors)
          try {
            await page.waitForFunction(
              () => !document.querySelector('.loading-spinner, .spinner, div[role="status"]'),
              { timeout: 40000 }
            );
          } catch (e) {
            // Spinner may not be present, continue
          }

          // Try multiple selectors for name input
          const nameSelectors = [
            '#inputname',
            'input#inputname',
            'input[name="username"]',
            'input[placeholder*="name"]',
            'input', // fallback
          ];
          let nameSelector;
          try {
            nameSelector = await waitForAnySelector(page, nameSelectors, 20000);
          } catch (e) {
            await page.screenshot({ path: `zoom_debug_nameinput_${name}.png` });
            throw new Error('Name input not found. Screenshot saved. Try manually joining the meeting in browser to check for captchas or popups.');
          }
          await page.type(nameSelector, name);

          // Improved join button detection
          let joinBtn = await page.$('#joinBtn');
          if (!joinBtn) joinBtn = await page.$('button[type="submit"]');
          if (!joinBtn) joinBtn = await findButtonByText(page, 'Join');
          if (!joinBtn) {
            await page.screenshot({ path: `zoom_debug_joinbtn_${name}.png` });
            throw new Error('Join button not found. Screenshot saved.');
          }
          await joinBtn.click();

          // Enter password if prompted
          const passSelectors = [
            '#inputpasscode',
            'input#inputpasscode',
            'input[name="passcode"]',
            'input[placeholder*="passcode"]',
            'input[placeholder*="Password"]',
            'input', // fallback
          ];
          try {
            const passSelector = await waitForAnySelector(page, passSelectors, 15000);
            await page.type(passSelector, password);
            await joinBtn.click();
          } catch (e) {
            // Password prompt may not appear if not required
          }
          // Wait for join confirmation or error
          await page.waitForTimeout(8000);
          results.push({ name, status: 'joined' });
        } catch (err) {
          results.push({ name, status: 'failed', error: err.message });
        } finally {
          await page.close();
          if (context) await context.close();
        }
      })()
    );
  }
  await Promise.all(joinPromises);
  await browser.close();
  return { results };
} 