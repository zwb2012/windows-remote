const puppeteer = require('puppeteer');

let browser = null;
let page = null;
let currentMode = 'cdp';
let wsClient = null;
let inputSession = null;
let screencastSession = null;

async function launch() {
  browser = await puppeteer.launch({
    headless: 'new',
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,720']
  });
  page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });

  page.on('framenavigated', async (frame) => {
    if (frame === page.mainFrame()) {
      sendPageInfo();
      if (currentMode === 'cdp') {
        await sendScreenshot();
      }
    }
  });

  // Keep-alive: auto-relaunch on browser/process disconnect
  browser.on('disconnected', async () => {
    console.log('Browser disconnected, reconnecting...');
    await relaunch();
  });
}

async function relaunch() {
  inputSession = null;
  screencastSession = null;
  page = null;
  browser = null;
  try {
    await launch();
  } catch (err) {
    console.error('Browser relaunch failed:', err.message);
    // Retry after delay
    setTimeout(() => relaunch(), 5000);
    return;
  }
  // Restore screencast mode if previously active
  if (currentMode === 'screencast') {
    currentMode = 'cdp';
    await switchMode('screencast');
  }
  send({ type: 'browserRestarted' });
}

function setClient(ws) {
  wsClient = ws;
}

function send(data) {
  if (wsClient && wsClient.readyState === 1) {
    wsClient.send(JSON.stringify(data));
  }
}

async function sendPageInfo() {
  if (!page) return;
  try {
    send({ type: 'pageInfo', url: page.url(), title: await page.title() });
  } catch (err) {
    console.error('sendPageInfo error:', err.message);
  }
}

async function sendScreenshot() {
  if (!page) return;
  try {
    const buf = await page.screenshot({ type: 'jpeg', quality: 70 });
    send({ type: 'frame', data: buf.toString('base64') });
  } catch (err) {
    console.error('sendScreenshot error:', err.message);
  }
}

async function getInputSession() {
  if (!inputSession && page) {
    try {
      inputSession = await page.createCDPSession();
    } catch (err) {
      console.error('getInputSession error:', err.message);
    }
  }
  return inputSession;
}

async function navigate(url) {
  if (!page) return;
  if (!url.startsWith('http')) url = 'https://' + url;
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
  } catch {}
  await sendPageInfo();
  if (currentMode === 'cdp') await sendScreenshot();
}

async function handleMouse(msg) {
  if (!page) return;
  try {
    const cdp = await getInputSession();
    if (!cdp) return;
    if (msg.action === 'click') {
      await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: msg.x, y: msg.y, button: 'left', clickCount: 1 });
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: msg.x, y: msg.y, button: 'left', clickCount: 1 });
    } else if (msg.action === 'scroll') {
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: msg.x, y: msg.y, deltaX: 0, deltaY: msg.deltaY || 100 });
    } else if (msg.action === 'move') {
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: msg.x, y: msg.y });
    }
    if (currentMode === 'cdp') {
      setTimeout(() => sendScreenshot(), 100);
    }
  } catch (err) {
    console.error('handleMouse error:', err.message);
  }
}

function parseKeyCombo(raw) {
  const parts = raw.split('+');
  return { key: parts.pop(), modifiers: parts };
}

async function handleKeyboard(msg) {
  if (!page) return;
  try {
    const { key, modifiers } = parseKeyCombo(msg.key);
    if (msg.action === 'press') {
      for (const mod of modifiers) {
        await page.keyboard.down(mod);
      }
      await page.keyboard.press(key);
      for (const mod of modifiers) {
        await page.keyboard.up(mod);
      }
    } else if (msg.action === 'down') {
      await page.keyboard.down(key);
    } else if (msg.action === 'up') {
      await page.keyboard.up(key);
    }
    if (currentMode === 'cdp') {
      setTimeout(() => sendScreenshot(), 100);
    }
  } catch (err) {
    console.error('handleKeyboard error:', err.message);
  }
}

async function switchMode(mode) {
  if (!page) return;
  if (mode === currentMode) return;
  try {
    if (currentMode === 'screencast' && screencastSession) {
      try {
        await screencastSession.send('Page.stopScreencast');
        await screencastSession.detach();
      } catch {}
      screencastSession = null;
    }

    currentMode = mode;

    if (mode === 'screencast') {
      screencastSession = await page.createCDPSession();
      screencastSession.on('Page.screencastFrame', async ({ data, sessionId }) => {
        send({ type: 'frame', data });
        try {
          await screencastSession.send('Page.screencastFrameAck', { sessionId });
        } catch {}
      });
      await screencastSession.send('Page.startScreencast', {
        format: 'jpeg', quality: 70, maxWidth: 1280, maxHeight: 720
      });
    } else {
      await sendScreenshot();
    }

    send({ type: 'modeChanged', mode: currentMode });
  } catch (err) {
    console.error('switchMode error:', err.message);
  }
}

async function handleMessage(msg) {
  try {
    switch (msg.type) {
      case 'navigate': await navigate(msg.url); break;
      case 'mouse': await handleMouse(msg); break;
      case 'keyboard': await handleKeyboard(msg); break;
      case 'switchMode': await switchMode(msg.mode); break;
      default:
        console.error('Unknown message type:', msg.type);
    }
  } catch (err) {
    console.error('handleMessage error:', err.message);
  }
}

module.exports = { launch, setClient, handleMessage };
