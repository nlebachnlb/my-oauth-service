'use strict';

/**
 * Unit tests cho OAuth Service
 * Yêu cầu: 1.4, 2.1, 2.2
 */

const crypto = require('crypto');

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
    google: {
      clientId: 'google-client-id',
      clientSecret: 'google-client-secret',
      callbackUrl: 'http://localhost:3000/auth/google/callback',
    },
    github: {
      clientId: 'github-client-id',
      clientSecret: 'github-client-secret',
      callbackUrl: 'http://localhost:3000/auth/github/callback',
    },
  },
  redis: { url: 'redis://localhost:6379' },
}));

jest.mock('axios');

const axios = require('axios');
const { InMemoryTokenStore } = require('../store/memory.token.store');
const { createOAuthService, OAuthError } = require('./oauth.service');

describe('OAuthService — buildAuthorizationUrl', () => {
  let store;
  let oauthService;

  beforeEach(() => {
    store = new InMemoryTokenStore();
    oauthService = createOAuthService(store);
  });

  // Yêu cầu 1.1
  test('tạo URL Google đúng với client_id, redirect_uri, scope và state', () => {
    const { url, state } = oauthService.buildAuthorizationUrl('google');

    expect(typeof state).toBe('string');
    expect(state.length).toBeGreaterThan(0);

    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(parsed.searchParams.get('client_id')).toBe('google-client-id');
    expect(parsed.searchParams.get('redirect_uri')).toBe('http://localhost:3000/auth/google/callback');
    expect(parsed.searchParams.get('response_type')).toBe('code');
    expect(parsed.searchParams.get('state')).toBe(state);
    expect(parsed.searchParams.get('scope')).toContain('email');
  });

  // Yêu cầu 1.1
  test('tạo URL GitHub đúng với client_id, redirect_uri, scope và state', () => {
    const { url, state } = oauthService.buildAuthorizationUrl('github');

    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe('https://github.com/login/oauth/authorize');
    expect(parsed.searchParams.get('client_id')).toBe('github-client-id');
    expect(parsed.searchParams.get('redirect_uri')).toBe('http://localhost:3000/auth/github/callback');
    expect(parsed.searchParams.get('state')).toBe(state);
  });

  // Yêu cầu 1.1
  test('mỗi lần gọi tạo state khác nhau', () => {
    const { state: state1 } = oauthService.buildAuthorizationUrl('google');
    const { state: state2 } = oauthService.buildAuthorizationUrl('google');
    expect(state1).not.toBe(state2);
  });

  test('ném lỗi khi provider không được hỗ trợ', () => {
    expect(() => oauthService.buildAuthorizationUrl('facebook')).toThrow();
  });
});

describe('OAuthService — exchangeCodeForUser', () => {
  let store;
  let oauthService;

  beforeEach(() => {
    store = new InMemoryTokenStore();
    oauthService = createOAuthService(store);
    jest.clearAllMocks();
  });

  // Yêu cầu 1.2
  test('trả về { id, email, name } khi Google trả về thành công', async () => {
    axios.post.mockResolvedValueOnce({
      data: { access_token: 'google-access-token' },
    });
    axios.get.mockResolvedValueOnce({
      data: { sub: 'google-user-123', email: 'user@gmail.com', name: 'Test User' },
    });

    const user = await oauthService.exchangeCodeForUser('google', 'auth-code');

    expect(user).toEqual({ id: 'google-user-123', email: 'user@gmail.com', name: 'Test User' });
  });

  // Yêu cầu 1.2
  test('trả về { id, email, name } khi GitHub trả về thành công', async () => {
    axios.post.mockResolvedValueOnce({
      data: { access_token: 'github-access-token' },
    });
    axios.get.mockResolvedValueOnce({
      data: { id: 456, login: 'ghuser', email: 'ghuser@github.com', name: 'GH User' },
    });

    const user = await oauthService.exchangeCodeForUser('github', 'auth-code');

    expect(user).toEqual({ id: '456', email: 'ghuser@github.com', name: 'GH User' });
  });

  // Yêu cầu 1.4 — provider trả về lỗi trong body
  test('ném OAuthError khi provider trả về error trong response body', async () => {
    axios.post.mockResolvedValueOnce({
      data: { error: 'bad_verification_code', error_description: 'Code đã hết hạn' },
    });

    await expect(oauthService.exchangeCodeForUser('github', 'bad-code')).rejects.toMatchObject({
      name: 'OAuthError',
      statusCode: 502,
      code: 'provider_error',
    });
  });

  // Yêu cầu 1.4 — axios ném lỗi network
  test('ném OAuthError khi axios ném lỗi network', async () => {
    axios.post.mockRejectedValueOnce(new Error('Network Error'));

    await expect(oauthService.exchangeCodeForUser('google', 'code')).rejects.toMatchObject({
      name: 'OAuthError',
      statusCode: 502,
    });
  });

  // Yêu cầu 1.4 — không có access_token trong response
  test('ném OAuthError khi provider không trả về access_token', async () => {
    axios.post.mockResolvedValueOnce({ data: {} });

    await expect(oauthService.exchangeCodeForUser('google', 'code')).rejects.toMatchObject({
      name: 'OAuthError',
      statusCode: 502,
    });
  });

  // Yêu cầu 1.4 — lỗi khi lấy user info
  test('ném OAuthError khi lấy user info thất bại', async () => {
    axios.post.mockResolvedValueOnce({
      data: { access_token: 'valid-token' },
    });
    axios.get.mockRejectedValueOnce(new Error('Unauthorized'));

    await expect(oauthService.exchangeCodeForUser('google', 'code')).rejects.toMatchObject({
      name: 'OAuthError',
      statusCode: 502,
    });
  });
});

describe('OAuthService — issueTokens', () => {
  let store;
  let oauthService;

  beforeEach(() => {
    store = new InMemoryTokenStore();
    oauthService = createOAuthService(store);
  });

  // Yêu cầu 2.1, 2.2
  test('trả về accessToken và refreshToken', async () => {
    const user = { id: 'user-1', email: 'user@test.com', name: 'Test' };
    const result = await oauthService.issueTokens(user);

    expect(result).toHaveProperty('accessToken');
    expect(result).toHaveProperty('refreshToken');
    expect(typeof result.accessToken).toBe('string');
    expect(typeof result.refreshToken).toBe('string');
  });

  // Yêu cầu 2.2 — refresh token được lưu vào store
  test('lưu refresh token vào store với userId đúng', async () => {
    const user = { id: 'user-42', email: 'u42@test.com', name: 'User 42' };
    const { refreshToken } = await oauthService.issueTokens(user);

    const storedUserId = await store.getRefreshToken(refreshToken);
    expect(storedUserId).toBe('user-42');
  });

  // Yêu cầu 2.1 — access token chứa đúng claims
  test('accessToken chứa sub và email đúng', async () => {
    const jwtUtil = require('../utils/jwt.util');
    const user = { id: 'user-99', email: 'u99@test.com', name: 'User 99' };
    const { accessToken } = await oauthService.issueTokens(user);

    const payload = jwtUtil.verify(accessToken);
    expect(payload.sub).toBe('user-99');
    expect(payload.email).toBe('u99@test.com');
  });

  // Yêu cầu 2.2 — mỗi lần gọi tạo refresh token khác nhau
  test('mỗi lần issueTokens tạo refresh token duy nhất', async () => {
    const user = { id: 'user-1', email: 'u1@test.com', name: 'U1' };
    const { refreshToken: rt1 } = await oauthService.issueTokens(user);
    const { refreshToken: rt2 } = await oauthService.issueTokens(user);

    expect(rt1).not.toBe(rt2);
  });
});
