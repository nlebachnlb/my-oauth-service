'use strict';

const { createTokenController } = require('./token.controller');

// Mock UnauthorizedError
class UnauthorizedError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'UnauthorizedError';
    this.statusCode = 401;
    this.code = code;
  }
}

function makeReq(overrides = {}) {
  return {
    body: {},
    headers: {},
    ...overrides,
  };
}

function makeRes() {
  const res = { _json: null, _status: 200 };
  res.json = jest.fn((data) => { res._json = data; return res; });
  res.status = jest.fn((code) => { res._status = code; return res; });
  return res;
}

function makeNext() {
  return jest.fn();
}

describe('TokenController', () => {
  let tokenService;
  let controller;

  beforeEach(() => {
    tokenService = {
      verifyAccessToken: jest.fn(),
      refreshTokens: jest.fn(),
      revokeTokens: jest.fn(),
    };
    controller = createTokenController(tokenService);
  });

  describe('verify', () => {
    // Test 1: trả về payload khi token hợp lệ
    it('returns payload on valid token', async () => {
      const fakePayload = { sub: 'user-1', email: 'user@example.com', roles: [] };
      tokenService.verifyAccessToken.mockResolvedValue(fakePayload);

      const req = makeReq({ body: { accessToken: 'valid.jwt.token' } });
      const res = makeRes();
      const next = makeNext();

      await controller.verify(req, res, next);

      expect(tokenService.verifyAccessToken).toHaveBeenCalledWith('valid.jwt.token');
      expect(res.json).toHaveBeenCalledWith(fakePayload);
      expect(next).not.toHaveBeenCalled();
    });

    // Test 2: gọi next với UnauthorizedError khi token_expired
    it('calls next with UnauthorizedError when verifyAccessToken throws token_expired', async () => {
      const err = new UnauthorizedError('Token đã hết hạn', 'token_expired');
      tokenService.verifyAccessToken.mockRejectedValue(err);

      const req = makeReq({ body: { accessToken: 'expired.jwt.token' } });
      const res = makeRes();
      const next = makeNext();

      await controller.verify(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
      expect(next.mock.calls[0][0].code).toBe('token_expired');
      expect(res.json).not.toHaveBeenCalled();
    });

    // Test 3: gọi next với UnauthorizedError khi token_revoked
    it('calls next with UnauthorizedError when verifyAccessToken throws token_revoked', async () => {
      const err = new UnauthorizedError('Token đã bị thu hồi', 'token_revoked');
      tokenService.verifyAccessToken.mockRejectedValue(err);

      const req = makeReq({ body: { accessToken: 'revoked.jwt.token' } });
      const res = makeRes();
      const next = makeNext();

      await controller.verify(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
      expect(next.mock.calls[0][0].code).toBe('token_revoked');
    });

    // Test 4: gọi next với 400 khi accessToken thiếu trong body
    it('calls next with 400 when accessToken is missing from body', async () => {
      const req = makeReq({ body: {} });
      const res = makeRes();
      const next = makeNext();

      await controller.verify(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err.statusCode).toBe(400);
      expect(err.code).toBe('bad_request');
      expect(err.message).toBe('accessToken is required');
      expect(tokenService.verifyAccessToken).not.toHaveBeenCalled();
    });
  });

  describe('refresh', () => {
    // Test 5: trả về token pair mới khi thành công
    it('returns new token pair on success', async () => {
      const newTokens = { accessToken: 'new.access.token', refreshToken: 'new-refresh-token' };
      tokenService.refreshTokens.mockResolvedValue(newTokens);

      const req = makeReq({ body: { refreshToken: 'old-refresh-token' } });
      const res = makeRes();
      const next = makeNext();

      await controller.refresh(req, res, next);

      expect(tokenService.refreshTokens).toHaveBeenCalledWith('old-refresh-token');
      expect(res.json).toHaveBeenCalledWith(newTokens);
      expect(next).not.toHaveBeenCalled();
    });

    // Test 6: gọi next với UnauthorizedError khi refresh_token_invalid
    it('calls next with UnauthorizedError when refreshTokens throws refresh_token_invalid', async () => {
      const err = new UnauthorizedError('Refresh token không hợp lệ', 'refresh_token_invalid');
      tokenService.refreshTokens.mockRejectedValue(err);

      const req = makeReq({ body: { refreshToken: 'invalid-refresh-token' } });
      const res = makeRes();
      const next = makeNext();

      await controller.refresh(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
      expect(next.mock.calls[0][0].code).toBe('refresh_token_invalid');
      expect(res.json).not.toHaveBeenCalled();
    });
  });

  describe('revoke', () => {
    // Test 7: trả về { message: 'ok' } khi thành công
    it('returns { message: "ok" } on success', async () => {
      tokenService.revokeTokens.mockResolvedValue(undefined);

      const req = makeReq({
        headers: { authorization: 'Bearer valid.access.token' },
      });
      const res = makeRes();
      const next = makeNext();

      await controller.revoke(req, res, next);

      expect(tokenService.revokeTokens).toHaveBeenCalledWith('valid.access.token');
      expect(res.json).toHaveBeenCalledWith({ message: 'ok' });
      expect(next).not.toHaveBeenCalled();
    });

    // Test 8: gọi next với 401 khi Authorization header thiếu
    it('calls next with 401 when Authorization header is missing', async () => {
      const req = makeReq({ headers: {} });
      const res = makeRes();
      const next = makeNext();

      await controller.revoke(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err.statusCode).toBe(401);
      expect(err.code).toBe('token_invalid');
      expect(err.message).toBe('Authorization header required');
      expect(tokenService.revokeTokens).not.toHaveBeenCalled();
    });
  });
});
