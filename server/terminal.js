const pty = require('node-pty');

const sessions = new Map();

const DEFAULT_SHELL = process.platform === 'win32'
  ? 'C:\\Program Files\\Git\\bin\\bash.exe'
  : '/bin/bash';

function createSession(id, cols = 80, rows = 24) {
  const shell = process.env.SHELL_PATH || DEFAULT_SHELL;
  const proc = pty.spawn(shell, [], {
    name: 'xterm-color',
    cols,
    rows,
    cwd: process.env.HOME || process.env.USERPROFILE,
    env: process.env
  });
  sessions.set(id, proc);
  return proc;
}

function getSession(id) {
  return sessions.get(id);
}

function destroySession(id) {
  const proc = sessions.get(id);
  if (proc) {
    proc.kill();
    sessions.delete(id);
  }
}

function resizeSession(id, cols, rows) {
  const proc = sessions.get(id);
  if (proc) {
    proc.resize(cols, rows);
  }
}

module.exports = { createSession, getSession, destroySession, resizeSession };
