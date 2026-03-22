'use strict';

const Redis = require('ioredis');

/**
 * RedisTokenStore — Token store dùng cho production
 * Dùng ioredis với hai key pattern:
 *   refresh:{token}  → userId   (TTL = REFRESH_TOKEN_TTL)
 *   revoked:{jti}    → 1        (TTL = thời gian còn lại của access token)
 */
class RedisTokenStore {
  /**
   * @param {string} redisUrl - Redis connection URL, e.g. 'redis://localhost:6379'
   */
  constructor(redisUrl) {
    this._client = new Redis(redisUrl);
  }

  /**
   * Lưu refresh token với userId và TTL (giây)
   * Key pattern: refresh:{token} → userId
   * @param {string} token
   * @param {string} userId
   * @param {number} ttlSeconds
   */
  async saveRefreshToken(token, userId, ttlSeconds) {
    await this._client.set(`refresh:${token}`, userId, 'EX', ttlSeconds);
  }

  /**
   * Lấy userId từ refresh token.
   * Trả về null nếu không tồn tại hoặc đã hết hạn.
   * @param {string} token
   * @returns {Promise<string|null>}
   */
  async getRefreshToken(token) {
    return this._client.get(`refresh:${token}`);
  }

  /**
   * Xóa refresh token khỏi store
   * @param {string} token
   */
  async deleteRefreshToken(token) {
    await this._client.del(`refresh:${token}`);
  }

  /**
   * Thêm jti vào revocation list với TTL (giây)
   * Key pattern: revoked:{jti} → 1
   * @param {string} jti
   * @param {number} ttlSeconds
   */
  async revokeAccessToken(jti, ttlSeconds) {
    await this._client.set(`revoked:${jti}`, '1', 'EX', ttlSeconds);
  }

  /**
   * Kiểm tra jti có bị thu hồi không.
   * @param {string} jti
   * @returns {Promise<boolean>}
   */
  async isRevoked(jti) {
    const val = await this._client.get(`revoked:${jti}`);
    return val !== null;
  }
}

module.exports = { RedisTokenStore };
