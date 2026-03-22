# Tài Liệu Thiết Kế Kỹ Thuật

## 1. Thiết Kế Tổng Thể (High-Level Design)

### 1.1 Kiến Trúc Hệ Thống

```
┌─────────────┐     HTTP      ┌──────────────────────────────────────────┐
│   Client    │ ◄───────────► │              Auth_Service                │
└─────────────┘               │                                          │
                               │  ┌──────────┐  ┌──────────┐            │
                               │  │  Router  │  │  Config  │            │
                               │  └────┬─────┘  └──────────┘            │
                               │       │                                  │
                               │  ┌────▼──────────────────────────────┐  │
                               │  │           Controllers             │  │
                               │  │  OAuthController  TokenController │  │
                               │  └────┬──────────────────────────────┘  │
                               │       │                                  │
                               │  ┌────▼──────────────────────────────┐  │
                               │  │            Services               │  │
                               │  │  OAuthService   TokenService      │  │
                               │  └────┬──────────────────────────────┘  │
                               │       │                                  │
                               │  ┌────▼──────────────────────────────┐  │
                               │  │          Infrastructure           │  │
                               │  │  TokenStore (Redis)  JwtUtil      │  │
                               │  └───────────────────────────────────┘  │
                               └──────────────────────────────────────────┘
                                          │              │
                               ┌──────────▼──┐    ┌──────▼──────────┐
                               │    Redis    │    │  OAuth Provider │
                               │ Token Store │    │ (Google/GitHub) │
                               └─────────────┘    └─────────────────┘
```

### 1.2 Các Thành Phần Chính

- **Router**: Định tuyến HTTP request đến controller tương ứng
- **OAuthController**: Xử lý luồng OAuth (redirect, callback)
- **TokenController**: Xử lý verify, refresh, logout
- **OAuthService**: Tương tác với OAuth Provider, điều phối phát hành token
- **TokenService**: Logic verify, refresh, revoke token
- **JwtUtil**: Ký và giải mã JWT bằng RS256
- **TokenStore**: Interface chung cho token storage, có hai implementation: `RedisTokenStore` (production) và `InMemoryTokenStore` (dev/test)
- **Config**: Tải và validate biến môi trường khi khởi động

### 1.3 Luồng OAuth 2.0

```
Client → GET /auth/:provider
           │
           ▼
    Tạo state ngẫu nhiên, lưu vào session
    Redirect → OAuth Provider (kèm state, redirect_uri)
           │
           ▼ (OAuth Provider callback)
    GET /auth/:provider/callback?code=...&state=...
           │
    Kiểm tra state ──── không khớp ──► HTTP 400
           │ khớp
    Trao đổi code lấy user info từ Provider
           │
    Phát hành Access_Token + Refresh_Token
           │
    Lưu Refresh_Token vào Redis
           │
    Trả về token cho Client
```

### 1.4 Cấu Trúc Thư Mục

```
src/
├── config/
│   └── index.js               # Tải và validate env vars
├── controllers/
│   ├── oauth.controller.js
│   └── token.controller.js
├── services/
│   ├── oauth.service.js
│   └── token.service.js
├── utils/
│   └── jwt.util.js            # Ký / giải mã JWT (RS256)
├── store/
│   ├── token.store.js         # Interface chung
│   ├── redis.token.store.js   # Production: ioredis
│   └── memory.token.store.js  # Dev/test: in-memory Map
├── middleware/
│   └── error.middleware.js
├── routes/
│   └── index.js
└── app.js                     # Entry point, chọn store theo NODE_ENV
```

---

## 2. Thiết Kế Chi Tiết (Low-Level Design)

### 2.1 Cấu Hình (`src/config/index.js`)

```js
// Biến môi trường bắt buộc
const REQUIRED = ['JWT_PRIVATE_KEY', 'JWT_PUBLIC_KEY', 'GOOGLE_CLIENT_ID',
                  'GOOGLE_CLIENT_SECRET', 'GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET'];

// Schema cấu hình
{
  jwt: {
    privateKey: process.env.JWT_PRIVATE_KEY,   // PEM string
    publicKey:  process.env.JWT_PUBLIC_KEY,    // PEM string
    issuer:     process.env.JWT_ISSUER     || 'auth-service',
    audience:   process.env.JWT_AUDIENCE   || undefined,
    accessTTL:  process.env.ACCESS_TOKEN_TTL  || '15m',
    refreshTTL: process.env.REFRESH_TOKEN_TTL || '7d',
  },
  providers: {
    google: {
      clientId:     process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackUrl:  process.env.GOOGLE_CALLBACK_URL,
    },
    github: {
      clientId:     process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackUrl:  process.env.GITHUB_CALLBACK_URL,
    },
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
}
```

Khi khởi động, nếu thiếu bất kỳ biến bắt buộc nào → log lỗi và `process.exit(1)`.

---

### 2.2 JWT Utility (`src/utils/jwt.util.js`)

```js
/**
 * Ký payload thành JWT compact string (RS256)
 * @param {object} payload - { sub, email, roles }
 * @param {string} ttl     - e.g. '15m'
 * @returns {string} JWT string
 */
function sign(payload, ttl): string

/**
 * Giải mã và xác minh JWT
 * @param {string} token
 * @returns {{ sub, email, roles, iat, exp, jti, iss, aud }}
 * @throws {TokenExpiredError | JsonWebTokenError}
 */
function verify(token): JwtPayload

/**
 * Giải mã JWT không xác minh chữ ký (dùng để đọc exp khi revoke)
 * @param {string} token
 * @returns {JwtPayload | null}
 */
function decode(token): JwtPayload | null
```

Mỗi token được tự động gán `jti` (UUID v4), `iss`, `aud` từ config.

---

### 2.3 Token Store (`src/store/token.store.js`)

Token Store được thiết kế theo interface chung, với hai implementation tương ứng hai môi trường:

```
ITokenStore (interface)
├── RedisTokenStore     ← production (ioredis + Redis thật)
└── InMemoryTokenStore  ← dev/test (Map trong process, không cần cài Redis)
```

`app.js` chọn implementation dựa vào biến môi trường `NODE_ENV`:
```js
const store = process.env.NODE_ENV === 'production'
  ? new RedisTokenStore(config.redis.url)
  : new InMemoryTokenStore();
```

**Interface chung:**
```js
// Lưu refresh token
async saveRefreshToken(token: string, userId: string, ttlSeconds: number): Promise<void>

// Lấy userId từ refresh token (null nếu không tồn tại / hết hạn)
async getRefreshToken(token: string): Promise<string | null>

// Xóa refresh token
async deleteRefreshToken(token: string): Promise<void>

// Thêm jti vào revocation list
async revokeAccessToken(jti: string, ttlSeconds: number): Promise<void>

// Kiểm tra jti có bị thu hồi không
async isRevoked(jti: string): Promise<boolean>
```

**Redis key patterns (chỉ dùng trong `RedisTokenStore`):**

| Key pattern       | Giá trị  | TTL                                | Mục đích                  |
|-------------------|----------|------------------------------------|---------------------------|
| `refresh:{token}` | `userId` | `REFRESH_TOKEN_TTL`                | Lưu refresh token hợp lệ |
| `revoked:{jti}`   | `1`      | Thời gian còn lại của access token | Danh sách thu hồi         |

**`InMemoryTokenStore`** dùng hai `Map` với timestamp để tự expire, không cần Redis, không cần Docker — phù hợp cho dev local và unit test.

---

### 2.4 OAuth Service (`src/services/oauth.service.js`)

```js
/**
 * Tạo authorization URL và state cho provider
 * @param {'google'|'github'} provider
 * @returns {{ url: string, state: string }}
 */
function buildAuthorizationUrl(provider): { url, state }

/**
 * Trao đổi authorization code lấy thông tin user
 * @param {'google'|'github'} provider
 * @param {string} code
 * @returns {{ id, email, name }}
 */
async function exchangeCodeForUser(provider, code): UserInfo

/**
 * Phát hành access + refresh token sau khi xác thực thành công
 * @param {UserInfo} user
 * @returns {{ accessToken: string, refreshToken: string }}
 */
async function issueTokens(user): TokenPair
```

---

### 2.5 Token Service (`src/services/token.service.js`)

```js
/**
 * Xác minh access token, kiểm tra revocation list
 * @param {string} accessToken
 * @returns {JwtPayload}
 * @throws {UnauthorizedError}
 */
async function verifyAccessToken(accessToken): JwtPayload

/**
 * Làm mới access token bằng refresh token (xoay vòng refresh token)
 * @param {string} refreshToken
 * @returns {{ accessToken: string, refreshToken: string }}
 * @throws {UnauthorizedError}
 */
async function refreshTokens(refreshToken): TokenPair

/**
 * Thu hồi access token và xóa refresh token liên quan
 * @param {string} accessToken
 * @throws {UnauthorizedError}
 */
async function revokeTokens(accessToken): void
```

---

### 2.6 HTTP Endpoints

| Method | Path                        | Mô tả                              |
|--------|-----------------------------|------------------------------------|
| GET    | `/auth/:provider`           | Redirect đến OAuth Provider        |
| GET    | `/auth/:provider/callback`  | Nhận callback, phát hành token     |
| POST   | `/token/verify`             | Xác minh access token              |
| POST   | `/token/refresh`            | Làm mới token bằng refresh token   |
| POST   | `/token/revoke`             | Thu hồi token (đăng xuất)          |

#### Request / Response

**POST /token/verify**
```
Body:  { "accessToken": "<jwt>" }
200:   { "sub", "email", "roles", "exp" }
401:   { "error": "token_expired" | "token_invalid" | "token_revoked" }
```

**POST /token/refresh**
```
Body:  { "refreshToken": "<opaque>" }
200:   { "accessToken": "<jwt>", "refreshToken": "<opaque>" }
401:   { "error": "refresh_token_invalid" | "refresh_token_expired" }
```

**POST /token/revoke**
```
Header: Authorization: Bearer <accessToken>
200:   { "message": "ok" }
401:   { "error": "token_invalid" }
```

---

### 2.7 Xử Lý Lỗi

Tất cả lỗi được xử lý tập trung qua `error.middleware.js`:

| Loại lỗi              | HTTP Status | error code             |
|-----------------------|-------------|------------------------|
| Token hết hạn         | 401         | `token_expired`        |
| Chữ ký không hợp lệ  | 401         | `token_invalid`        |
| Token bị thu hồi      | 401         | `token_revoked`        |
| State không khớp      | 400         | `invalid_state`        |
| OAuth Provider lỗi    | 502         | `provider_error`       |
| Thiếu tham số         | 400         | `bad_request`          |
| Lỗi nội bộ            | 500         | `internal_error`       |

---

### 2.8 Thư Viện Sử Dụng

| Thư viện         | Mục đích                              |
|------------------|---------------------------------------|
| `express`        | HTTP framework                        |
| `jsonwebtoken`   | Ký và xác minh JWT (RS256)            |
| `uuid`           | Tạo `jti` cho mỗi token              |
| `ioredis`        | Redis client cho `RedisTokenStore` (production) |
| `axios`          | Gọi API OAuth Provider                |
| `ms`             | Parse TTL string (`'15m'` → ms)       |
