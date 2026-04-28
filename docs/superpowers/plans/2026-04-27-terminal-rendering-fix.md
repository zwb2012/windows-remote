# Terminal Rendering Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the browser terminal so large plain-text output no longer overlaps earlier lines when the production page is served by the Node server.

**Architecture:** Make the smallest possible change in the frontend render layer by enabling xterm's end-of-line conversion when the terminal instance is created. Do not change PTY spawning, WebSocket protocol, or terminal session lifecycle. Verify against the production-served built client because `client/dist` is ignored by git and must be rebuilt locally after the source edit.

**Tech Stack:** Vue 3, xterm.js, xterm-addon-fit, Vite, Node.js/Express

---

## File Structure

- `client/src/views/Terminal.vue` — owns xterm instance creation, WebSocket wiring, tab lifecycle, and is the only source file that should change for this fix.
- `client/package.json` — already declares `xterm` and `xterm-addon-fit`; read-only context for the existing frontend dependency versions.
- `server/index.js` — serves `client/dist/index.html` and `client/dist/assets/**`; read-only context that explains why manual verification must use a rebuilt production client.
- `client/dist/**` — generated Vite output used for verification only. It is ignored by git (`.gitignore:3`) and must not be edited by hand or committed.

---

### Task 1: Reproduce the bug and make the minimal xterm change

**Files:**
- Modify: `client/src/views/Terminal.vue:53-58`
- Verify: production-served app via `server/index.js`

- [ ] **Step 1: Run the failing manual reproduction first**

This repo has no automated UI test harness, so the failing browser reproduction is the red test for this bug.

Run in terminal A:
```bash
npm run build
```
Expected: Vite build completes successfully.

Run in terminal B and leave it running:
```bash
npm start
```
Expected output includes:
```text
Server running on http://localhost:3000
Access URL: http://localhost:3000/?token=...
```

Open the printed `Access URL` in Chrome/Edge. In the browser terminal, run:
```bash
seq 1 200
```
If `seq` is unavailable in the remote shell, run:
```bash
for i in {1..200}; do echo $i; done
```
Expected: **FAIL** — after enough lines, new output overlaps earlier lines or paints into the wrong rows.

- [ ] **Step 2: Make the minimal code change in `client/src/views/Terminal.vue`**

Replace the `new Terminal(...)` options block with:

```js
const term = new Terminal({
  theme: { background: '#1e1e1e' },
  fontSize: 14,
  fontFamily: 'Consolas, monospace',
  cursorBlink: true,
  convertEol: true
});
```

Do not change any other terminal options, tab behavior, resize handling, or WebSocket logic in this task.

- [ ] **Step 3: Sanity-check the source diff before rebuilding**

Run:
```bash
git diff -- client/src/views/Terminal.vue
```
Expected diff shape: exactly one added option inside the `new Terminal(...)` object:
```diff
 const term = new Terminal({
   theme: { background: '#1e1e1e' },
   fontSize: 14,
   fontFamily: 'Consolas, monospace',
-  cursorBlink: true
+  cursorBlink: true,
+  convertEol: true
 });
```

---

### Task 2: Rebuild the production client, verify the fix, and commit

**Files:**
- Modify: `client/src/views/Terminal.vue`
- Generate locally only: `client/dist/**`

- [ ] **Step 1: Rebuild the production client that the server actually serves**

Run:
```bash
npm run build
```
Expected: Vite build succeeds and regenerates `client/dist/**` locally.

- [ ] **Step 2: Restart the production server and verify the main reproduction now passes**

Run:
```bash
npm start
```
Expected output includes:
```text
Server running on http://localhost:3000
Access URL: http://localhost:3000/?token=...
```

Open the printed `Access URL` and run both commands in the browser terminal:
```bash
seq 1 200
```
```bash
for i in {1..200}; do echo $i; done
```
Expected: **PASS** — each line appears once, in order, on its own row; no overlap with earlier output.

If either command still produces overlapping rows, stop here. Do **not** add `windowsMode`, `windowsPty`, server-side newline rewriting, or layout refactors in this plan. Return to a new design/debugging cycle with the failed result.

- [ ] **Step 3: Run the regression checks in the same browser session**

Run in the browser terminal:
```bash
echo ready
```
Expected: `ready` appears on the next clean line.

Then verify these interactions manually:
- Scroll up and down through the terminal history; previously printed rows stay readable.
- Click the `+` tab button to create a second terminal tab.
- In the new tab, run:
  ```bash
  echo second
  ```
  Expected: `second` appears correctly in the new tab.
- Switch back to the first tab.
  Expected: the original history is still intact and readable.

- [ ] **Step 4: Commit only the source change**

Run:
```bash
git add client/src/views/Terminal.vue
git commit -m "$(cat <<'EOF'
fix: enable xterm EOL conversion in browser terminal

Keep large plain-text output from overlapping previous lines in the server-served terminal view.
EOF
)"
```
Expected: one new commit containing only `client/src/views/Terminal.vue`.

---

## Self-Review

- **Spec coverage:** The plan implements the spec's only code change (`convertEol: true` in `client/src/views/Terminal.vue`), verifies through the server-served production build, and explicitly avoids expanding scope into deprecated Windows heuristics or backend changes.
- **Placeholder scan:** No TODO/TBD placeholders remain. Manual verification steps use exact commands and explicit expected outcomes.
- **Type consistency:** The plan uses the existing `Terminal` constructor options object and adds only the documented `convertEol` boolean option; no new names, types, or interfaces are introduced.
