const express = require('express');
const http = require('http');
const path = require('path');
const { WebSocketServer } = require('ws');
const { token, verifyToken, verifyWsToken } = require('./auth');
const { createSession, getSession, destroySession, resizeSession } = require('./terminal');

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;

app.use('/assets', express.static(path.join(__dirname, '../client/dist/assets')));

app.get('/', verifyToken, (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

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

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Access URL: http://localhost:${PORT}/?token=${token}`);
});
