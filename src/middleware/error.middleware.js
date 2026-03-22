'use strict';

/**
 * Map error code → HTTP status
 */
const CODE_TO_STATUS = {
  token_expired: 401,
  token_invalid: 401,
  token_revoked: 401,
  invalid_state: 400,
  provider_error: 502,
  bad_request: 400,
};

/**
 * Làm sạch object log: xóa Authorization header, truncate chuỗi dài
 * @param {object} obj
 * @returns {object}
 */
function sanitizeForLog(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key.toLowerCase() === 'authorization') {
      result[key] = '[REDACTED]';
    } else if (typeof value === 'string' && value.length > 200) {
      result[key] = value.slice(0, 200) + '...[truncated]';
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Centralized error middleware
 * @param {Error} err
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
// eslint-disable-next-line no-unused-vars
function errorMiddleware(err, req, res, next) {
  const code = err.code || 'internal_error';
  const status = err.statusCode || CODE_TO_STATUS[code] || 500;
  const finalCode = CODE_TO_STATUS[code] !== undefined ? code : (err.statusCode ? code : 'internal_error');

  // Sanitize và log
  const sanitizedHeaders = sanitizeForLog(req.headers);
  console.error('[error]', {
    code: finalCode,
    message: err.message,
    path: req.path,
    headers: sanitizedHeaders,
  });

  return res.status(status).json({
    error: finalCode,
    message: err.message || 'Internal server error',
  });
}

module.exports = { errorMiddleware };
