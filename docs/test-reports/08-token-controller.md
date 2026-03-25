# Test Suite: Token Controller

## Thông tin chung

- **File:** `src/controllers/token.controller.test.js`
- **Module được test:** `src/controllers/token.controller.js`
- **Loại test:** Unit (mock tokenService, mock req/res/next)
- **Tổng tests:** 8 | **Pass:** 8 | **Fail:** 0
- **Trạng thái:** ✅ PASS

---

## Test Cases

### TokenController — verify

| # | Test Case | Input | Expected | Actual | Status |
|---|-----------|-------|----------|--------|--------|
| 1 | returns payload on valid token | `req.body.accessToken = "valid.jwt.token"`, `tokenService.verifyAccessToken` mock → `{ sub: "user-1", email: "user@example.com", roles: [] }` | `res.json(fakePayload)`, `next` không gọi | Đúng như expected | ✅ |
| 2 | calls next with UnauthorizedError when verifyAccessToken throws `token_expired` | `req.body.accessToken = "expired.jwt.token"`, service mock ném `UnauthorizedError("token_expired")` | `next(err)` với `err.code === "token_expired"`, `res.json` không gọi | Đúng như expected | ✅ |
| 3 | calls next with UnauthorizedError when verifyAccessToken throws `token_revoked` | `req.body.accessToken = "revoked.jwt.token"`, service mock ném `UnauthorizedError("token_revoked")` | `next(err)` với `err.code === "token_revoked"` | Đúng như expected | ✅ |
| 4 | calls next with 400 when accessToken is missing from body | `req.body = {}` (không có `accessToken`) | `next(err)` với `err.statusCode === 400`, `err.code === "bad_request"`, `err.message === "accessToken is required"`, service không được gọi | Đúng như expected | ✅ |

---

### TokenController — refresh

| # | Test Case | Input | Expected | Actual | Status |
|---|-----------|-------|----------|--------|--------|
| 5 | returns new token pair on success | `req.body.refreshToken = "old-refresh-token"`, `tokenService.refreshTokens` mock → `{ accessToken: "new.access.token", refreshToken: "new-refresh-token" }` | `res.json(newTokens)`, `next` không gọi | Đúng như expected | ✅ |
| 6 | calls next with UnauthorizedError when refreshTokens throws `refresh_token_invalid` | `req.body.refreshToken = "invalid-refresh-token"`, service mock ném `UnauthorizedError("refresh_token_invalid")` | `next(err)` với `err.code === "refresh_token_invalid"`, `res.json` không gọi | Đúng như expected | ✅ |

---

### TokenController — revoke

| # | Test Case | Input | Expected | Actual | Status |
|---|-----------|-------|----------|--------|--------|
| 7 | returns `{ message: "ok" }` on success | `req.headers.authorization = "Bearer valid.access.token"`, service mock resolve undefined | `tokenService.revokeTokens("valid.access.token")` được gọi, `res.json({ message: "ok" })` | Đúng như expected | ✅ |
| 8 | calls next with 401 when Authorization header is missing | `req.headers = {}` (không có `authorization`) | `next(err)` với `err.statusCode === 401`, `err.code === "token_invalid"`, `err.message === "Authorization header required"`, service không được gọi | Đúng như expected | ✅ |
