'use strict';

/**
 * Property-based test cho Token Service
 * Property 4: Refresh token rotation
 * Validates: Yêu cầu 4.2
 *
 * Sau khi refreshTokens(), refresh token cũ phải không còn hợp lệ trong store.
 */

const crypto = require('crypto');
const fc = require('fast-check');

// Tạo RSA key pair thật cho test
const mockKeyPair = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

jest.mock('../config', () => ({
  jwt: {
    privateKey: mockKeyPair.privateKey,
    publicKey: mockKeyPair.publicKey,
    issuer: 'test-issuer',
    audience: undefined,
    accessTTL: '15m',
    refreshTTL: '7d',
  },
  providers: {
    google: { clientId: 'g-id', clientSecret: 'g-secret', callbackUrl: '' },
    github: { clientId: 'gh-id', clientSecret: 'gh-secret', callbackUrl: '' },
  },
  redis: { url: 'redis://localhost:6379' },
}));

const { InMemoryTokenStore } = require('../store/memory.token.store');
const { createTokenService } = require('./token.service');

// Arbitraries
const userIdArb = fc.string({ minLength: 1, maxLength: 64 }).filter((s) => s.trim().length > 0);
const refreshTokenArb = fc.string({ minLength: 8, maxLength: 128 }).filter((s) => s.trim().length > 0);

describe('Token Service — Property Tests', () => {
  /**
   * Property 4: Refresh token rotation
   * Validates: Yêu cầu 4.2
   *
   * Với mọi (userId, refreshToken) hợp lệ:
   * Sau khi gọi refreshTokens(oldRefreshToken), store.getRefreshToken(oldRefreshToken) phải trả về null.
   */
  test('Property 4: sau khi refreshTokens, refresh token cũ phải không còn hợp lệ', async () => {
    await fc.assert(
      fc.asyncProperty(userIdArb, refreshTokenArb, async (userId, oldRefreshToken) => {
        const store = new InMemoryTokenStore();
        const tokenService = createTokenService(store);

        // Lưu refresh token cũ vào store
        await store.saveRefreshToken(oldRefreshToken, userId, 3600);

        // Thực hiện rotation
        const result = await tokenService.refreshTokens(oldRefreshToken);

        // Refresh token cũ phải không còn hợp lệ
        const oldTokenUserId = await store.getRefreshToken(oldRefreshToken);

        // Refresh token mới phải khác token cũ
        const newTokenIsValid = await store.getRefreshToken(result.refreshToken);

        return oldTokenUserId === null && newTokenIsValid === userId;
      }),
      { numRuns: 100 },
    );
  });
});
