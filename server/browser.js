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
  send({ type: 'pageInfo', url: page.url(), title: await page.title() });
}

async function sendScreenshot() {
  if (!page) return;
  const buf = await page.screenshot({ type: 'jpeg', quality: 70 });
  send({ type: 'frame', data: buf.toString('base64') });
}

async function getInputSession() {
  if (!inputSession) {
    inputSession = await page.createCDPSession();
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
  const cdp = await getInputSession();
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
}

async function handleKeyboard(msg) {
  if (!page) return;
  if (msg.action === 'press') {
    await page.keyboard.press(msg.key);
  } else if (msg.action === 'down') {
    await page.keyboard.down(msg.key);
  } else if (msg.action === 'up') {
    await page.keyboard.up(msg.key);
  }
  if (currentMode === 'cdp') {
    setTimeout(() => sendScreenshot(), 100);
  }
}
// PLACEHOLDER_BROWSER_CONTINUE

async function switchMode(mode) {
  if (mode === currentMode) return;

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
}

async function handleMessage(msg) {
  switch (msg.type) {
    case 'navigate': await navigate(msg.url); break;
    case 'mouse': await handleMouse(msg); break;
    case 'keyboard': await handleKeyboard(msg); break;
    case 'switchMode': await switchMode(msg.mode); break;
  }
}

module.exports = { launch, setClient, handleMessage };
