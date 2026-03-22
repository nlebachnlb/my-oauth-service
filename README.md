# auth-service-oauth-jwt

Service xác thực Node.js hỗ trợ OAuth 2.0 (Google, GitHub) và phát hành JWT ký bằng RS256. Expose các HTTP endpoint để client khởi tạo luồng OAuth, xác minh, làm mới và thu hồi token.

---

## Yêu cầu hệ thống

- **Node.js** >= 18
- **Redis** (chỉ cần khi chạy `NODE_ENV=production`)

---

## Cài đặt

```bash
# 1. Clone repository
git clone <repo-url>
cd auth-service-oauth-jwt

# 2. Cài dependencies
npm install

# 3. Tạo RSA key pair (RS256)
node scripts/generate-keys.js
# Script sẽ tự động ghi JWT_PRIVATE_KEY và JWT_PUBLIC_KEY vào file .env

# 4. Cấu hình biến môi trường
cp .env.example .env
# Chỉnh sửa .env với các giá trị thực (xem phần Cấu hình bên dưới)
```

---

## Cấu hình môi trường

Copy `.env.example` thành `.env` và điền giá trị thực.

### Biến bắt buộc

| Biến | Mô tả |
|------|-------|
| `JWT_PRIVATE_KEY` | PEM string của RSA private key (RS256) |
| `JWT_PUBLIC_KEY` | PEM string của RSA public key (RS256) |
| `GOOGLE_CLIENT_ID` | Client ID từ Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | Client Secret từ Google Cloud Console |
| `GITHUB_CLIENT_ID` | Client ID từ GitHub OAuth App |
| `GITHUB_CLIENT_SECRET` | Client Secret từ GitHub OAuth App |

> Nếu thiếu bất kỳ biến bắt buộc nào, service sẽ log lỗi và thoát với exit code khác 0.

### Biến tùy chọn

| Biến | Default | Mô tả |
|------|---------|-------|
| `ACCESS_TOKEN_TTL` | `15m` | Thời hạn của access token |
| `REFRESH_TOKEN_TTL` | `7d` | Thời hạn của refresh token |
| `JWT_ISSUER` | `auth-service` | Giá trị `iss` claim trong JWT |
| `JWT_AUDIENCE` | _(không set)_ | Giá trị `aud` claim trong JWT (tùy chọn) |
| `REDIS_URL` | `redis://localhost:6379` | URL kết nối Redis (chỉ dùng khi `NODE_ENV=production`) |
| `NODE_ENV` | `development` | Set `production` để dùng `RedisTokenStore` thay vì in-memory |
| `PORT` | `3000` | Port HTTP server lắng nghe |
| `GOOGLE_CALLBACK_URL` | _(không set)_ | Redirect URI đã đăng ký với Google |
| `GITHUB_CALLBACK_URL` | _(không set)_ | Redirect URI đã đăng ký với GitHub |

### Ví dụ `.env`

```dotenv
JWT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----"
JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\nMIIB...\n-----END PUBLIC KEY-----"

JWT_ISSUER=auth-service
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL=7d

GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-secret
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback

GITHUB_CLIENT_ID=Iv1.your-client-id
GITHUB_CLIENT_SECRET=your-github-secret
GITHUB_CALLBACK_URL=http://localhost:3000/auth/github/callback

REDIS_URL=redis://localhost:6379
NODE_ENV=development
```

---

## Khởi động service

### Development mode (in-memory token store, không cần Redis)

```bash
npm start
# Server chạy tại http://localhost:3000
```

### Production mode (Redis token store)

```bash
NODE_ENV=production npm start
```

---

## API Reference

Base URL: `http://localhost:3000`

---

### GET /auth/:provider

Khởi tạo luồng OAuth 2.0 — redirect người dùng đến trang đăng nhập của provider.

**Path params:**
- `:provider` — `google` hoặc `github`

**Response:** HTTP 302 redirect đến OAuth provider URL (kèm `state` và `redirect_uri`).

```bash
curl -L http://localhost:3000/auth/google
# → Redirect đến https://accounts.google.com/o/oauth2/auth?...

curl -L http://localhost:3000/auth/github
# → Redirect đến https://github.com/login/oauth/authorize?...
```

---

### GET /auth/:provider/callback

Nhận callback từ OAuth provider sau khi người dùng xác thực. Trao đổi `code` lấy thông tin user và phát hành token pair.

**Path params:**
- `:provider` — `google` hoặc `github`

**Query params (do provider gửi):**
- `code` — authorization code
- `state` — state token để chống CSRF

**Response 200:**
```json
{
  "accessToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response 400** — state không khớp:
```json
{ "error": "invalid_state" }
```

**Response 502** — OAuth provider lỗi:
```json
{ "error": "provider_error" }
```

```bash
# Endpoint này được gọi tự động bởi OAuth provider, không gọi trực tiếp
```

---

### POST /token/verify

Xác minh access token — kiểm tra chữ ký RS256, thời hạn, issuer và revocation list.

**Request body:**
```json
{
  "accessToken": "<jwt>"
}
```

**Response 200:**
```json
{
  "sub": "user-123",
  "email": "user@example.com",
  "roles": ["user"],
  "exp": 1700000000
}
```

**Response 401:**
```json
{ "error": "token_expired" }
```
```json
{ "error": "token_invalid" }
```
```json
{ "error": "token_revoked" }
```

```bash
curl -X POST http://localhost:3000/token/verify \
  -H "Content-Type: application/json" \
  -d '{"accessToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."}'
```

---

### POST /token/refresh

Làm mới token pair bằng refresh token. Refresh token cũ bị vô hiệu hóa và một refresh token mới được phát hành (rotation).

**Request body:**
```json
{
  "refreshToken": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response 200:**
```json
{
  "accessToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "7c9e6679-7425-40de-944b-e07fc1f90ae7"
}
```

**Response 401:**
```json
{ "error": "refresh_token_invalid" }
```
```json
{ "error": "refresh_token_expired" }
```

```bash
curl -X POST http://localhost:3000/token/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "550e8400-e29b-41d4-a716-446655440000"}'
```

---

### POST /token/revoke

Thu hồi token (đăng xuất) — thêm `jti` của access token vào revocation list và xóa refresh token liên quan.

**Request header:**
```
Authorization: Bearer <accessToken>
```

**Response 200:**
```json
{ "message": "ok" }
```

**Response 401:**
```json
{ "error": "token_invalid" }
```

```bash
curl -X POST http://localhost:3000/token/revoke \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

## Error codes

| Error code | HTTP Status | Mô tả |
|------------|-------------|-------|
| `token_expired` | 401 | Access token đã hết hạn |
| `token_invalid` | 401 | Chữ ký JWT không hợp lệ hoặc token bị lỗi |
| `token_revoked` | 401 | Token đã bị thu hồi (đã đăng xuất) |
| `refresh_token_invalid` | 401 | Refresh token không tồn tại trong store |
| `refresh_token_expired` | 401 | Refresh token đã hết hạn |
| `invalid_state` | 400 | State parameter không khớp (CSRF protection) |
| `provider_error` | 502 | OAuth provider trả về lỗi |
| `bad_request` | 400 | Thiếu hoặc sai tham số request |
| `internal_error` | 500 | Lỗi nội bộ không xác định |

---

## Chạy tests

### Tất cả tests

```bash
node --experimental-vm-modules node_modules/.bin/jest
```

### Unit tests (không bao gồm property tests)

```bash
node --experimental-vm-modules node_modules/.bin/jest --testPathPattern="\.test\.js$" --testPathIgnorePatterns="property"
```

### Property-based tests (fast-check)

```bash
node --experimental-vm-modules node_modules/.bin/jest --testPathPattern="property\.test\.js$"
```

### Integration tests

```bash
node --experimental-vm-modules node_modules/.bin/jest src/app.integration.test.js
```

### Test một module cụ thể

```bash
# JWT utility
node --experimental-vm-modules node_modules/.bin/jest src/utils/jwt.util.test.js --no-coverage

# Token service
node --experimental-vm-modules node_modules/.bin/jest src/services/token.service.test.js
```

> Tất cả tests dùng `InMemoryTokenStore` — không cần Redis hay Docker.

---

## Kiến trúc

```
src/
├── app.js                  # Entry point — khởi tạo Express, chọn token store theo NODE_ENV
├── config/index.js         # Load và validate env vars, exit nếu thiếu biến bắt buộc
├── controllers/
│   ├── oauth.controller.js # Xử lý GET /auth/:provider và /auth/:provider/callback
│   └── token.controller.js # Xử lý POST /token/verify|refresh|revoke
├── services/
│   ├── oauth.service.js    # Build authorization URL, exchange code, issue tokens
│   └── token.service.js    # Logic verify, refresh, revoke access token
├── utils/
│   └── jwt.util.js         # sign(), verify(), decode() — RS256 via jsonwebtoken
├── store/
│   ├── redis.token.store.js   # Production: ioredis, keys refresh:{token} / revoked:{jti}
│   └── memory.token.store.js  # Dev/test: two Maps với timestamp-based expiry
├── middleware/
│   └── error.middleware.js # Centralized error → HTTP status mapping
└── routes/index.js         # Đăng ký tất cả routes lên Express router
```

### Luồng OAuth 2.0

```
Client → GET /auth/:provider
    → Tạo state ngẫu nhiên, redirect đến OAuth provider
    ← OAuth provider callback với code + state
GET /auth/:provider/callback
    → Kiểm tra state (400 nếu không khớp)
    → Exchange code → lấy user info từ provider
    → Phát hành access token (JWT RS256) + refresh token (UUID)
    → Lưu refresh token vào TokenStore
    ← Trả về { accessToken, refreshToken }
```

### Token Storage

Service hỗ trợ hai backend:

| Backend | Khi nào dùng | Mô tả |
|---------|-------------|-------|
| `InMemoryTokenStore` | `NODE_ENV` != `production` | Hai `Map` với timestamp-based expiry, không cần Redis |
| `RedisTokenStore` | `NODE_ENV=production` | ioredis, keys `refresh:{token}` và `revoked:{jti}` với TTL tự động |

### Dependency Injection

`app.js` khởi tạo store → inject vào services → inject services vào controllers → mount controllers lên router. Không có global state ngoài config singleton.
