'use strict';

const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');

/**
 * Ký payload thành JWT compact string (RS256)
 * @param {object} payload - { sub, email, roles, ... }
 * @param {string} ttl     - e.g. '15m'
 * @returns {string} JWT string
 */
function sign(payload, ttl) {
  const options = {
    algorithm: 'RS256',
    expiresIn: ttl,
    jwtid: uuidv4(),
    issuer: config.jwt.issuer,
  };

  if (config.jwt.audience) {
    options.audience = config.jwt.audience;
  }

  return jwt.sign(payload, config.jwt.privateKey, options);
}

/**
 * Giải mã và xác minh JWT (chữ ký, thời hạn, issuer)
 * @param {string} token
 * @returns {object} Decoded payload
 * @throws {jwt.TokenExpiredError | jwt.JsonWebTokenError}
 */
function verify(token) {
  const options = {
    algorithms: ['RS256'],
    issuer: config.jwt.issuer,
  };

  if (config.jwt.audience) {
    options.audience = config.jwt.audience;
  }

  return jwt.verify(token, config.jwt.publicKey, options);
}

/**
 * Giải mã JWT không xác minh chữ ký (dùng để đọc exp khi revoke)
 * @param {string} token
 * @returns {object|null} Decoded payload hoặc null nếu không hợp lệ
 */
function decode(token) {
  try {
    return jwt.decode(token);
  } catch {
    return null;
  }
}

module.exports = { sign, verify, decode };
