'use strict';

// Load .env file (chỉ có tác dụng khi chạy local, bỏ qua nếu biến đã được set)
require('dotenv').config();

const express = require('express');
const config = require('./config');
const { InMemoryTokenStore } = require('./store/memory.token.store');
const { RedisTokenStore } = require('./store/redis.token.store');
const { createOAuthService } = require('./services/oauth.service');
const { createTokenService } = require('./services/token.service');
const { createOAuthController } = require('./controllers/oauth.controller');
const { createTokenController } = require('./controllers/token.controller');
const { createRouter } = require('./routes');
const { errorMiddleware } = require('./middleware/error.middleware');

// Chọn token store theo NODE_ENV
const store =
  process.env.NODE_ENV === 'production'
    ? new RedisTokenStore(config.redis.url)
    : new InMemoryTokenStore();

// Khởi tạo services với store được inject
const oauthService = createOAuthService(store);
const tokenService = createTokenService(store);

// Khởi tạo controllers với services được inject
const oauthController = createOAuthController(oauthService);
const tokenController = createTokenController(tokenService);

// Khởi tạo Express app
const app = express();

// Middleware: parse JSON body
app.use(express.json());

// Middleware: session đơn giản (in-memory, dùng cho OAuth state)
// Không dùng express-session để tránh thêm dependency
app.use((req, _res, next) => {
  if (!req.session) req.session = {};
  next();
});

// Routes
app.use('/', createRouter(oauthController, tokenController));

// Centralized error handler (phải đăng ký sau routes)
app.use(errorMiddleware);

module.exports = app;

// Chỉ listen khi chạy trực tiếp (không phải khi được require trong test)
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`[server] Auth service đang chạy tại http://localhost:${PORT}`);
  });
}
