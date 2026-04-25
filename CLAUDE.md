# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Browser-based remote access to a Windows machine's Git Bash terminal and headless Chromium browser. Designed for use behind NAT with tools like frp or Cloudflare Tunnel.

## Commands

```bash
# Install all dependencies
npm install && cd client && npm install && cd ..

# Build client for production
npm run build

# Start production server (serves built client + WebSocket endpoints)
npm start

# Client dev server with HMR (proxies /ws to localhost:3000)
cd client && npm run dev
```

No test framework is configured. No linter is configured.

## Architecture

**Monorepo with two packages:**
- `server/` — Node.js Express + WebSocket server (CommonJS)
- `client/` — Vue 3 + Vite SPA (ES modules)

**Server (`server/`)**
- `index.js` — HTTP server, static file serving, WebSocket upgrade routing. Two separate `WebSocketServer` instances: one for terminal (`/ws/terminal/:id`), one for browser (`/ws/browser`).
- `auth.js` — Generates a random token on startup; all HTTP and WebSocket connections require `?token=` query param. Token is printed to console on launch.
- `terminal.js` — Manages `node-pty` sessions in a `Map<id, pty>`. Each WebSocket connection creates/reuses a pty process. Supports resize messages.
- `browser.js` — Singleton Puppeteer instance with two rendering modes:
  - **CDP mode** (default): on-demand JPEG screenshots after each interaction
  - **Screencast mode**: continuous `Page.startScreencast` frame stream via CDP session
  - Mouse/keyboard input forwarded via `Input.dispatch*` CDP commands

**Client (`client/`)**
- `App.vue` — Top-level nav switching between Terminal and Browser views using `v-show` (both stay mounted).
- `views/Terminal.vue` — Multi-tab terminal using xterm.js. Each tab gets its own WebSocket to `/ws/terminal/:id`. Handles resize via `FitAddon`.
- `views/Browser.vue` — Remote browser canvas. Renders base64 JPEG frames on `<canvas>`. Translates mouse/keyboard events to coordinate-mapped CDP commands. Supports CDP/screencast mode toggle.

**WebSocket protocol:**
- Terminal: raw text bidirectional, plus JSON `{type:"resize", cols, rows}` for resize
- Browser: JSON messages — client sends `navigate|mouse|keyboard|switchMode`, server sends `frame|pageInfo|modeChanged`

**Key design decisions:**
- Canvas viewport is fixed at 1280x720; mouse coordinates are scaled from DOM to this resolution
- Browser module is a singleton (one Puppeteer instance, one page, one client at a time)
- Terminal sessions are destroyed on WebSocket close
