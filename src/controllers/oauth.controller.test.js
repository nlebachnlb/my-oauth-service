'use strict';

const { createOAuthController } = require('./oauth.controller');

// Mock OAuthError
class OAuthError extends Error {
  constructor(message) {
    super(message);
    this.name = 'OAuthError';
    this.statusCode = 502;
    this.code = 'provider_error';
  }
}

/**
 * Helper tạo mock req/res/next
 */
function makeReq(overrides = {}) {
  return {
    params: {},
    query: {},
    session: { save: jest.fn((cb) => cb(null)) },
    ...overrides,
  };
}

function makeRes() {
  const res = {
    _redirectUrl: null,
    _json: null,
    _status: 200,
  };
  res.redirect = jest.fn((url) => { res._redirectUrl = url; return res; });
  res.json = jest.fn((data) => { res._json = data; return res; });
  res.status = jest.fn((code) => { res._status = code; return res; });
  return res;
}

function makeNext() {
  return jest.fn();
}

describe('OAuthController', () => {
  let oauthService;
  let controller;

  beforeEach(() => {
    oauthService = {
      buildAuthorizationUrl: jest.fn(),
      exchangeCodeForUser: jest.fn(),
      issueTokens: jest.fn(),
    };
    controller = createOAuthController(oauthService);
  });

  // Test 1: initiateAuth — redirect đúng URL và lưu state vào session
  describe('initiateAuth', () => {
    it('redirects to the URL returned by buildAuthorizationUrl and stores state in session', () => {
      const fakeUrl = 'https://accounts.google.com/o/oauth2/v2/auth?state=abc123';
      const fakeState = 'abc123';
      oauthService.buildAuthorizationUrl.mockReturnValue({ url: fakeUrl, state: fakeState });

      const req = makeReq({ params: { provider: 'google' } });
      const res = makeRes();
      const next = makeNext();

      controller.initiateAuth(req, res, next);

      expect(oauthService.buildAuthorizationUrl).toHaveBeenCalledWith('google');
      expect(req.session.oauthState).toBe(fakeState);
      expect(res.redirect).toHaveBeenCalledWith(fakeUrl);
      expect(next).not.toHaveBeenCalled();
    });

    // Test 2: initiateAuth — gọi next với 400 khi provider không được hỗ trợ
    it('calls next with 400 error for unsupported provider', () => {
      const req = makeReq({ params: { provider: 'facebook' } });
      const res = makeRes();
      const next = makeNext();

      controller.initiateAuth(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err.statusCode).toBe(400);
      expect(err.code).toBe('bad_request');
      expect(res.redirect).not.toHaveBeenCalled();
    });
  });

  describe('handleCallback', () => {
    // Test 3: handleCallback — gọi next với 400 invalid_state khi state không khớp
    it('calls next with 400 invalid_state when state mismatches', async () => {
      const req = makeReq({
        params: { provider: 'google' },
        query: { state: 'wrong-state', code: 'somecode' },
        session: { oauthState: 'correct-state' },
      });
      const res = makeRes();
      const next = makeNext();

      await controller.handleCallback(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err.statusCode).toBe(400);
      expect(err.code).toBe('invalid_state');
      expect(err.message).toBe('State parameter mismatch');
    });

    // Test 4: handleCallback — trả về { accessToken, refreshToken } khi thành công
    it('returns { accessToken, refreshToken } on success', async () => {
      const fakeUser = { id: 'user-1', email: 'user@example.com', name: 'User' };
      const fakeTokens = { accessToken: 'access.jwt.token', refreshToken: 'refresh-opaque' };

      oauthService.exchangeCodeForUser.mockResolvedValue(fakeUser);
      oauthService.issueTokens.mockResolvedValue(fakeTokens);

      const req = makeReq({
        params: { provider: 'github' },
        query: { state: 'matching-state', code: 'valid-code' },
        session: { oauthState: 'matching-state' },
      });
      const res = makeRes();
      const next = makeNext();

      await controller.handleCallback(req, res, next);

      expect(oauthService.exchangeCodeForUser).toHaveBeenCalledWith('github', 'valid-code');
      expect(oauthService.issueTokens).toHaveBeenCalledWith(fakeUser);
      expect(res.json).toHaveBeenCalledWith(fakeTokens);
      expect(next).not.toHaveBeenCalled();
      // State phải được xóa sau khi kiểm tra
      expect(req.session.oauthState).toBeUndefined();
    });

    // Test 5: handleCallback — forward OAuthError khi exchangeCodeForUser throw
    it('forwards OAuthError to next when exchangeCodeForUser throws', async () => {
      const oauthErr = new OAuthError('Provider returned error');
      oauthService.exchangeCodeForUser.mockRejectedValue(oauthErr);

      const req = makeReq({
        params: { provider: 'google' },
        query: { state: 'same-state', code: 'bad-code' },
        session: { oauthState: 'same-state' },
      });
      const res = makeRes();
      const next = makeNext();

      await controller.handleCallback(req, res, next);

      expect(next).toHaveBeenCalledWith(oauthErr);
      expect(res.json).not.toHaveBeenCalled();
    });
  });
});
