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
