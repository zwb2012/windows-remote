const express = require('express');
const http = require('http');
const path = require('path');
const { WebSocketServer } = require('ws');
const { token, verifyToken, verifyWsToken } = require('./auth');
const { createSession, getSession, destroySession, resizeSession } = require('./terminal');
const browserManager = require('./browser');

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;

app.use('/assets', express.static(path.join(__dirname, '../client/dist/assets')));

app.get('/', verifyToken, (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

const HEARTBEAT_INTERVAL = 30000;
const wssTerminal = new WebSocketServer({ noServer: true });
const wssBrowser = new WebSocketServer({ noServer: true });

wssTerminal.on('connection', (ws, req) => {
  const id = req.url.match(/\/ws\/terminal\/([^?]+)/)?.[1];
  if (!id) { ws.close(); return; }

  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

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
    try {
      proc.write(typeof msg === 'string' ? msg : msg.toString('utf8'));
    } catch (err) {
      console.error('Terminal write error:', err.message);
    }
  });

  ws.on('close', () => {
    destroySession(id);
  });
});

wssBrowser.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  browserManager.setClient(ws);
  ws.on('message', (msg) => {
    try {
      const parsed = JSON.parse(msg.toString());
      browserManager.handleMessage(parsed);
    } catch (err) {
      console.error('Browser message error:', err.message);
    }
  });
  ws.on('close', () => {
    browserManager.setClient(null);
  });
});

const heartbeatTimer = setInterval(() => {
  [wssTerminal, wssBrowser].forEach((wss) => {
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  });
}, HEARTBEAT_INTERVAL);

server.on('close', () => clearInterval(heartbeatTimer));

server.on('upgrade', (req, socket, head) => {
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

browserManager.launch().then(() => {
  console.log('Browser instance ready');
}).catch(err => {
  console.error('Failed to launch browser:', err.message);
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Access URL: http://localhost:${PORT}/?token=${token}`);
});
