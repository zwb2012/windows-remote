# Windows Remote Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Node.js service that runs on Windows and exposes a Git Bash terminal and a remote Chromium browser through a web interface.

**Architecture:** Single Express server hosts a Vue 3 SPA and WebSocket endpoints. `node-pty` spawns Git Bash processes for the terminal. Puppeteer controls a Chromium instance with two display modes (CDP screenshot and screencast). All communication over WebSocket with JSON messages (browser) or binary (terminal).

**Tech Stack:** Node.js, Express, ws, node-pty, puppeteer (backend); Vue 3, Vite, xterm.js, xterm-addon-fit (frontend)

---

## File Structure

```
windows-remote/
├── package.json                  # Root: server deps + scripts
├── server/
│   ├── index.js                  # Express app, static hosting, WS upgrade routing
│   ├── auth.js                   # Token generation and verification
│   ├── terminal.js               # node-pty lifecycle: spawn, write, resize, kill
│   └── browser.js                # Puppeteer lifecycle: launch, navigate, input, screenshot, screencast
├── client/
│   ├── package.json              # Frontend deps
│   ├── index.html                # Vite entry HTML
│   ├── vite.config.js            # Vite config with dev proxy to backend
│   └── src/
│       ├── main.js               # Vue app mount
│       ├── App.vue               # Top-level layout: nav tabs + v-show views
│       └── views/
│           ├── Terminal.vue       # xterm.js terminal with multi-tab support
│           └── Browser.vue        # Remote browser: address bar + canvas + mode switch
└── README.md                     # Setup and usage instructions
```

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `server/index.js`
- Create: `server/auth.js`
- Create: `client/package.json`
- Create: `client/index.html`
- Create: `client/vite.config.js`
- Create: `client/src/main.js`
- Create: `client/src/App.vue`

- [ ] **Step 1: Create root package.json with server dependencies**

```json
{
  "name": "windows-remote",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "node server/index.js",
    "build": "cd client && npm run build",
    "start": "node server/index.js"
  },
  "dependencies": {
    "express": "^4.21.0",
    "ws": "^8.18.0",
    "node-pty": "^1.0.0",
    "puppeteer": "^23.0.0"
  }
}
```

- [ ] **Step 2: Create server/auth.js — token generation and middleware**

```js
const crypto = require('crypto');

const token = crypto.randomBytes(32).toString('hex');

function verifyToken(req, res, next) {
  if (req.query.token === token) {
    return next();
  }
  res.status(401).json({ error: 'Unauthorized' });
}

function verifyWsToken(url) {
  const params = new URL(url, 'http://localhost').searchParams;
  return params.get('token') === token;
}

module.exports = { token, verifyToken, verifyWsToken };
```

- [ ] **Step 3: Create server/index.js — Express + WS skeleton**

```js
const express = require('express');
const http = require('http');
const path = require('path');
const { token, verifyToken, verifyWsToken } = require('./auth');

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;

// Static files — serve built Vue app
app.use('/assets', express.static(path.join(__dirname, '../client/dist/assets')));

// Auth gate for the SPA
app.get('/', verifyToken, (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Access URL: http://localhost:${PORT}/?token=${token}`);
});
```

- [ ] **Step 4: Create client/package.json**

```json
{
  "name": "windows-remote-client",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "vite build"
  },
  "dependencies": {
    "vue": "^3.5.0"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^5.0.0",
    "vite": "^6.0.0"
  }
}
```

- [ ] **Step 5: Create client/vite.config.js with dev proxy**

```js
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      '/ws': {
        target: 'http://localhost:3000',
        ws: true
      }
    }
  }
});
```

- [ ] **Step 6: Create client/index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Windows Remote</title>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/main.js"></script>
</body>
</html>
```

- [ ] **Step 7: Create client/src/main.js and App.vue skeleton**

`client/src/main.js`:
```js
import { createApp } from 'vue';
import App from './App.vue';

createApp(App).mount('#app');
```

`client/src/App.vue`:
```vue
<template>
  <div class="app">
    <nav class="nav-bar">
      <button :class="{ active: tab === 'terminal' }" @click="tab = 'terminal'">终端</button>
      <button :class="{ active: tab === 'browser' }" @click="tab = 'browser'">浏览器</button>
    </nav>
    <div class="content">
      <div v-show="tab === 'terminal'">终端 (TODO)</div>
      <div v-show="tab === 'browser'">浏览器 (TODO)</div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
const tab = ref('terminal');
</script>

<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body, #app, .app { height: 100%; }
body { background: #1e1e1e; color: #d4d4d4; font-family: system-ui, sans-serif; }
.app { display: flex; flex-direction: column; }
.nav-bar { display: flex; gap: 4px; padding: 8px; background: #252526; }
.nav-bar button {
  padding: 6px 16px; border: none; border-radius: 4px;
  background: #333; color: #d4d4d4; cursor: pointer;
}
.nav-bar button.active { background: #0078d4; color: #fff; }
.content { flex: 1; overflow: hidden; }
</style>
```

- [ ] **Step 8: Install dependencies and verify build**

```bash
cd windows-remote && npm install
cd client && npm install && npm run build
cd .. && node server/index.js
# Verify: server starts, prints access URL with token
```

- [ ] **Step 9: Commit**

```bash
git init
git add -A
git commit -m "feat: project scaffolding with Express server and Vue 3 client"
```

---

### Task 2: Terminal Backend — node-pty Manager

**Files:**
- Create: `server/terminal.js`
- Modify: `server/index.js` (add WS upgrade routing for terminal)

- [ ] **Step 1: Create server/terminal.js**

```js
const pty = require('node-pty');

const sessions = new Map();

const DEFAULT_SHELL = process.platform === 'win32'
  ? 'C:\\Program Files\\Git\\bin\\bash.exe'
  : '/bin/bash';

function createSession(id, cols = 80, rows = 24) {
  const shell = process.env.SHELL_PATH || DEFAULT_SHELL;
  const proc = pty.spawn(shell, [], {
    name: 'xterm-color',
    cols,
    rows,
    cwd: process.env.HOME || process.env.USERPROFILE,
    env: process.env
  });
  sessions.set(id, proc);
  return proc;
}

function getSession(id) {
  return sessions.get(id);
}

function destroySession(id) {
  const proc = sessions.get(id);
  if (proc) {
    proc.kill();
    sessions.delete(id);
  }
}

function resizeSession(id, cols, rows) {
  const proc = sessions.get(id);
  if (proc) {
    proc.resize(cols, rows);
  }
}

module.exports = { createSession, getSession, destroySession, resizeSession };
```

- [ ] **Step 2: Add WebSocket upgrade routing for terminal in server/index.js**

Add to `server/index.js` after the Express setup:

```js
const { WebSocketServer } = require('ws');
const { createSession, getSession, destroySession, resizeSession } = require('./terminal');

const wssTerminal = new WebSocketServer({ noServer: true });

wssTerminal.on('connection', (ws, req) => {
  const id = req.url.match(/\/ws\/terminal\/([^?]+)/)?.[1];
  if (!id) { ws.close(); return; }

  const proc = getSession(id) || createSession(id);

  proc.onData((data) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(data);
    }
  });

  proc.onExit(() => {
    ws.close();
    destroySession(id);
  });

  ws.on('message', (msg) => {
    if (typeof msg === 'string') {
      try {
        const parsed = JSON.parse(msg);
        if (parsed.type === 'resize') {
          resizeSession(id, parsed.cols, parsed.rows);
          return;
        }
      } catch {}
    }
    proc.write(typeof msg === 'string' ? msg : msg.toString('utf8'));
  });

  ws.on('close', () => {
    destroySession(id);
  });
});

server.on('upgrade', (req, socket, head) => {
  const { verifyWsToken } = require('./auth');
  if (!verifyWsToken(req.url)) {
    socket.destroy();
    return;
  }

  if (req.url.includes('/ws/terminal/')) {
    wssTerminal.handleUpgrade(req, socket, head, (ws) => {
      wssTerminal.emit('connection', ws, req);
    });
  } else {
    socket.destroy();
  }
});
```

- [ ] **Step 3: Test manually**

```bash
npm run dev
# Open browser to access URL, check that WS upgrade path is registered
# (Full terminal test after frontend is built)
```

- [ ] **Step 4: Commit**

```bash
git add server/terminal.js server/index.js
git commit -m "feat: terminal backend with node-pty session management"
```

---

### Task 3: Terminal Frontend — xterm.js with Multi-Tab

**Files:**
- Create: `client/src/views/Terminal.vue`
- Modify: `client/src/App.vue` (import Terminal view)

**Dependencies to install:**
```bash
cd client && npm install xterm@5.3.0 xterm-addon-fit@0.8.0
```

- [ ] **Step 1: Install xterm.js dependencies**

```bash
cd client && npm install xterm@5.3.0 xterm-addon-fit@0.8.0
```

- [ ] **Step 2: Create client/src/views/Terminal.vue**

```vue
<template>
  <div class="terminal-container">
    <div class="terminal-tabs">
      <button
        v-for="t in tabs" :key="t.id"
        :class="{ active: t.id === activeTab }"
        @click="switchTab(t.id)"
      >
        {{ t.name }}
        <span class="close-btn" @click.stop="closeTab(t.id)">&times;</span>
      </button>
      <button class="new-tab" @click="createTab">+</button>
    </div>
    <div class="terminal-area">
      <div
        v-for="t in tabs" :key="t.id"
        v-show="t.id === activeTab"
        :ref="el => setTermRef(t.id, el)"
        class="terminal-instance"
      ></div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

const tabs = ref([]);
const activeTab = ref(null);
const termRefs = {};
const terminals = {};
const sockets = {};
let tabCounter = 0;

function getWsUrl(id) {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const params = new URLSearchParams(location.search);
  return `${proto}://${location.host}/ws/terminal/${id}?token=${params.get('token')}`;
}

function setTermRef(id, el) {
  if (el) termRefs[id] = el;
}

async function createTab() {
  const id = `term-${++tabCounter}`;
  tabs.value.push({ id, name: `Terminal ${tabCounter}` });
  activeTab.value = id;

  await nextTick();

  const term = new Terminal({
    theme: { background: '#1e1e1e' },
    fontSize: 14,
    fontFamily: 'Consolas, monospace',
    cursorBlink: true
  });
  const fitAddon = new FitAddon();
  term.loadAddon(fitAddon);
  term.open(termRefs[id]);
  fitAddon.fit();

  const ws = new WebSocket(getWsUrl(id));
  ws.onmessage = (e) => term.write(e.data);
  ws.onclose = () => term.write('\r\n[Connection closed]\r\n');

  term.onData((data) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(data);
  });

  term.onResize(({ cols, rows }) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'resize', cols, rows }));
    }
  });

  const onResize = () => fitAddon.fit();
  window.addEventListener('resize', onResize);

  terminals[id] = { term, fitAddon, onResize };
  sockets[id] = ws;
}

function switchTab(id) {
  activeTab.value = id;
  nextTick(() => {
    if (terminals[id]) terminals[id].fitAddon.fit();
  });
}

function closeTab(id) {
  if (sockets[id]) sockets[id].close();
  if (terminals[id]) {
    window.removeEventListener('resize', terminals[id].onResize);
    terminals[id].term.dispose();
    delete terminals[id];
  }
  delete sockets[id];
  delete termRefs[id];
  tabs.value = tabs.value.filter(t => t.id !== id);
  if (activeTab.value === id) {
    activeTab.value = tabs.value.length ? tabs.value[0].id : null;
  }
}

onMounted(() => createTab());

onUnmounted(() => {
  for (const id of Object.keys(terminals)) closeTab(id);
});
</script>

<style scoped>
.terminal-container { display: flex; flex-direction: column; height: 100%; }
.terminal-tabs {
  display: flex; gap: 2px; padding: 4px 8px;
  background: #2d2d2d; align-items: center;
}
.terminal-tabs button {
  padding: 4px 12px; border: none; border-radius: 3px;
  background: #3c3c3c; color: #ccc; cursor: pointer; font-size: 12px;
}
.terminal-tabs button.active { background: #0078d4; color: #fff; }
.terminal-tabs .new-tab { padding: 4px 8px; }
.close-btn { margin-left: 6px; font-size: 14px; }
.terminal-area { flex: 1; overflow: hidden; }
.terminal-instance { height: 100%; }
</style>
```

- [ ] **Step 3: Update App.vue to use Terminal component**

Replace the terminal placeholder in `client/src/App.vue`:

```vue
<template>
  <div class="app">
    <nav class="nav-bar">
      <button :class="{ active: tab === 'terminal' }" @click="tab = 'terminal'">终端</button>
      <button :class="{ active: tab === 'browser' }" @click="tab = 'browser'">浏览器</button>
    </nav>
    <div class="content">
      <TerminalView v-show="tab === 'terminal'" />
      <div v-show="tab === 'browser'">浏览器 (TODO)</div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import TerminalView from './views/Terminal.vue';
const tab = ref('terminal');
</script>
```

- [ ] **Step 4: Build and test**

```bash
cd client && npm run build
cd .. && npm run dev
# Open access URL in browser — terminal should connect and show Git Bash prompt
# Test: type commands, resize window, open multiple tabs
```

- [ ] **Step 5: Commit**

```bash
git add client/ 
git commit -m "feat: terminal frontend with xterm.js and multi-tab support"
```

---

### Task 4: Browser Backend — Puppeteer with Dual Mode

**Files:**
- Create: `server/browser.js`
- Modify: `server/index.js` (add WS upgrade routing for browser)

- [ ] **Step 1: Create server/browser.js**

```js
const puppeteer = require('puppeteer');

let browser = null;
let page = null;
let currentMode = 'cdp';
let wsClient = null;

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
  const cdp = await page.createCDPSession();
  if (msg.action === 'click') {
    await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: msg.x, y: msg.y, button: 'left', clickCount: 1 });
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: msg.x, y: msg.y, button: 'left', clickCount: 1 });
  } else if (msg.action === 'scroll') {
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: msg.x, y: msg.y, deltaX: 0, deltaY: msg.deltaY || 100 });
  } else if (msg.action === 'move') {
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: msg.x, y: msg.y });
  }
  await cdp.detach();
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

let screencastSession = null;

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
```

- [ ] **Step 2: Add browser WS routing to server/index.js**

Add after the terminal WS setup:

```js
const browserManager = require('./browser');

const wssBrowser = new WebSocketServer({ noServer: true });

wssBrowser.on('connection', (ws) => {
  browserManager.setClient(ws);

  ws.on('message', (msg) => {
    try {
      const parsed = JSON.parse(msg.toString());
      browserManager.handleMessage(parsed);
    } catch {}
  });

  ws.on('close', () => {
    browserManager.setClient(null);
  });
});

// Update the server.on('upgrade') handler to include browser path:
```

Update the existing `server.on('upgrade')` to handle both paths:

```js
server.on('upgrade', (req, socket, head) => {
  const { verifyWsToken } = require('./auth');
  if (!verifyWsToken(req.url)) {
    socket.destroy();
    return;
  }

  if (req.url.includes('/ws/terminal/')) {
    wssTerminal.handleUpgrade(req, socket, head, (ws) => {
      wssTerminal.emit('connection', ws, req);
    });
  } else if (req.url.includes('/ws/browser')) {
    wssBrowser.handleUpgrade(req, socket, head, (ws) => {
      wssBrowser.emit('connection', ws);
    });
  } else {
    socket.destroy();
  }
});
```

Add browser launch at startup (before `server.listen`):

```js
browserManager.launch().then(() => {
  console.log('Browser instance ready');
}).catch(err => {
  console.error('Failed to launch browser:', err.message);
});
```

- [ ] **Step 3: Test manually**

```bash
npm run dev
# Verify: "Browser instance ready" prints after startup
```

- [ ] **Step 4: Commit**

```bash
git add server/browser.js server/index.js
git commit -m "feat: browser backend with Puppeteer CDP and screencast modes"
```

---

### Task 5: Browser Frontend — Remote Browser View

**Files:**
- Create: `client/src/views/Browser.vue`
- Modify: `client/src/App.vue` (import Browser view)

- [ ] **Step 1: Create client/src/views/Browser.vue**

```vue
<template>
  <div class="browser-container">
    <div class="address-bar">
      <button class="nav-btn" @click="goBack">&#9664;</button>
      <button class="nav-btn" @click="goForward">&#9654;</button>
      <button class="nav-btn" @click="refresh">&#8635;</button>
      <input
        v-model="urlInput"
        class="url-input"
        @keydown.enter="navigate"
        placeholder="Enter URL..."
      />
      <button class="mode-btn" @click="toggleMode">
        {{ mode === 'cdp' ? 'CDP' : 'Stream' }}
      </button>
    </div>
    <div class="browser-viewport" ref="viewportRef">
      <canvas
        ref="canvasRef"
        @mousedown="onMouse('click', $event)"
        @mousemove="onMouse('move', $event)"
        @wheel.prevent="onWheel"
        @keydown="onKey('down', $event)"
        @keyup="onKey('up', $event)"
        tabindex="0"
      ></canvas>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';

const urlInput = ref('');
const mode = ref('cdp');
const canvasRef = ref(null);
const viewportRef = ref(null);
let ws = null;
let ctx = null;

function getWsUrl() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const params = new URLSearchParams(location.search);
  return `${proto}://${location.host}/ws/browser?token=${params.get('token')}`;
}

function send(data) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

function navigate() {
  send({ type: 'navigate', url: urlInput.value });
}

function goBack() { send({ type: 'keyboard', key: 'Alt+ArrowLeft', action: 'press' }); }
function goForward() { send({ type: 'keyboard', key: 'Alt+ArrowRight', action: 'press' }); }
function refresh() { send({ type: 'keyboard', key: 'F5', action: 'press' }); }

function toggleMode() {
  const newMode = mode.value === 'cdp' ? 'screencast' : 'cdp';
  send({ type: 'switchMode', mode: newMode });
}

function getCanvasCoords(e) {
  const rect = canvasRef.value.getBoundingClientRect();
  const scaleX = 1280 / rect.width;
  const scaleY = 720 / rect.height;
  return {
    x: Math.round((e.clientX - rect.left) * scaleX),
    y: Math.round((e.clientY - rect.top) * scaleY)
  };
}

function onMouse(action, e) {
  const { x, y } = getCanvasCoords(e);
  send({ type: 'mouse', x, y, action });
}

function onWheel(e) {
  const { x, y } = getCanvasCoords(e);
  send({ type: 'mouse', x, y, action: 'scroll', deltaY: e.deltaY });
}

function onKey(action, e) {
  e.preventDefault();
  send({ type: 'keyboard', key: e.key, action });
}

function renderFrame(base64) {
  const img = new Image();
  img.onload = () => {
    if (!ctx) return;
    canvasRef.value.width = img.width;
    canvasRef.value.height = img.height;
    ctx.drawImage(img, 0, 0);
  };
  img.src = 'data:image/jpeg;base64,' + base64;
}

function connect() {
  ws = new WebSocket(getWsUrl());

  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.type === 'frame') {
      renderFrame(msg.data);
    } else if (msg.type === 'pageInfo') {
      urlInput.value = msg.url;
    } else if (msg.type === 'modeChanged') {
      mode.value = msg.mode;
    }
  };

  ws.onclose = () => {
    setTimeout(connect, 2000);
  };
}

onMounted(() => {
  ctx = canvasRef.value.getContext('2d');
  canvasRef.value.width = 1280;
  canvasRef.value.height = 720;
  connect();
});

onUnmounted(() => {
  if (ws) ws.close();
});
</script>

<style scoped>
.browser-container { display: flex; flex-direction: column; height: 100%; }
.address-bar {
  display: flex; gap: 4px; padding: 6px 8px;
  background: #2d2d2d; align-items: center;
}
.nav-btn {
  padding: 4px 8px; border: none; border-radius: 3px;
  background: #3c3c3c; color: #ccc; cursor: pointer; font-size: 14px;
}
.url-input {
  flex: 1; padding: 6px 10px; border: 1px solid #555; border-radius: 3px;
  background: #1e1e1e; color: #d4d4d4; font-size: 13px; outline: none;
}
.url-input:focus { border-color: #0078d4; }
.mode-btn {
  padding: 4px 12px; border: none; border-radius: 3px;
  background: #0078d4; color: #fff; cursor: pointer; font-size: 12px;
}
.browser-viewport { flex: 1; overflow: hidden; display: flex; justify-content: center; background: #000; }
canvas { max-width: 100%; max-height: 100%; object-fit: contain; outline: none; }
</style>
```

- [ ] **Step 2: Update App.vue to use Browser component**

```vue
<template>
  <div class="app">
    <nav class="nav-bar">
      <button :class="{ active: tab === 'terminal' }" @click="tab = 'terminal'">终端</button>
      <button :class="{ active: tab === 'browser' }" @click="tab = 'browser'">浏览器</button>
    </nav>
    <div class="content">
      <TerminalView v-show="tab === 'terminal'" />
      <BrowserView v-show="tab === 'browser'" />
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import TerminalView from './views/Terminal.vue';
import BrowserView from './views/Browser.vue';
const tab = ref('terminal');
</script>
```

- [ ] **Step 3: Build and test**

```bash
cd client && npm run build
cd .. && npm run dev
# Test: switch to browser tab, enter a URL, verify screenshot appears
# Test: click on the page, verify interaction works
# Test: switch to screencast mode, verify continuous frames
# Test: switch back to CDP mode
```

- [ ] **Step 4: Commit**

```bash
git add client/
git commit -m "feat: browser frontend with address bar, canvas, and dual mode switch"
```

---

### Task 6: Integration Polish and README

**Files:**
- Modify: `server/browser.js` (fix CDP session reuse)
- Create: `README.md`

- [ ] **Step 1: Fix CDP session reuse in browser.js**

The current `handleMouse` creates a new CDP session per call. Refactor to reuse a single session:

In `server/browser.js`, replace the per-call `createCDPSession` pattern. Add a shared CDP session at module level:

```js
let inputSession = null;

async function getInputSession() {
  if (!inputSession) {
    inputSession = await page.createCDPSession();
  }
  return inputSession;
}
```

Update `handleMouse` to use `getInputSession()` instead of creating/detaching each time:

```js
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
```

- [ ] **Step 2: Create README.md**

```markdown
# Windows Remote

通过浏览器远程访问 Windows 电脑的 Git Bash 终端和 Chromium 浏览器。

## 安装

```bash
npm install
cd client && npm install && npm run build && cd ..
```

## 启动

```bash
npm start
```

启动后控制台会打印带 token 的访问 URL，复制到浏览器打开即可。

## 内网穿透

使用 frp 或 Cloudflare Tunnel 将端口 3000 暴露到公网。

### frp 示例

frpc.ini:
```ini
[windows-remote]
type = tcp
local_ip = 127.0.0.1
local_port = 3000
remote_port = 7000
```

## 功能

- **终端**: 多 tab Git Bash 终端
- **浏览器**: 远程 Chromium，支持 CDP 截图模式和屏幕串流模式切换
```

- [ ] **Step 3: Commit**

```bash
git add server/browser.js README.md
git commit -m "fix: reuse CDP session for input; add README"
```

---

### Task 7: End-to-End Verification

- [ ] **Step 1: Full build**

```bash
cd client && npm run build && cd ..
```

- [ ] **Step 2: Start server and verify all features**

```bash
npm start
```

Test checklist:
1. Server starts, prints access URL with token
2. Open URL in browser — dark theme loads, terminal tab active
3. Terminal: Git Bash prompt appears, can type commands
4. Terminal: create second tab, both work independently
5. Terminal: close a tab, remaining tab still works
6. Browser: switch to browser tab, enter `https://example.com`
7. Browser: screenshot appears in canvas
8. Browser: click on a link, page navigates, URL bar updates
9. Browser: switch to screencast mode, continuous frames render
10. Browser: switch back to CDP mode
11. Browser: scroll works

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "chore: final build and verification"
```
