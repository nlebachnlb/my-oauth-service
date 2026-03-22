'use strict';

const { Router } = require('express');

/**
 * Factory function tạo Express router với tất cả routes
 * @param {object} oauthController
 * @param {object} tokenController
 * @returns {Router}
 */
function createRouter(oauthController, tokenController) {
  const router = Router();

  // OAuth routes
  router.get('/auth/:provider', oauthController.initiateAuth);
  router.get('/auth/:provider/callback', oauthController.handleCallback);

  // Token routes
  router.post('/token/verify', tokenController.verify);
  router.post('/token/refresh', tokenController.refresh);
  router.post('/token/revoke', tokenController.revoke);

  return router;
}

module.exports = { createRouter };
