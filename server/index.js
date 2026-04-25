const express = require('express');
const http = require('http');
const path = require('path');
const { token, verifyToken } = require('./auth');

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;

app.use('/assets', express.static(path.join(__dirname, '../client/dist/assets')));

app.get('/', verifyToken, (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Access URL: http://localhost:${PORT}/?token=${token}`);
});
