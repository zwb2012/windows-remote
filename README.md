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

- **终端**: 多 tab Git Bash 终端，支持同时开多个会话
- **浏览器**: 远程 Chromium，支持 CDP 截图模式和屏幕串流模式切换

## 环境变量

- `PORT` — 服务端口，默认 3000
- `SHELL_PATH` — 终端 shell 路径，默认 `C:\Program Files\Git\bin\bash.exe`（Windows）或 `/bin/bash`（Linux）
