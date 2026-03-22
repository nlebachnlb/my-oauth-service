'use strict';

/**
 * Integration tests — luồng OAuth end-to-end (mock OAuth provider)
 * Yêu cầu: 1.1–1.5, 2.1–2.4, 4.1–4.4, 5.1–5.4
 */

const crypto = require('crypto');
const request = require('supertest');

// ─── Tạo RSA key pair cho test ────────────────────────────────────────────────
// Phải dùng prefix "mock" để Jest cho phép dùng trong jest.mock() factory
const mockKeyPair = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

// ─── Mock config trước khi require bất kỳ module nào dùng config ─────────────
jest.mock('./config', () => ({
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

// ─── Mock axios để giả lập OAuth provider ────────────────────────────────────
jest.mock('axios');
const axios = require('axios');

// ─── Import các module sau khi mock đã được thiết lập ────────────────────────
const { InMemoryTokenStore } = require('./store/memory.token.store');
const { createOAuthService } = require('./services/oauth.service');
const { createTokenService } = require('./services/token.service');
const { createOAuthController } = require('./controllers/oauth.controller');
const { createTokenController } = require('./controllers/token.controller');
const { createRouter } = require('./routes');
const { errorMiddleware } = require('./middleware/error.middleware');
const express = require('express');

/**
 * Tạo Express app với shared session store để test có thể inject state.
 * Trả về { app, sessionStore } để test có thể set session.oauthState trực tiếp.
 */
function buildApp() {
  const store = new InMemoryTokenStore();
  const oauthService = createOAuthService(store);
  const tokenService = createTokenService(store);
  const oauthController = createOAuthController(oauthService);
  const tokenController = createTokenController(tokenService);

  // sessionStore dùng chung để test có thể inject state
  const sessionStore = {};

  const app = express();
  app.use(express.json());

  // Session middleware đơn giản dùng Map để giữ state giữa các request
  app.use((req, _res, next) => {
    req.session = sessionStore;
    next();
  });

  app.use('/', createRouter(oauthController, tokenController));
  app.use(errorMiddleware);

  return { app, sessionStore, oauthService, tokenService, store };
}

/**
 * Helper: thực hiện luồng OAuth đầy đủ và trả về { accessToken, refreshToken }
 * Dùng sessionStore để inject state trực tiếp, tránh vấn đề session giữa requests.
 */
async function performOAuthFlow(app, sessionStore, provider = 'google', userInfo = null) {
  // Bước 1: GET /auth/:provider để lấy state
  const initRes = await request(app).get(`/auth/${provider}`);
  expect(initRes.status).toBe(302);

  const location = new URL(initRes.headers.location);
  const state = location.searchParams.get('state');

  // Inject state vào sessionStore (giả lập session đã được lưu)
  sessionStore.oauthState = state;

  // Bước 2: Mock axios responses
  const defaultUserInfo = provider === 'github'
    ? { id: 999, login: 'ghuser', email: 'gh@test.com', name: 'GH User' }
    : { sub: 'google-uid-1', email: 'user@gmail.com', name: 'Test User' };

  axios.post.mockResolvedValueOnce({ data: { access_token: `${provider}-provider-token` } });
  axios.get.mockResolvedValueOnce({ data: userInfo || defaultUserInfo });

  // Bước 3: GET /auth/:provider/callback với state đúng
  const callbackRes = await request(app)
    .get(`/auth/${provider}/callback?code=auth-code&state=${state}`);

  return callbackRes;
}

// ─────────────────────────────────────────────────────────────────────────────
// Suite 1: Luồng OAuth đầy đủ — redirect → callback → nhận token
// ─────────────────────────────────────────────────────────────────────────────
describe('Luồng OAuth đầy đủ (redirect → callback → token)', () => {
  let app;
  let sessionStore;

  beforeEach(() => {
    ({ app, sessionStore } = buildApp());
    jest.clearAllMocks();
  });

  // Yêu cầu 1.1 — redirect đến OAuth provider với state và redirect_uri
  it('GET /auth/google — redirect đến Google với state và client_id', async () => {
    const res = await request(app).get('/auth/google');

    expect(res.status).toBe(302);
    const location = new URL(res.headers.location);
    expect(location.hostname).toBe('accounts.google.com');
    expect(location.searchParams.get('client_id')).toBe('google-client-id');
    expect(location.searchParams.get('response_type')).toBe('code');
    expect(location.searchParams.get('state')).toBeTruthy();
  });

  // Yêu cầu 1.1 — redirect đến GitHub
  it('GET /auth/github — redirect đến GitHub với state và client_id', async () => {
    const res = await request(app).get('/auth/github');

    expect(res.status).toBe(302);
    const location = new URL(res.headers.location);
    expect(location.hostname).toBe('github.com');
    expect(location.searchParams.get('client_id')).toBe('github-client-id');
    expect(location.searchParams.get('state')).toBeTruthy();
  });

  // Yêu cầu 1.5 — provider không được hỗ trợ → 400
  it('GET /auth/facebook — trả về 400 với provider không hỗ trợ', async () => {
    const res = await request(app).get('/auth/facebook');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('bad_request');
  });

  // Yêu cầu 1.2, 2.1, 2.2 — callback thành công → nhận accessToken + refreshToken
  it('GET /auth/google/callback — callback hợp lệ trả về accessToken và refreshToken', async () => {
    const callbackRes = await performOAuthFlow(app, sessionStore, 'google');

    expect(callbackRes.status).toBe(200);
    expect(callbackRes.body).toHaveProperty('accessToken');
    expect(callbackRes.body).toHaveProperty('refreshToken');
    expect(typeof callbackRes.body.accessToken).toBe('string');
    expect(typeof callbackRes.body.refreshToken).toBe('string');
  });

  // Yêu cầu 2.3, 2.4 — accessToken được ký RS256 và chứa đúng claims
  it('accessToken trong callback response được ký RS256 với đúng claims', async () => {
    const callbackRes = await performOAuthFlow(app, sessionStore, 'google', {
      sub: 'uid-rs256', email: 'rs256@test.com', name: 'RS256 User',
    });
    expect(callbackRes.status).toBe(200);

    const { accessToken } = callbackRes.body;
    const [headerB64, payloadB64] = accessToken.split('.');
    const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString());
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());

    // Yêu cầu 2.3 — RS256
    expect(header.alg).toBe('RS256');

    // Yêu cầu 2.4 — claims bắt buộc
    expect(payload.sub).toBe('uid-rs256');
    expect(payload.email).toBe('rs256@test.com');
    expect(payload).toHaveProperty('iat');
    expect(payload).toHaveProperty('exp');
    expect(payload).toHaveProperty('jti');
  });

  // Yêu cầu 1.3 — state không khớp → 400
  it('GET /auth/google/callback — state không khớp trả về 400', async () => {
    // Khởi tạo session với state hợp lệ
    sessionStore.oauthState = 'valid-state-123';

    const res = await request(app)
      .get('/auth/google/callback?code=code&state=wrong-state');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_state');
  });

  // Yêu cầu 1.4 — OAuth provider trả về lỗi → 502
  it('GET /auth/google/callback — provider lỗi trả về 502', async () => {
    const initRes = await request(app).get('/auth/google');
    const location = new URL(initRes.headers.location);
    const state = location.searchParams.get('state');
    sessionStore.oauthState = state;

    axios.post.mockResolvedValueOnce({
      data: { error: 'invalid_grant', error_description: 'Code đã hết hạn' },
    });

    const res = await request(app)
      .get(`/auth/google/callback?code=bad-code&state=${state}`);

    expect(res.status).toBe(502);
    expect(res.body.error).toBe('provider_error');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 2: Luồng refresh token
// ─────────────────────────────────────────────────────────────────────────────
describe('Luồng refresh token', () => {
  let app;
  let sessionStore;
  let accessToken;
  let refreshToken;

  beforeEach(async () => {
    ({ app, sessionStore } = buildApp());
    jest.clearAllMocks();

    const callbackRes = await performOAuthFlow(app, sessionStore, 'google', {
      sub: 'user-refresh-1', email: 'refresh@test.com', name: 'Refresh User',
    });
    expect(callbackRes.status).toBe(200);
    accessToken = callbackRes.body.accessToken;
    refreshToken = callbackRes.body.refreshToken;
  });

  // Yêu cầu 4.1 — refresh token hợp lệ → access token mới
  it('POST /token/refresh — trả về token pair mới khi refreshToken hợp lệ', async () => {
    const res = await request(app)
      .post('/token/refresh')
      .send({ refreshToken });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');
    expect(res.body.accessToken).not.toBe(accessToken);
    expect(res.body.refreshToken).not.toBe(refreshToken);
  });

  // Yêu cầu 4.2 — refresh token cũ bị vô hiệu hóa sau khi xoay vòng
  it('POST /token/refresh — refresh token cũ không còn hợp lệ sau khi xoay vòng', async () => {
    const firstRes = await request(app)
      .post('/token/refresh')
      .send({ refreshToken });
    expect(firstRes.status).toBe(200);

    // Dùng lại refresh token cũ → phải thất bại
    const secondRes = await request(app)
      .post('/token/refresh')
      .send({ refreshToken });
    expect(secondRes.status).toBe(401);
    expect(secondRes.body.error).toBe('refresh_token_invalid');
  });

  // Yêu cầu 4.3 — refresh token không tồn tại → 401
  it('POST /token/refresh — refresh token không tồn tại trả về 401', async () => {
    const res = await request(app)
      .post('/token/refresh')
      .send({ refreshToken: 'non-existent-token' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('refresh_token_invalid');
  });

  // Yêu cầu 4.1 — access token mới từ refresh có thể verify được
  it('POST /token/refresh — access token mới có thể verify thành công', async () => {
    const refreshRes = await request(app)
      .post('/token/refresh')
      .send({ refreshToken });
    expect(refreshRes.status).toBe(200);

    const verifyRes = await request(app)
      .post('/token/verify')
      .send({ accessToken: refreshRes.body.accessToken });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.sub).toBe('user-refresh-1');
  });

  // Yêu cầu 4.1 — access token mới có TTL từ ACCESS_TOKEN_TTL config
  it('POST /token/refresh — access token mới có exp hợp lệ', async () => {
    const refreshRes = await request(app)
      .post('/token/refresh')
      .send({ refreshToken });
    expect(refreshRes.status).toBe(200);

    const { accessToken: newToken } = refreshRes.body;
    const [, payloadB64] = newToken.split('.');
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());

    const now = Math.floor(Date.now() / 1000);
    expect(payload.exp).toBeGreaterThan(now);
    // ACCESS_TOKEN_TTL = 15m = 900s, cho phép sai số 5s
    expect(payload.exp - payload.iat).toBeCloseTo(900, -2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 3: Luồng verify token
// ─────────────────────────────────────────────────────────────────────────────
describe('Luồng verify token', () => {
  let app;
  let sessionStore;
  let accessToken;

  beforeEach(async () => {
    ({ app, sessionStore } = buildApp());
    jest.clearAllMocks();

    const callbackRes = await performOAuthFlow(app, sessionStore, 'github', {
      id: 999, login: 'ghuser', email: 'gh@test.com', name: 'GH User',
    });
    expect(callbackRes.status).toBe(200);
    accessToken = callbackRes.body.accessToken;
  });

  // Yêu cầu 3.1, 3.2 — token hợp lệ → 200 với payload
  it('POST /token/verify — token hợp lệ trả về 200 với payload', async () => {
    const res = await request(app)
      .post('/token/verify')
      .send({ accessToken });

    expect(res.status).toBe(200);
    expect(res.body.sub).toBe('999');
    expect(res.body.email).toBe('gh@test.com');
    expect(res.body).toHaveProperty('exp');
  });

  // Yêu cầu 3.3 — chữ ký không hợp lệ → 401
  it('POST /token/verify — token chữ ký sai trả về 401', async () => {
    const res = await request(app)
      .post('/token/verify')
      .send({ accessToken: 'invalid.jwt.token' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('token_invalid');
  });

  // Yêu cầu 6.4 — chuỗi JWT không hợp lệ → lỗi mô tả, không crash
  it('POST /token/verify — chuỗi không hợp lệ không crash server', async () => {
    const res = await request(app)
      .post('/token/verify')
      .send({ accessToken: 'not-a-jwt-at-all' });

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  // Yêu cầu 3.4 — token hết hạn → 401 token_expired
  it('POST /token/verify — token hết hạn trả về 401 token_expired', async () => {
    const jwtUtil = require('./utils/jwt.util');
    const expiredToken = jwtUtil.sign(
      { sub: 'user-x', email: 'x@test.com', roles: [] },
      '-1s'
    );

    const res = await request(app)
      .post('/token/verify')
      .send({ accessToken: expiredToken });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('token_expired');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 4: Luồng revoke token (đăng xuất)
// ─────────────────────────────────────────────────────────────────────────────
describe('Luồng revoke token (đăng xuất)', () => {
  let app;
  let sessionStore;
  let accessToken;
  let refreshToken;

  beforeEach(async () => {
    ({ app, sessionStore } = buildApp());
    jest.clearAllMocks();

    const callbackRes = await performOAuthFlow(app, sessionStore, 'google', {
      sub: 'user-revoke-1', email: 'revoke@test.com', name: 'Revoke User',
    });
    expect(callbackRes.status).toBe(200);
    accessToken = callbackRes.body.accessToken;
    refreshToken = callbackRes.body.refreshToken;
  });

  // Yêu cầu 5.3 — revoke thành công → 200
  it('POST /token/revoke — trả về 200 khi revoke thành công', async () => {
    const res = await request(app)
      .post('/token/revoke')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('ok');
  });

  // Yêu cầu 5.1, 3.5 — sau khi revoke, verify phải trả về 401 token_revoked
  it('POST /token/verify — trả về 401 token_revoked sau khi đã revoke', async () => {
    await request(app)
      .post('/token/revoke')
      .set('Authorization', `Bearer ${accessToken}`);

    const verifyRes = await request(app)
      .post('/token/verify')
      .send({ accessToken });

    expect(verifyRes.status).toBe(401);
    expect(verifyRes.body.error).toBe('token_revoked');
  });

  // Yêu cầu 5.4 — token không hợp lệ tại endpoint revoke → 401
  it('POST /token/revoke — token không hợp lệ trả về 401', async () => {
    const res = await request(app)
      .post('/token/revoke')
      .set('Authorization', 'Bearer invalid.token.here');

    expect(res.status).toBe(401);
  });

  // Yêu cầu 5.4 — thiếu Authorization header → 401
  it('POST /token/revoke — thiếu Authorization header trả về 401', async () => {
    const res = await request(app).post('/token/revoke');

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('token_invalid');
  });

  // Yêu cầu 5.1, 5.2 — sau revoke, access token bị từ chối; refresh token vẫn hoạt động
  it('POST /token/revoke — sau revoke, access token bị từ chối nhưng refresh token vẫn hoạt động', async () => {
    // Revoke access token
    await request(app)
      .post('/token/revoke')
      .set('Authorization', `Bearer ${accessToken}`);

    // Access token bị từ chối
    const verifyRes = await request(app)
      .post('/token/verify')
      .send({ accessToken });
    expect(verifyRes.status).toBe(401);
    expect(verifyRes.body.error).toBe('token_revoked');

    // Refresh token vẫn có thể dùng để lấy access token mới
    const refreshRes = await request(app)
      .post('/token/refresh')
      .send({ refreshToken });
    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body).toHaveProperty('accessToken');
  });
});
