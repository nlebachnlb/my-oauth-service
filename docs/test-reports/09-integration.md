# Test Suite: Integration Tests

## Thông tin chung

- **File:** `src/app.integration.test.js`
- **Module được test:** Toàn bộ luồng Express app (OAuth → Token)
- **Loại test:** Integration (mock axios, InMemoryTokenStore)
- **Tổng tests:** 21 | **Pass:** 2 | **Fail:** 19
- **Trạng thái:** ❌ FAIL

---

## Root Cause của toàn bộ failures

Hầu hết các test case sử dụng helper `performOAuthFlow()` — hàm này bắt đầu bằng `GET /auth/:provider` và expect HTTP 302. Tuy nhiên server trả về **500** vì session middleware trong integration test không có method `save()`.

```
Expected: 302
Received: 500
```

Luồng thất bại:
1. Controller gọi `req.session.save(callback)`
2. Session object là plain `{}` → `save` không tồn tại → `TypeError`
3. Error middleware bắt TypeError → trả về 500
4. `performOAuthFlow` assert `expect(initRes.status).toBe(302)` → fail trong `beforeEach`
5. Toàn bộ test trong suite đó fail vì `beforeEach` đã fail

---

## Suite 1: Luồng OAuth đầy đủ (redirect → callback → token)

| # | Test Case | Input | Expected | Actual | Status |
|---|-----------|-------|----------|--------|--------|
| 1 | GET /auth/google — redirect đến Google với state và client_id | `GET /auth/google` | HTTP 302, `Location` chứa `accounts.google.com`, `client_id=google-client-id`, `state` truthy | HTTP 500 (`session.save is not a function`) | ❌ |
| 2 | GET /auth/github — redirect đến GitHub với state và client_id | `GET /auth/github` | HTTP 302, `Location` chứa `github.com`, `client_id=github-client-id` | HTTP 500 | ❌ |
| 3 | GET /auth/facebook — trả về 400 với provider không hỗ trợ | `GET /auth/facebook` | HTTP 400, `body.error === "bad_request"` | HTTP 400, `body.error === "bad_request"` | ✅ |
| 4 | GET /auth/google/callback — callback hợp lệ trả về accessToken và refreshToken | `performOAuthFlow(app, sessionStore, "google")` | HTTP 200, body có `accessToken` (string) và `refreshToken` (string) | `beforeEach` không fail nhưng `performOAuthFlow` fail vì `initRes.status === 500` | ❌ |
| 5 | accessToken trong callback response được ký RS256 với đúng claims | `performOAuthFlow(...)` → decode accessToken | `header.alg === "RS256"`, payload có `sub`, `iat`, `exp`, `jti` | `performOAuthFlow` fail | ❌ |
| 6 | GET /auth/google/callback — state không khớp trả về 400 | `sessionStore.oauthState = "valid-state-123"` → `GET /auth/google/callback?state=wrong-state` | HTTP 400, `body.error === "invalid_state"` | HTTP 400, `body.error === "invalid_state"` | ✅ |
| 7 | GET /auth/google/callback — provider lỗi trả về 502 | `initRes` (dùng `GET /auth/google`), `axios.post` mock → `{ error: "invalid_grant" }` | HTTP 502, `body.error === "provider_error"` | HTTP 500 (`session.save`) tại `GET /auth/google` | ❌ |

---

## Suite 2: Luồng refresh token

> **Lưu ý:** `beforeEach` gọi `performOAuthFlow()` → fail → toàn bộ 5 test dưới đây fail.

| # | Test Case | Input | Expected | Actual | Status |
|---|-----------|-------|----------|--------|--------|
| 8 | POST /token/refresh — trả về token pair mới khi refreshToken hợp lệ | `POST /token/refresh { refreshToken }` | HTTP 200, body có `accessToken` mới, `refreshToken` mới | `beforeEach` fail | ❌ |
| 9 | POST /token/refresh — refresh token cũ không còn hợp lệ sau khi xoay vòng | Dùng lại `refreshToken` sau lần refresh đầu | HTTP 401, `body.error === "refresh_token_invalid"` | `beforeEach` fail | ❌ |
| 10 | POST /token/refresh — refresh token không tồn tại trả về 401 | `POST /token/refresh { refreshToken: "non-existent-token" }` | HTTP 401, `body.error === "refresh_token_invalid"` | `beforeEach` fail | ❌ |
| 11 | POST /token/refresh — access token mới có thể verify thành công | Refresh → verify accessToken mới | HTTP 200, `body.sub === "user-refresh-1"` | `beforeEach` fail | ❌ |
| 12 | POST /token/refresh — access token mới có exp hợp lệ | Decode payload → kiểm tra `exp - iat ≈ 900s` | `exp > now`, `exp - iat ≈ 900` | `beforeEach` fail | ❌ |

---

## Suite 3: Luồng verify token

> **Lưu ý:** `beforeEach` gọi `performOAuthFlow()` → fail → toàn bộ 4 test dưới đây fail.

| # | Test Case | Input | Expected | Actual | Status |
|---|-----------|-------|----------|--------|--------|
| 13 | POST /token/verify — token hợp lệ trả về 200 với payload | `POST /token/verify { accessToken }` | HTTP 200, `body.sub === "999"`, `body.email === "gh@test.com"`, có `body.exp` | `beforeEach` fail | ❌ |
| 14 | POST /token/verify — token chữ ký sai trả về 401 | `POST /token/verify { accessToken: "invalid.jwt.token" }` | HTTP 401, `body.error === "token_invalid"` | `beforeEach` fail | ❌ |
| 15 | POST /token/verify — chuỗi không hợp lệ không crash server | `POST /token/verify { accessToken: "not-a-jwt-at-all" }` | HTTP 401, body có `error` | `beforeEach` fail | ❌ |
| 16 | POST /token/verify — token hết hạn trả về 401 token_expired | Token ký với TTL `-1s` → `POST /token/verify` | HTTP 401, `body.error === "token_expired"` | `beforeEach` fail | ❌ |

---

## Suite 4: Luồng revoke token (đăng xuất)

> **Lưu ý:** `beforeEach` gọi `performOAuthFlow()` → fail → toàn bộ 5 test dưới đây fail.

| # | Test Case | Input | Expected | Actual | Status |
|---|-----------|-------|----------|--------|--------|
| 17 | POST /token/revoke — trả về 200 khi revoke thành công | `POST /token/revoke` với `Authorization: Bearer {accessToken}` | HTTP 200, `body.message === "ok"` | `beforeEach` fail | ❌ |
| 18 | POST /token/verify — trả về 401 token_revoked sau khi đã revoke | Revoke → `POST /token/verify { accessToken }` | HTTP 401, `body.error === "token_revoked"` | `beforeEach` fail | ❌ |
| 19 | POST /token/revoke — token không hợp lệ trả về 401 | `Authorization: Bearer invalid.token.here` | HTTP 401 | `beforeEach` fail | ❌ |
| 20 | POST /token/revoke — thiếu Authorization header trả về 401 | Không có `Authorization` header | HTTP 401, `body.error === "token_invalid"` | `beforeEach` fail | ❌ |
| 21 | POST /token/revoke — sau revoke, access token bị từ chối nhưng refresh token vẫn hoạt động | Revoke → verify (401 token_revoked) → refresh (200 với accessToken mới) | Access token bị từ chối, refresh token vẫn dùng được | `beforeEach` fail | ❌ |

---

## Fix cần thiết

Thêm method `save()` vào session middleware trong `buildApp()`:

```js
// Hiện tại (thiếu save):
app.use((req, _res, next) => {
  req.session = sessionStore;
  next();
});

// Fix:
app.use((req, _res, next) => {
  req.session = sessionStore;
  req.session.save = (cb) => cb(null);  // ← thêm dòng này
  next();
});
```
