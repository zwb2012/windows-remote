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

## Windows 启动脚本（后端 + Cloudflare Tunnel）

脚本文件：

- `scripts/start-remote.bat`：双击入口，调用 PowerShell 启动器
- `scripts/start-remote.ps1`：检查依赖并拉起两个独立窗口，同时记录 watcher PID 到 `logs/runtime-pids.json`
- `scripts/stop-remote.bat`：双击入口，调用 PowerShell 停止器
- `scripts/stop-remote.ps1`：读取 `logs/runtime-pids.json`，仅停止该次启动产生的 watcher 进程树并删除运行时 PID 文件
- `scripts/watch-backend.ps1`：循环运行 `npm start`，退出后 5 秒重启
- `scripts/watch-tunnel.ps1`：循环运行 `cloudflared tunnel --url http://localhost:3000`，退出后 5 秒重启

前置条件：

- 已安装 Node.js 且 `npm` 可用
- 已安装 cloudflared，且路径固定为 `D:\ProgramData\Cloudflare\cloudflared.exe`
- 已完成依赖安装与前端构建（见上方“安装”）

启动方式（Windows）：

1. 双击 `scripts/start-remote.bat`
2. 会打开两个可见窗口：
   - `Windows Remote Backend`
   - `Windows Remote Tunnel`

停止方式（Windows）：

1. 双击 `scripts/stop-remote.bat`
2. 脚本会按 `logs/runtime-pids.json` 记录，仅停止启动器拉起的 watcher 进程树
3. 完成后会删除 `logs/runtime-pids.json`

日志与运行时文件位置：

- `logs/backend.log`
- `logs/tunnel.log`
- `logs/runtime-pids.json`（仅用于 stop 脚本精确定位本次启动的进程）

注意：

- `logs/` 中会记录公网 trycloudflare 域名
- `logs/backend.log` 会保留后端启动信息，但其中的 `token` 会在写入日志时脱敏
- `logs/runtime-pids.json` 丢失时，`scripts/stop-remote.ps1` 会报错并退出，避免误杀非启动器拉起的进程
- 仍建议把 `logs/` 视为敏感运行信息，不要随意分享

访问方式：

1. 在后端窗口中找到：`Access URL: http://localhost:3000/?token=...`
2. 在隧道窗口中找到 trycloudflare 域名（类似 `https://xxxx.trycloudflare.com`）
3. 将两者组合为公网访问地址：
   - `https://xxxx.trycloudflare.com/?token=后端窗口里看到的token`

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

- **终端**: 多 tab Git Bash 终端，支持同时开多个会话
- **浏览器**: 远程 Chromium，支持 CDP 截图模式和屏幕串流模式切换

## 环境变量

- `PORT` — 服务端口，默认 3000
- `SHELL_PATH` — 终端 shell 路径，默认 `C:\Program Files\Git\bin\bash.exe`（Windows）或 `/bin/bash`（Linux）
