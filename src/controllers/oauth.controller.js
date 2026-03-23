'use strict';

const SUPPORTED_PROVIDERS = ['google', 'github'];

/**
 * Factory function tạo OAuthController
 * @param {object} oauthService
 */
function createOAuthController(oauthService) {
  /**
   * GET /auth/:provider
   * Validate provider, tạo authorization URL, lưu state vào session, redirect
   */
  function initiateAuth(req, res, next) {
    const { provider } = req.params;

    if (!SUPPORTED_PROVIDERS.includes(provider)) {
      const err = new Error(`Provider không được hỗ trợ: ${provider}`);
      err.statusCode = 400;
      err.code = 'bad_request';
      return next(err);
    }

    let result;
    try {
      result = oauthService.buildAuthorizationUrl(provider);
    } catch (err) {
      return next(err);
    }

    const { url, state } = result;
    req.session.oauthState = state;
    console.log('[oauth] initiateAuth sessionID:', req.sessionID, 'state:', state);
    return res.redirect(url);
  }

  /**
   * GET /auth/:provider/callback
   * Validate provider, kiểm tra state, trao đổi code, phát hành token
   */
  async function handleCallback(req, res, next) {
    const { provider } = req.params;

    if (!SUPPORTED_PROVIDERS.includes(provider)) {
      const err = new Error(`Provider không được hỗ trợ: ${provider}`);
      err.statusCode = 400;
      err.code = 'bad_request';
      return next(err);
    }

    const { state, code } = req.query;
    console.log('[oauth] handleCallback sessionID:', req.sessionID, 'state from query:', state, 'state in session:', req.session.oauthState);

    if (state !== req.session.oauthState) {
      const err = new Error('State parameter mismatch');
      err.statusCode = 400;
      err.code = 'invalid_state';
      return next(err);
    }

    // Xóa state sau khi kiểm tra
    req.session.oauthState = undefined;

    let user;
    try {
      user = await oauthService.exchangeCodeForUser(provider, code);
    } catch (err) {
      return next(err);
    }

    let tokens;
    try {
      tokens = await oauthService.issueTokens(user);
    } catch (err) {
      return next(err);
    }

    const { accessToken, refreshToken } = tokens;
    return res.json({ accessToken, refreshToken });
  }

  return { initiateAuth, handleCallback };
}

module.exports = { createOAuthController };
