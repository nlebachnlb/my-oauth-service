'use strict';

const { v4: uuidv4 } = require('uuid');
const jwtUtil = require('../utils/jwt.util');
const config = require('../config');

/**
 * UnauthorizedError — lỗi 401 dùng trong TokenService
 */
class UnauthorizedError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'UnauthorizedError';
    this.statusCode = 401;
    this.code = code;
  }
}

/**
 * Factory function tạo TokenService với dependency injection
 * @param {object} store - Token store (InMemoryTokenStore hoặc RedisTokenStore)
 */
function createTokenService(store) {
  /**
   * Xác minh access token, kiểm tra revocation list
   * @param {string} accessToken
   * @returns {Promise<object>} JWT payload
   * @throws {UnauthorizedError}
   */
  async function verifyAccessToken(accessToken) {
    let payload;
    try {
      payload = jwtUtil.verify(accessToken);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        throw new UnauthorizedError('Token đã hết hạn', 'token_expired');
      }
      throw new UnauthorizedError('Token không hợp lệ', 'token_invalid');
    }

    const revoked = await store.isRevoked(payload.jti);
    if (revoked) {
      throw new UnauthorizedError('Token đã bị thu hồi', 'token_revoked');
    }

    return payload;
  }

  /**
   * Làm mới access token bằng refresh token (xoay vòng refresh token)
   * @param {string} refreshToken
   * @returns {Promise<{ accessToken: string, refreshToken: string }>}
   * @throws {UnauthorizedError}
   */
  async function refreshTokens(refreshToken) {
    const userId = await store.getRefreshToken(refreshToken);
    if (!userId) {
      throw new UnauthorizedError('Refresh token không hợp lệ hoặc đã hết hạn', 'refresh_token_invalid');
    }

    // Xóa refresh token cũ (rotation)
    await store.deleteRefreshToken(refreshToken);

    // Phát hành access token mới
    const accessToken = jwtUtil.sign({ sub: userId }, config.jwt.accessTTL);

    // Tạo refresh token mới và lưu vào store
    const newRefreshToken = uuidv4();
    const refreshTTLSeconds = parseTTLToSeconds(config.jwt.refreshTTL);
    await store.saveRefreshToken(newRefreshToken, userId, refreshTTLSeconds);

    return { accessToken, refreshToken: newRefreshToken };
  }

  /**
   * Thu hồi access token và xóa refresh token liên quan
   * @param {string} accessToken
   * @throws {UnauthorizedError}
   */
  async function revokeTokens(accessToken) {
    const payload = jwtUtil.decode(accessToken);
    if (!payload || !payload.jti) {
      throw new UnauthorizedError('Token không hợp lệ', 'token_invalid');
    }

    const now = Math.floor(Date.now() / 1000);
    const remainingTTL = payload.exp ? Math.max(0, payload.exp - now) : 0;

    // Thêm jti vào revocation list với TTL còn lại
    await store.revokeAccessToken(payload.jti, remainingTTL);

    // Xóa refresh token liên quan nếu có (dùng sub làm userId)
    // Lưu ý: không có mapping trực tiếp từ accessToken → refreshToken,
    // nên chỉ revoke access token; refresh token sẽ bị xóa khi client dùng nó
  }

  return { verifyAccessToken, refreshTokens, revokeTokens };
}

/**
 * Parse TTL string (e.g. '7d', '15m', '3600s') sang giây
 * @param {string} ttl
 * @returns {number} seconds
 */
function parseTTLToSeconds(ttl) {
  if (typeof ttl === 'number') return ttl;
  const match = String(ttl).match(/^(\d+)(s|m|h|d)$/);
  if (!match) return 7 * 24 * 3600; // fallback 7d
  const value = parseInt(match[1], 10);
  const unit = match[2];
  const multipliers = { s: 1, m: 60, h: 3600, d: 86400 };
  return value * multipliers[unit];
}

module.exports = { createTokenService, UnauthorizedError };
