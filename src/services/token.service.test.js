'use strict';

/**
 * Unit tests cho Token Service
 * Yêu cầu: 3.3, 3.4, 3.5, 4.3, 4.4, 5.4
 */

const crypto = require('crypto');

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
const { createTokenService, UnauthorizedError } = require('./token.service');
const jwtUtil = require('../utils/jwt.util');

describe('TokenService — verifyAccessToken', () => {
  let store;
  let tokenService;

  beforeEach(() => {
    store = new InMemoryTokenStore();
    tokenService = createTokenService(store);
  });

  // Yêu cầu 3.1, 3.2
  test('trả về payload khi token hợp lệ', async () => {
    const token = jwtUtil.sign({ sub: 'user-1', email: 'user@test.com', roles: ['user'] }, '15m');
    const payload = await tokenService.verifyAccessToken(token);

    expect(payload.sub).toBe('user-1');
    expect(payload.email).toBe('user@test.com');
    expect(payload.roles).toEqual(['user']);
  });

  // Yêu cầu 3.5
  test('ném UnauthorizedError với code token_revoked khi token bị revoke', async () => {
    const token = jwtUtil.sign({ sub: 'user-2', email: 'u2@test.com', roles: [] }, '15m');
    const decoded = jwtUtil.decode(token);

    // Revoke jti
    await store.revokeAccessToken(decoded.jti, 900);

    await expect(tokenService.verifyAccessToken(token)).rejects.toMatchObject({
      name: 'UnauthorizedError',
      statusCode: 401,
      code: 'token_revoked',
    });
  });

  // Yêu cầu 3.4
  test('ném UnauthorizedError với code token_expired khi token hết hạn', async () => {
    const jwt = require('jsonwebtoken');
    const expiredToken = jwt.sign(
      { sub: 'user-3', email: 'u3@test.com', roles: [] },
      mockKeyPair.privateKey,
      { algorithm: 'RS256', expiresIn: -1, issuer: 'test-issuer' },
    );

    await expect(tokenService.verifyAccessToken(expiredToken)).rejects.toMatchObject({
      name: 'UnauthorizedError',
      statusCode: 401,
      code: 'token_expired',
    });
  });

  // Yêu cầu 3.3
  test('ném UnauthorizedError với code token_invalid khi token không hợp lệ', async () => {
    await expect(tokenService.verifyAccessToken('not.a.valid.token')).rejects.toMatchObject({
      name: 'UnauthorizedError',
      statusCode: 401,
      code: 'token_invalid',
    });
  });
});

describe('TokenService — refreshTokens', () => {
  let store;
  let tokenService;

  beforeEach(() => {
    store = new InMemoryTokenStore();
    tokenService = createTokenService(store);
  });

  // Yêu cầu 4.3
  test('ném UnauthorizedError khi refresh token không tồn tại trong store', async () => {
    await expect(tokenService.refreshTokens('nonexistent-refresh-token')).rejects.toMatchObject({
      name: 'UnauthorizedError',
      statusCode: 401,
      code: 'refresh_token_invalid',
    });
  });

  // Yêu cầu 4.4
  test('ném UnauthorizedError khi refresh token đã hết hạn', async () => {
    await store.saveRefreshToken('expired-token', 'user-1', 0); // TTL = 0s
    await new Promise((r) => setTimeout(r, 1)); // đợi hết hạn

    await expect(tokenService.refreshTokens('expired-token')).rejects.toMatchObject({
      name: 'UnauthorizedError',
      statusCode: 401,
      code: 'refresh_token_invalid',
    });
  });

  // Yêu cầu 4.1, 4.2
  test('trả về accessToken và refreshToken mới khi refresh token hợp lệ', async () => {
    await store.saveRefreshToken('valid-refresh-token', 'user-42', 3600);

    const result = await tokenService.refreshTokens('valid-refresh-token');

    expect(result).toHaveProperty('accessToken');
    expect(result).toHaveProperty('refreshToken');
    expect(typeof result.accessToken).toBe('string');
    expect(typeof result.refreshToken).toBe('string');
    expect(result.refreshToken).not.toBe('valid-refresh-token');
  });

  // Yêu cầu 4.2 — rotation: token cũ bị xóa
  test('refresh token cũ không còn hợp lệ sau khi rotation', async () => {
    await store.saveRefreshToken('old-token', 'user-99', 3600);
    await tokenService.refreshTokens('old-token');

    const userId = await store.getRefreshToken('old-token');
    expect(userId).toBeNull();
  });
});

describe('TokenService — revokeTokens', () => {
  let store;
  let tokenService;

  beforeEach(() => {
    store = new InMemoryTokenStore();
    tokenService = createTokenService(store);
  });

  // Yêu cầu 5.4
  test('ném UnauthorizedError khi access token không hợp lệ (chuỗi rác)', async () => {
    await expect(tokenService.revokeTokens('garbage-token')).rejects.toMatchObject({
      name: 'UnauthorizedError',
      statusCode: 401,
      code: 'token_invalid',
    });
  });

  // Yêu cầu 5.1 — jti được thêm vào revocation list
  test('sau khi revokeTokens, jti của token bị đánh dấu là revoked', async () => {
    const token = jwtUtil.sign({ sub: 'user-5', email: 'u5@test.com', roles: [] }, '15m');
    const decoded = jwtUtil.decode(token);

    await tokenService.revokeTokens(token);

    const revoked = await store.isRevoked(decoded.jti);
    expect(revoked).toBe(true);
  });

  // Yêu cầu 5.3
  test('trả về undefined (không ném lỗi) khi revoke thành công', async () => {
    const token = jwtUtil.sign({ sub: 'user-6', email: 'u6@test.com', roles: [] }, '15m');
    await expect(tokenService.revokeTokens(token)).resolves.toBeUndefined();
  });
});
