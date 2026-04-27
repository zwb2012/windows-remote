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
    cursorBlink: true,
    convertEol: true
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
// PLACEHOLDER_TERMINAL_CONTINUE

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
