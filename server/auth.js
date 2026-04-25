const crypto = require('crypto');

const token = crypto.randomBytes(32).toString('hex');

function verifyToken(req, res, next) {
  if (req.query.token === token) {
    return next();
  }
  res.status(401).json({ error: 'Unauthorized' });
}

function verifyWsToken(url) {
  const params = new URL(url, 'http://localhost').searchParams;
  return params.get('token') === token;
}

module.exports = { token, verifyToken, verifyWsToken };
