'use strict';

/**
 * InMemoryTokenStore — Token store dùng cho dev/test
 * Dùng hai Map với timestamp-based expiry, không cần Redis hay Docker.
 *
 * Map 1: _refreshTokens  — key: token string  → { userId, expiresAt }
 * Map 2: _revokedJtis    — key: jti string    → { expiresAt }
 */
class InMemoryTokenStore {
  constructor() {
    // Map<token, { userId: string, expiresAt: number }>
    this._refreshTokens = new Map();
    // Map<jti, { expiresAt: number }>
    this._revokedJtis = new Map();
  }

  /**
   * Lưu refresh token với userId và TTL (giây)
   * @param {string} token
   * @param {string} userId
   * @param {number} ttlSeconds
   */
  async saveRefreshToken(token, userId, ttlSeconds) {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    this._refreshTokens.set(token, { userId, expiresAt });
  }

  /**
   * Lấy userId từ refresh token.
   * Trả về null nếu không tồn tại hoặc đã hết hạn.
   * @param {string} token
   * @returns {Promise<string|null>}
   */
  async getRefreshToken(token) {
    const entry = this._refreshTokens.get(token);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this._refreshTokens.delete(token);
      return null;
    }

    return entry.userId;
  }

  /**
   * Xóa refresh token khỏi store
   * @param {string} token
   */
  async deleteRefreshToken(token) {
    this._refreshTokens.delete(token);
  }

  /**
   * Thêm jti vào revocation list với TTL (giây)
   * @param {string} jti
   * @param {number} ttlSeconds
   */
  async revokeAccessToken(jti, ttlSeconds) {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    this._revokedJtis.set(jti, { expiresAt });
  }

  /**
   * Kiểm tra jti có bị thu hồi không.
   * Tự dọn entry đã hết hạn.
   * @param {string} jti
   * @returns {Promise<boolean>}
   */
  async isRevoked(jti) {
    const entry = this._revokedJtis.get(jti);
    if (!entry) return false;

    if (Date.now() > entry.expiresAt) {
      this._revokedJtis.delete(jti);
      return false;
    }

    return true;
  }
}

module.exports = { InMemoryTokenStore };
