'use strict';

// Load .env file (chỉ có tác dụng khi chạy local, bỏ qua nếu biến đã được set)
require('dotenv').config();

const express = require('express');
const session = require('express-session');
const connectRedis = require('connect-redis');
const Redis = require('ioredis');
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

// Trust Railway/proxy reverse proxy — cần thiết để cookie secure hoạt động đúng sau load balancer
app.set('trust proxy', 1);

// Middleware: parse JSON body
app.use(express.json());

// Chọn session store theo NODE_ENV
// Production: Redis (tránh memory leak, hoạt động đúng khi scale nhiều instance)
// Dev/test: MemoryStore mặc định (không cần Redis)
// connect-redis@7 cần được khởi tạo với session trước khi dùng
const RedisStore = connectRedis(session);
const sessionStore = process.env.NODE_ENV === 'production'
  ? new RedisStore({
    client: new Redis(config.redis.url),
    disableTouch: true,
  })
  : undefined;

// Middleware: session (dùng để lưu OAuth state giữa redirect và callback)
app.use(session({
  store: sessionStore,
  secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    // sameSite: 'none' cần thiết khi cookie được gửi sau cross-site redirect (Google → Railway)
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  },
}));

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
