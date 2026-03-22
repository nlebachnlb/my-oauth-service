'use strict';

/**
 * Factory function tạo TokenController
 * @param {object} tokenService
 */
function createTokenController(tokenService) {
  /**
   * POST /token/verify
   * Đọc accessToken từ body, xác minh và trả về payload
   */
  async function verify(req, res, next) {
    const { accessToken } = req.body || {};

    if (!accessToken) {
      const err = new Error('accessToken is required');
      err.statusCode = 400;
      err.code = 'bad_request';
      return next(err);
    }

    try {
      const payload = await tokenService.verifyAccessToken(accessToken);
      return res.json(payload);
    } catch (err) {
      return next(err);
    }
  }

  /**
   * POST /token/refresh
   * Đọc refreshToken từ body, làm mới và trả về token pair mới
   */
  async function refresh(req, res, next) {
    const { refreshToken } = req.body || {};

    if (!refreshToken) {
      const err = new Error('refreshToken is required');
      err.statusCode = 400;
      err.code = 'bad_request';
      return next(err);
    }

    try {
      const tokens = await tokenService.refreshTokens(refreshToken);
      return res.json({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
    } catch (err) {
      return next(err);
    }
  }

  /**
   * POST /token/revoke
   * Đọc access token từ Authorization: Bearer header, thu hồi token
   */
  async function revoke(req, res, next) {
    const authHeader = req.headers && req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      const err = new Error('Authorization header required');
      err.statusCode = 401;
      err.code = 'token_invalid';
      return next(err);
    }

    const accessToken = authHeader.slice(7); // strip "Bearer "

    try {
      await tokenService.revokeTokens(accessToken);
      return res.json({ message: 'ok' });
    } catch (err) {
      return next(err);
    }
  }

  return { verify, refresh, revoke };
}

module.exports = { createTokenController };
