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
   * @param {string} redisUrl - Redis connection URL
   *   Local:   redis://localhost:6379
   *   TLS:     rediss://user:pass@host:6380  (managed Redis như Railway, Upstash)
   */
  constructor(redisUrl) {
    this._client = new Redis(redisUrl, {
      // ioredis tự reconnect theo exponential backoff, tối đa 10 lần
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
    });

    // Lắng nghe error event để log — KHÔNG để unhandled, tránh crash process
    this._client.on('error', (err) => {
      console.error('[RedisTokenStore] connection error:', err.message);
    });

    this._client.on('reconnecting', () => {
      console.warn('[RedisTokenStore] reconnecting to Redis...');
    });

    this._client.on('ready', () => {
      console.info('[RedisTokenStore] connected to Redis');
    });
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
