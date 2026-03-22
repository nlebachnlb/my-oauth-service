'use strict';

const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const jwtUtil = require('../utils/jwt.util');
const config = require('../config');

/**
 * OAuthError — lỗi 502 khi OAuth provider trả về lỗi
 */
class OAuthError extends Error {
  constructor(message) {
    super(message);
    this.name = 'OAuthError';
    this.statusCode = 502;
    this.code = 'provider_error';
  }
}

/**
 * Cấu hình OAuth cho từng provider
 */
const PROVIDER_CONFIG = {
  google: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v3/userinfo',
    scope: 'openid email profile',
  },
  github: {
    authUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    userInfoUrl: 'https://api.github.com/user',
    scope: 'read:user user:email',
  },
};

/**
 * Factory function tạo OAuthService với dependency injection
 * @param {object} store - Token store (InMemoryTokenStore hoặc RedisTokenStore)
 */
function createOAuthService(store) {
  /**
   * Tạo authorization URL và state ngẫu nhiên cho provider
   * @param {'google'|'github'} provider
   * @returns {{ url: string, state: string }}
   */
  function buildAuthorizationUrl(provider) {
    const providerCfg = PROVIDER_CONFIG[provider];
    if (!providerCfg) {
      throw new Error(`Provider không được hỗ trợ: ${provider}`);
    }

    const appCfg = config.providers[provider];
    const state = uuidv4();

    const params = new URLSearchParams({
      client_id: appCfg.clientId,
      redirect_uri: appCfg.callbackUrl,
      response_type: 'code',
      scope: providerCfg.scope,
      state,
    });

    const url = `${providerCfg.authUrl}?${params.toString()}`;
    return { url, state };
  }

  /**
   * Trao đổi authorization code lấy thông tin user từ provider
   * @param {'google'|'github'} provider
   * @param {string} code
   * @returns {Promise<{ id: string, email: string, name: string }>}
   * @throws {OAuthError}
   */
  async function exchangeCodeForUser(provider, code) {
    const providerCfg = PROVIDER_CONFIG[provider];
    const appCfg = config.providers[provider];

    // Bước 1: Đổi code lấy access token từ provider
    let providerAccessToken;
    try {
      const tokenRes = await axios.post(
        providerCfg.tokenUrl,
        {
          client_id: appCfg.clientId,
          client_secret: appCfg.clientSecret,
          code,
          redirect_uri: appCfg.callbackUrl,
          grant_type: 'authorization_code',
        },
        {
          headers: { Accept: 'application/json' },
        }
      );

      if (tokenRes.data.error) {
        throw new OAuthError(`Provider lỗi: ${tokenRes.data.error_description || tokenRes.data.error}`);
      }

      providerAccessToken = tokenRes.data.access_token;
      if (!providerAccessToken) {
        throw new OAuthError('Provider không trả về access_token');
      }
    } catch (err) {
      if (err instanceof OAuthError) throw err;
      throw new OAuthError(`Không thể lấy token từ provider: ${err.message}`);
    }

    // Bước 2: Lấy thông tin user từ provider
    try {
      const userRes = await axios.get(providerCfg.userInfoUrl, {
        headers: { Authorization: `Bearer ${providerAccessToken}` },
      });

      const data = userRes.data;

      if (provider === 'github') {
        return {
          id: String(data.id),
          email: data.email || `${data.login}@github.invalid`,
          name: data.name || data.login,
        };
      }

      // Google
      return {
        id: data.sub,
        email: data.email,
        name: data.name,
      };
    } catch (err) {
      throw new OAuthError(`Không thể lấy thông tin user từ provider: ${err.message}`);
    }
  }

  /**
   * Phát hành access + refresh token sau khi xác thực thành công
   * @param {{ id: string, email: string, name: string }} user
   * @returns {Promise<{ accessToken: string, refreshToken: string }>}
   */
  async function issueTokens(user) {
    const accessToken = jwtUtil.sign(
      { sub: user.id, email: user.email, roles: [] },
      config.jwt.accessTTL
    );

    const refreshToken = uuidv4();
    const refreshTTLSeconds = parseTTLToSeconds(config.jwt.refreshTTL);
    await store.saveRefreshToken(refreshToken, user.id, refreshTTLSeconds);

    return { accessToken, refreshToken };
  }

  return { buildAuthorizationUrl, exchangeCodeForUser, issueTokens };
}

/**
 * Parse TTL string (e.g. '7d', '15m') sang giây
 * @param {string} ttl
 * @returns {number} seconds
 */
function parseTTLToSeconds(ttl) {
  if (typeof ttl === 'number') return ttl;
  const match = String(ttl).match(/^(\d+)(s|m|h|d)$/);
  if (!match) return 7 * 24 * 3600;
  const value = parseInt(match[1], 10);
  const unit = match[2];
  const multipliers = { s: 1, m: 60, h: 3600, d: 86400 };
  return value * multipliers[unit];
}

module.exports = { createOAuthService, OAuthError };
