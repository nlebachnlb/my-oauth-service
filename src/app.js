'use strict';

// Load .env file (chỉ có tác dụng khi chạy local, bỏ qua nếu biến đã được set)
require('dotenv').config();

const express = require('express');
const session = require('express-session');
// connect-redis@7 export class trực tiếp (có thể qua .default nếu là ES module wrapper)
const ConnectRedis = require('connect-redis');
const RedisStore = ConnectRedis.default || ConnectRedis;
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

const oauthService = createOAuthService(store);
const tokenService = createTokenService(store);
const oauthController = createOAuthController(oauthService);
const tokenController = createTokenController(tokenService);

const app = express();

// Trust Railway reverse proxy — cần thiết để cookie secure hoạt động đúng
app.set('trust proxy', 1);

app.use(express.json());

// Session store: Redis (production) hoặc MemoryStore (dev/test)
const sessionStore = process.env.NODE_ENV === 'production'
  ? new RedisStore({
    client: new Redis(config.redis.url),
    disableTouch: true,
  })
  : undefined;

app.use(session({
  store: sessionStore,
  secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    // sameSite none cần thiết cho cross-site redirect (Google/GitHub → app)
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  },
}));

app.use('/', createRouter(oauthController, tokenController));
app.use(errorMiddleware);

module.exports = app;

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`[server] Auth service đang chạy tại http://localhost:${PORT}`);
  });
}
