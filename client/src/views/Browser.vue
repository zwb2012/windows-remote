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
// PLACEHOLDER_BROWSER_VUE_CONTINUE

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
    } else if (msg.type === 'browserRestarted') {
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.value.width, canvasRef.value.height);
      }
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
.browser-viewport {
  flex: 1; overflow: hidden; display: flex;
  justify-content: center; background: #000;
}
canvas { max-width: 100%; max-height: 100%; object-fit: contain; outline: none; }
</style>
