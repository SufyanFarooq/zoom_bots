import puppeteer from 'puppeteer-core';
import fs from 'fs';

let activeBrowsers = [];
let activePages = [];
let isClosing = false;

function getChromeExecutablePath() {
  const envPath = (process.env.CHROME_PATH || '').trim();
  if (envPath) return envPath;

  const candidates = [];
  if (process.platform === 'darwin') {
    candidates.push('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
    candidates.push('/Applications/Chromium.app/Contents/MacOS/Chromium');
  } else if (process.platform === 'win32') {
    candidates.push('C:/Program Files/Google/Chrome/Application/chrome.exe');
    candidates.push('C:/Program Files (x86)/Google/Chrome/Application/chrome.exe');
  } else {
    // Linux
    candidates.push('/usr/bin/google-chrome-stable');
    candidates.push('/usr/bin/google-chrome');
    candidates.push('/usr/bin/chromium');
    candidates.push('/usr/bin/chromium-browser');
    candidates.push('/snap/bin/chromium');
    candidates.push('/opt/google/chrome/chrome');
  }

  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p;
    } catch {}
  }
  // Fallback to a generic name; Puppeteer will likely fail with a clearer error if not installed
  return process.platform === 'win32' ? 'chrome.exe' : 'google-chrome';
}

// Function to generate real user names
function generateRealName() {
  const firstNames = [
    'Ali', 'Sara', 'Omar', 'Ayesha', 'Zain', 'Fatima', 'Usman', 'Hira', 'Bilal', 'Mina',
    'Hamza', 'Noor', 'Danish', 'Iqra', 'Saad', 'Sana', 'Raza', 'Mariam', 'Tariq', 'Laila',
    'Ahmed', 'Zara', 'Hassan', 'Aisha', 'Yusuf', 'Khadija', 'Ibrahim', 'Maryam', 'Khalid', 'Amina',
    'Abdullah', 'Fatima', 'Muhammad', 'Zainab', 'Yasin', 'Hafsa', 'Mustafa', 'Ayesha', 'Junaid', 'Sadia'
  ];
  
  const lastNames = [
    'Khan', 'Ahmed', 'Ali', 'Hassan', 'Hussain', 'Malik', 'Raza', 'Shah', 'Farooq', 'Iqbal',
    'Saleem', 'Rashid', 'Nadeem', 'Saeed', 'Waqar', 'Tariq', 'Usman', 'Bilal', 'Danish', 'Saad'
  ];
  
  const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
  const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
  const randomNumber = Math.floor(Math.random() * 9999) + 1000;
  
  return `${firstName}_${lastName}_${randomNumber}`;
}

export async function joinZoomMeeting(meetingNumber, passWord, userName, keepAliveMinutes = 0) {
  let browser;
  let page;
  try {
    console.log(`Starting Puppeteer for ${userName} to join meeting: ${meetingNumber}`);

    // Launch options for local development
    const launchOptions = {
      headless: true, // Run in background for better performance
      executablePath: getChromeExecutablePath(),
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        '--disable-gpu',
        '--disable-extensions',
        '--disable-images',
        '--mute-audio',
        '--disable-web-security',
        '--disable-blink-features=AutomationControlled',
        '--disable-video-capture',
        '--disable-video',
        '--disable-dev-shm-usage',
        '--no-first-run',
        '--no-default-browser-check',
        '--lang=en-US'
      ]
    };

    console.log(`Launch options:`, {
      headless: launchOptions.headless,
      argsCount: launchOptions.args.length
    });

    const LOOSE_VALIDATION = (process.env.LOOSE_VALIDATION || '').toLowerCase() === 'true' || process.env.LOOSE_VALIDATION === '1';

    browser = await puppeteer.launch(launchOptions);
    console.log(`Browser launched for ${userName}`);

    page = await browser.newPage();
    console.log(`Page created for ${userName}`);

    // Set user agent
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // Handle permissions - deny video and audio
    const context = browser.defaultBrowserContext();
    await context.overridePermissions('https://zoom.us', []);
    await context.overridePermissions('https://app.zoom.us', []);
    
    // Set permissions to deny video and audio
    await page.evaluateOnNewDocument(() => {
      // Override getUserMedia to deny video and audio
      navigator.mediaDevices.getUserMedia = async () => {
        throw new Error('Permission denied');
      };
    });
    
    // Navigate to Zoom join URL
    const hasPass = (passWord || '').trim().length > 0;
    const zoomJoinUrl = hasPass
      ? `https://app.zoom.us/wc/${meetingNumber}/join?pwd=${encodeURIComponent(passWord)}&fromPWA=1&uname=${encodeURIComponent(userName)}`
      : `https://zoom.us/wc/join/${meetingNumber}`;
    console.log(`Navigating to: ${zoomJoinUrl}`);

    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });
    await page.goto(zoomJoinUrl, { waitUntil: 'networkidle2', timeout: 60000 });
    console.log(`Page loaded for ${userName}, waiting for form...`);
    
    // Wait for page to load
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Handle cookie consent popup if present
    console.log(`Checking for cookie popup for ${userName}...`);
    try {
      const cookieAccepted = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const acceptButton = buttons.find(btn => 
          btn.textContent.toLowerCase().includes('accept') ||
          btn.textContent.toLowerCase().includes('accept cookies') ||
          btn.className.toLowerCase().includes('accept') ||
          btn.id.toLowerCase().includes('accept')
        );
        if (acceptButton) {
          acceptButton.click();
          return true;
        }
        return false;
      });
      
      if (cookieAccepted) {
        console.log(`Cookie popup accepted for ${userName}`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.log(`No cookie popup found for ${userName}`);
    }
    
    // Enter bot name (cross-frame, non-fatal if not present yet)
    console.log(`Entering name for ${userName}...`);
    async function tryTypeNameAcrossFrames(timeoutMs = 8000) {
      const selectors = [
        '#inputname',
        'input#inputname',
        'input[name="uname"]',
        'input[name="name"]',
        'input[placeholder*="name" i]',
        'input[type="text"]'
      ];
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        // Main frame first
        for (const sel of selectors) {
          try {
            const handle = await page.$(sel);
            if (handle) {
              await handle.click({ delay: 50 }).catch(() => {});
              try { await page.keyboard.down('Control'); await page.keyboard.press('KeyA'); await page.keyboard.up('Control'); } catch {}
              await handle.type(String(userName));
              return true;
            }
          } catch {}
        }
        // Child frames
        for (const frame of page.frames()) {
          for (const sel of selectors) {
            try {
              const handle = await frame.$(sel);
              if (handle) {
                try { await handle.click({ delay: 50 }); } catch {}
                try { await frame.focus(sel); } catch {}
                try { await frame.type(sel, String(userName)); return true; } catch {}
                try { await handle.type(String(userName)); return true; } catch {}
              }
            } catch {}
          }
        }
        await new Promise(r => setTimeout(r, 250));
      }
      return false;
    }
    let nameTypedInitially = false;
    try {
      nameTypedInitially = await tryTypeNameAcrossFrames(5000);
      if (nameTypedInitially) {
        console.log(`Name entered for ${userName}`);
      } else {
        console.log(`Name input not visible yet for ${userName}; will try after clicking Join if needed`);
      }
    } catch {}
    
    // Helper to type passcode across main frame and iframes
    async function tryTypePasscodeAcrossFrames(timeoutMs = 8000) {
      const selectors = [
        '#input-for-pwd',
        'input[name="passcode"]',
        'input[name="pwd"]',
        'input[placeholder*="passcode" i]',
        'input[aria-label*="passcode" i]',
        'input[type="password"]',
        'input[type="text"][name*="pass"]'
      ];
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        // Main frame first
        for (const sel of selectors) {
          try {
            const handle = await page.$(sel);
            if (handle) {
              await handle.type(String(passWord));
              return true;
            }
          } catch {}
        }
        // All frames
        for (const frame of page.frames()) {
          for (const sel of selectors) {
            try {
              const handle = await frame.$(sel);
              if (handle) {
                await handle.type(String(passWord));
                return true;
              }
            } catch {}
          }
        }
        await new Promise(r => setTimeout(r, 300));
      }
      return false;
    }

    // Try to enter passcode if it's visible pre-join; otherwise continue and retry later
    let passcodeTypedInitially = false;
    try {
      console.log(`Checking for passcode field (pre-join) for ${userName}...`);
      passcodeTypedInitially = await tryTypePasscodeAcrossFrames(3000);
      if (passcodeTypedInitially) {
        console.log(`Passcode entered (pre-join) for ${userName}`);
      } else {
        console.log(`Passcode field not visible yet for ${userName}; will try after clicking Join`);
      }
    } catch {}
    
    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Click Join button (search across all frames)
    console.log(`Looking for join button for ${userName}...`);
    async function clickJoinAcrossFrames() {
      try { await page.click('button[class*="join"]'); return true; } catch {}
      try { await page.click('button[type="submit"]'); return true; } catch {}
      // Main frame scan
      try {
        const clicked = await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));
          const candidate = buttons.find(btn => {
            const text = (btn.textContent || '').toLowerCase();
            const cls = (btn.className || '').toLowerCase();
            const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
            return text.includes('join') || cls.includes('join') || cls.includes('submit') || aria.includes('join');
          });
          if (candidate) { candidate.click(); return true; }
          return false;
        });
        if (clicked) return true;
      } catch {}
      // Child frames scan
      for (const frame of page.frames()) {
        try {
          const clicked = await frame.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));
            const candidate = buttons.find(btn => {
              const text = (btn.textContent || '').toLowerCase();
              const cls = (btn.className || '').toLowerCase();
              const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
              return text.includes('join') || cls.includes('join') || cls.includes('submit') || aria.includes('join');
            });
            if (candidate) { candidate.click(); return true; }
            return false;
          });
          if (clicked) return true;
        } catch {}
      }
      return false;
    }
    const joinClicked = await clickJoinAcrossFrames();
    if (joinClicked) {
      console.log(`Join button clicked for ${userName}`);
    } else {
      console.log(`Error for ${userName}: Join button not found`);
      throw new Error(`Join button not found for ${userName}`);
    }
    
    // Wait for meeting to load and handle common post-join popups
    console.log(`Waiting for meeting to load for ${userName}...`);
    await new Promise(resolve => setTimeout(resolve, 3000));

    // If we didn't type passcode earlier, try now (common Zoom flow)
    if (!passcodeTypedInitially) {
      const typedAfterJoin = await tryTypePasscodeAcrossFrames(12000);
      if (typedAfterJoin) {
        console.log(`Passcode entered after Join click for ${userName}`);
        await new Promise(r => setTimeout(r, 500));
        const secondJoin = await clickJoinAcrossFrames();
        if (secondJoin) {
          console.log(`Join/Submit clicked after entering passcode for ${userName}`);
        }
      }
    }

    // If name wasn't typed earlier, try now as well (some flows prompt name after Join)
    if (!nameTypedInitially) {
      const typedNameAfterJoin = await tryTypeNameAcrossFrames(10000);
      if (typedNameAfterJoin) {
        console.log(`Name entered after Join click for ${userName}`);
        await new Promise(r => setTimeout(r, 400));
        const thirdJoin = await clickJoinAcrossFrames();
        if (thirdJoin) {
          console.log(`Join/Submit clicked after entering name for ${userName}`);
        }
      }
    }

    // Brief wait before handling popups
    await new Promise(resolve => setTimeout(resolve, 1500));
    try {
      const handledPopup = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));
        const lower = (el) => (el?.textContent || '').toLowerCase();
        const aria = (el) => (el?.getAttribute('aria-label') || '').toLowerCase();
        const continueWithout = buttons.find(btn => {
          const t = lower(btn); const a = aria(btn);
          return t.includes('continue without') || t.includes('join without') || a.includes('continue without') || a.includes('join without');
        });
        if (continueWithout) { continueWithout.click(); return true; }
        const okBtn = buttons.find(btn => lower(btn).trim() === 'ok' || lower(btn).includes('got it'));
        if (okBtn) { okBtn.click(); return true; }
        return false;
      });
      if (handledPopup) {
        console.log(`Post-join popup handled for ${userName}`);
        await new Promise(r => setTimeout(r, 1000));
      }
    } catch {}

    // In loose mode, accept URL-based success to mimic local behavior
    if (LOOSE_VALIDATION) {
      const looseUrl = page.url();
      if (looseUrl.includes('app.zoom.us/wc/')) {
        console.log(`[LooseValidation] URL indicates web client for ${userName}: ${looseUrl}`);
        activeBrowsers.push(browser);
        try { page.userName = userName; } catch {}
        activePages.push(page);
        if (keepAliveMinutes && keepAliveMinutes > 0) {
          const ms = keepAliveMinutes * 60 * 1000;
          setTimeout(async () => {
            try {
              console.log(`⏰ ${userName} leaving meeting after ${keepAliveMinutes} minutes`);
              try { await page.close(); } catch {}
              try { await browser.close(); } catch {}
            } finally {
              activePages = activePages.filter(p => p !== page);
              activeBrowsers = activeBrowsers.filter(b => b !== browser);
            }
          }, ms).unref?.();
        }
        return { success: true, message: `${userName} successfully joined meeting`, userName, url: looseUrl };
      }
    }

    // Validate actual in-meeting UI, not just URL (scan all frames)
    async function readStateFromFrame(frame) {
      return await frame.evaluate(() => {
        const bodyText = (document.body?.innerText || '').toLowerCase();
        const queryAll = (sel) => Array.from(document.querySelectorAll(sel));
        const wcContainers = queryAll('[id^="wc-container"], #wc-container-right, #wc-container-left');
        const leaveButtons = queryAll('[aria-label*="leave" i], button[class*="leave" i], button[id*="leave" i]');
        const controls = queryAll('[aria-label*="mute" i], [aria-label*="video" i], [aria-label*="participants" i], [data-testid*="participant" i]');
        const waitingRoom = bodyText.includes('waiting room') || bodyText.includes('host will let you in') || bodyText.includes('will let you in soon') || bodyText.includes('we\'ve notified the host');
        const hostNotStarted = bodyText.includes('waiting for the host to start this meeting') || bodyText.includes('host has not started the meeting');
        const authRequired = bodyText.includes('sign in to join') || bodyText.includes('this meeting is for authorized attendees only') || bodyText.includes('this meeting requires authentication');
        const recaptcha = document.querySelector('iframe[src*="recaptcha"], #g-recaptcha, .g-recaptcha') !== null || bodyText.includes('recaptcha');
        const passcodeIncorrect = bodyText.includes('incorrect passcode') || bodyText.includes('wrong passcode');
        const joinInputs = queryAll('#input-for-pwd, input[name="pwd"], input[name*="name" i]');
        return {
          url: window.location.href,
          title: document.title,
          wcContainers: wcContainers.length,
          leaveButtons: leaveButtons.length,
          controls: controls.length,
          waitingRoom,
          hostNotStarted,
          authRequired,
          recaptcha,
          passcodeIncorrect,
          joinInputs: joinInputs.length
        };
      });
    }

    async function readAggregatedState(page) {
      const frames = page.frames();
      const states = [];
      for (const f of frames) {
        try { states.push(await readStateFromFrame(f)); } catch {}
      }
      // Aggregate
      const agg = states.reduce((acc, s) => {
        acc.wcContainers += s.wcContainers;
        acc.leaveButtons += s.leaveButtons;
        acc.controls += s.controls;
        acc.waitingRoom = acc.waitingRoom || s.waitingRoom;
        acc.hostNotStarted = acc.hostNotStarted || s.hostNotStarted;
        acc.authRequired = acc.authRequired || s.authRequired;
        acc.recaptcha = acc.recaptcha || s.recaptcha;
        acc.passcodeIncorrect = acc.passcodeIncorrect || s.passcodeIncorrect;
        acc.joinInputs += s.joinInputs;
        acc.urls.add(s.url);
        return acc;
      }, { wcContainers: 0, leaveButtons: 0, controls: 0, waitingRoom: false, hostNotStarted: false, authRequired: false, recaptcha: false, passcodeIncorrect: false, joinInputs: 0, urls: new Set() });

      let state = 'unknown';
      const inMeeting = (agg.wcContainers > 0 && (agg.controls > 0 || agg.leaveButtons > 0)) && !agg.waitingRoom && !agg.hostNotStarted && !agg.authRequired;
      if (inMeeting) state = 'in_meeting';
      else if (agg.waitingRoom) state = 'waiting_room';
      else if (agg.hostNotStarted) state = 'host_not_started';
      else if (agg.authRequired) state = 'auth_required';
      else if (agg.recaptcha) state = 'recaptcha_required';
      else if (agg.passcodeIncorrect) state = 'incorrect_passcode';
      else if (agg.joinInputs > 0) state = 'on_join_screen';

      return { state, wcContainers: agg.wcContainers, leaveButtons: agg.leaveButtons, controls: agg.controls, urls: Array.from(agg.urls) };
    }

    const validationStart = Date.now();
    let validationOutcome = { state: 'unknown' };
    while (Date.now() - validationStart < 25000 && validationOutcome.state === 'unknown') {
      validationOutcome = await readAggregatedState(page);
      if (validationOutcome.state === 'unknown' || validationOutcome.state === 'on_join_screen') {
        await new Promise(r => setTimeout(r, 1200));
      }
    }

    const finalUrl = page.url();
    console.log(`Validation URL for ${userName}: ${finalUrl}`);
    console.log(`Validation outcome for ${userName}:`, validationOutcome);

    if (validationOutcome.state === 'in_meeting') {
      // Extra connectivity validation: ensure not in reconnecting/connecting state and UI is interactive
      let connected = false;
      const connectivityStart = Date.now();
      while (!connected && Date.now() - connectivityStart < 15000) {
        const connectivity = await page.evaluate(async () => {
          const hasErrorOverlay = document.querySelector('[class*="disconnected" i], [class*="reconnect" i], [class*="connection-error" i], [class*="connecting" i]') !== null;
          const leaveBtn = document.querySelector('[aria-label*="leave" i], button[class*="leave" i], button[id*="leave" i]');
          // Try toggling participants panel to confirm interactivity
          const participantsBtn = document.querySelector('[aria-label*="participants" i]');
          let panelOpened = false;
          if (participantsBtn) {
            try { participantsBtn.click(); } catch {}
            await new Promise(r => setTimeout(r, 200));
            panelOpened = !!document.querySelector('[role="dialog" i], [aria-label*="participants" i][role]');
          }
          return { hasErrorOverlay, hasLeave: !!leaveBtn, panelOpened, pageVisible: !document.hidden };
        });
        if (!connectivity.hasErrorOverlay && (connectivity.hasLeave || connectivity.panelOpened) && connectivity.pageVisible) {
          connected = true;
          break;
        }
        await new Promise(r => setTimeout(r, 600));
      }

      if (!connected) {
        console.log(`Connectivity validation inconclusive for ${userName}; treating as not joined`);
        throw new Error('Connected UI not confirmed');
      }

      console.log(`Successfully validated in-meeting UI for ${userName}`);
      activeBrowsers.push(browser);
      try { page.userName = userName; } catch {}
      activePages.push(page);
      if (keepAliveMinutes && keepAliveMinutes > 0) {
        const ms = keepAliveMinutes * 60 * 1000;
        setTimeout(async () => {
          try {
            console.log(`⏰ ${userName} leaving meeting after ${keepAliveMinutes} minutes`);
            try { await page.close(); } catch {}
            try { await browser.close(); } catch {}
          } finally {
            activePages = activePages.filter(p => p !== page);
            activeBrowsers = activeBrowsers.filter(b => b !== browser);
          }
        }, ms).unref?.();
      }
      return {
        success: true,
        message: `${userName} successfully joined meeting`,
        userName: userName,
        url: finalUrl
      };
    }

    // For non-in-meeting states, surface a descriptive error to the caller
    if (validationOutcome.state === 'waiting_room') throw new Error('Waiting room - host must admit');
    if (validationOutcome.state === 'host_not_started') throw new Error('Host has not started the meeting');
    if (validationOutcome.state === 'auth_required') throw new Error('Authentication required - cannot auto-join');
    if (validationOutcome.state === 'recaptcha_required') throw new Error('reCAPTCHA required - cannot auto-join');
    if (validationOutcome.state === 'incorrect_passcode') throw new Error('Incorrect passcode');

    console.log(`Meeting validation failed for ${userName}. URL: ${finalUrl}`);
    throw new Error(`Meeting interface check failed for ${userName}`);
    
  } catch (error) {
    console.log(`Error for ${userName}: ${error.message}`);
    throw error;
  } finally {
    if (!activeBrowsers.includes(browser)) {
      try {
        if (page) await page.close();
        if (browser) await browser.close();
        console.log(`Browser closed for ${userName} due to error`);
      } catch (closeError) {
        console.log(`Error closing browser for ${userName}: ${closeError.message}`);
      }
    }
  }
}

export async function closeAllBots() {
  if (isClosing) {
    return 0;
  }
  
  isClosing = true;
  console.log('Closing all bots...');
  
  try {
    const closePromises = activeBrowsers.map(async (browser, index) => {
      try {
        await browser.close();
        console.log(`Closed browser ${index + 1}`);
        return true;
      } catch (error) {
        console.log(`Error closing browser ${index + 1}: ${error.message}`);
        return false;
      }
    });
    
    const results = await Promise.allSettled(closePromises);
    const closedCount = results.filter(result => result.status === 'fulfilled' && result.value).length;
    
    activeBrowsers = [];
    activePages = [];
    isClosing = false;
    
    console.log(`Successfully closed ${closedCount} bots`);
    return closedCount;
  } catch (error) {
    isClosing = false;
    console.error('Error in closeAllBots:', error);
    throw error;
  }
}

export async function leaveAllMeetings() {
  console.log('Leaving all meetings...');
  
  try {
    const leavePromises = activePages.map(async (page, index) => {
      try {
        await page.close();
        console.log(`Left meeting ${index + 1}`);
        return true;
      } catch (error) {
        console.log(`Error leaving meeting ${index + 1}: ${error.message}`);
        return false;
      }
    });
    
    const results = await Promise.allSettled(leavePromises);
    const leftCount = results.filter(result => result.status === 'fulfilled' && result.value).length;
    
    activePages = [];
    
    console.log(`Successfully left ${leftCount} meetings`);
    return leftCount;
  } catch (error) {
    console.error('Error in leaveAllMeetings:', error);
    throw error;
  }
}

export function getBotStatus() {
  return {
    activeBots: activeBrowsers.length,
    botNames: activePages.map(page => page.userName || 'Unknown'),
    isClosing: isClosing
  };
} 