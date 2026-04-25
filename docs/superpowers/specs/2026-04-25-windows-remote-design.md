# Windows Remote — 设计文档

## 概述

一个运行在 Windows 上的 Node.js 服务，允许用户通过浏览器远程访问 Git Bash 终端和一个受控的 Chromium 浏览器实例。个人使用，内网穿透由外部工具（frp/Cloudflare Tunnel）处理。

## 架构

```
浏览器(Vue前端) <--WebSocket--> Node.js后端(Windows)
                                  ├── 终端服务: node-pty → Git Bash
                                  └── 浏览器服务: Puppeteer → Chromium
```

单进程 Node.js 服务，监听端口 3000（可配置）。前端为 Vue 3 SPA，由同一服务通过 Express 静态托管。

## 认证

启动时生成随机 token 并打印到控制台。HTTP 请求通过 `?token=xxx` 查询参数验证，WebSocket 连接时在握手阶段验证同一 token。

## 模块设计

### 1. Web 终端

- 后端用 `node-pty` 启动 Git Bash（`C:/Program Files/Git/bin/bash.exe`，路径可配置）
- 每个终端连接创建独立 pty 实例
- 前端用 `xterm.js` + `xterm-addon-fit` 渲染
- WebSocket 路径: `/ws/terminal/:id`
- 消息格式: 二进制数据直传（stdin/stdout）
- resize 事件: `{ type: "resize", cols, rows }`
- 支持多终端 tab，可同时开多个会话

### 2. 远程浏览器

后端启动一个 Puppeteer 控制的 Chromium 实例，提供两种可切换的模式：

**CDP 代理模式（默认）：**
- 用户输入 URL，后端通过 Puppeteer 导航
- 后端在导航完成和用户操作后截图（`Page.screenshot`），通过事件驱动而非定时轮询
- 前端捕获鼠标/键盘事件，后端通过 CDP `Input.dispatchMouseEvent` / `Input.dispatchKeyEvent` 模拟
- 轻量省流量，适合简单网页

**屏幕串流模式：**
- 用 CDP `Page.startScreencast` 实时推送 JPEG 帧
- 前端 Canvas 逐帧渲染，帧率约 15-30fps
- 同样通过 WebSocket 转发输入事件
- 画面完整，复杂网站兼容性好

**共享设计：**
- 同一个 Chromium 实例和 page 对象，切换模式不丢失页面状态
- WebSocket 路径: `/ws/browser`
- 消息协议（JSON）:
  - `{ type: "navigate", url }` — 导航
  - `{ type: "mouse", x, y, action: "click|move|scroll", deltaY? }` — 鼠标
  - `{ type: "keyboard", key, action: "down|up|press" }` — 键盘
  - `{ type: "switchMode", mode: "cdp|screencast" }` — 切换模式
  - `{ type: "frame", data: "base64..." }` — 后端→前端，画面帧
  - `{ type: "pageInfo", url, title }` — 后端→前端，页面信息更新

### 3. 前端

Vue 3 SPA，暗色主题：

- 顶部导航栏：「终端」和「浏览器」两个 tab + 认证状态
- 终端页面：xterm.js 区域 + 底部 tab 栏（新建/切换/关闭会话）
- 浏览器页面：顶部地址栏（URL + 导航按钮 + 模式切换）+ Canvas 画面区域
- 用 `v-show` 切换页面，保持状态不丢失
- 不使用 vue-router

## 项目结构

```
windows-remote/
├── server/
│   ├── index.js          # Express + WebSocket 服务入口
│   ├── terminal.js       # node-pty 终端管理
│   ├── browser.js        # Puppeteer 浏览器管理
│   └── auth.js           # token 认证
├── client/               # Vue 3 前端
│   ├── index.html
│   ├── src/
│   │   ├── App.vue
│   │   ├── views/
│   │   │   ├── Terminal.vue
│   │   │   └── Browser.vue
│   │   └── main.js
│   └── vite.config.js
├── package.json
└── README.md
```

## 技术栈

- 后端: Node.js, Express, ws, node-pty, puppeteer
- 前端: Vue 3, Vite, xterm.js, xterm-addon-fit
- 内网穿透: 用户自行配置 frp / Cloudflare Tunnel

## 非目标

- 不做多用户/权限管理
- 不做远程桌面
- 不自建内网穿透
- 不做持久化（浏览器历史、终端历史等）
