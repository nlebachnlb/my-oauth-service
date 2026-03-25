# Test Suite: Token Service

## Thông tin chung

- **Files:** `src/services/token.service.test.js` + `src/services/token.service.property.test.js`
- **Module được test:** `src/services/token.service.js`
- **Loại test:** Unit + Property-based
- **Tổng tests:** 12 | **Pass:** 12 | **Fail:** 0
- **Trạng thái:** ✅ PASS

---

## Unit Tests (`token.service.test.js`)

### TokenService — verifyAccessToken

| # | Test Case | Input | Expected | Actual | Status |
|---|-----------|-------|----------|--------|--------|
| 1 | trả về payload khi token hợp lệ | Token RS256 hợp lệ với `{ sub: "user-1", email: "user@test.com", roles: ["user"] }` | `payload.sub === "user-1"`, `payload.email === "user@test.com"`, `payload.roles === ["user"]` | Đúng như expected | ✅ |
| 2 | ném UnauthorizedError với code `token_revoked` khi token bị revoke | Token hợp lệ, sau đó `revokeAccessToken(jti, 900)`. Gọi `verifyAccessToken(token)` | Ném `UnauthorizedError { statusCode: 401, code: "token_revoked" }` | Đúng như expected | ✅ |
| 3 | ném UnauthorizedError với code `token_expired` khi token hết hạn | Token ký với `expiresIn: -1` | Ném `UnauthorizedError { statusCode: 401, code: "token_expired" }` | Đúng như expected | ✅ |
| 4 | ném UnauthorizedError với code `token_invalid` khi token không hợp lệ | `"not.a.valid.token"` | Ném `UnauthorizedError { statusCode: 401, code: "token_invalid" }` | Đúng như expected | ✅ |

---

### TokenService — refreshTokens

| # | Test Case | Input | Expected | Actual | Status |
|---|-----------|-------|----------|--------|--------|
| 5 | ném UnauthorizedError khi refresh token không tồn tại trong store | `refreshTokens("nonexistent-refresh-token")` | Ném `UnauthorizedError { statusCode: 401, code: "refresh_token_invalid" }` | Đúng như expected | ✅ |
| 6 | ném UnauthorizedError khi refresh token đã hết hạn | `saveRefreshToken("expired-token", "user-1", 0)` → đợi 1ms → `refreshTokens("expired-token")` | Ném `UnauthorizedError { statusCode: 401, code: "refresh_token_invalid" }` | Đúng như expected | ✅ |
| 7 | trả về accessToken và refreshToken mới khi refresh token hợp lệ | `saveRefreshToken("valid-refresh-token", "user-42", 3600)` → `refreshTokens("valid-refresh-token")` | `{ accessToken: string, refreshToken: string }`, `refreshToken !== "valid-refresh-token"` | Đúng như expected | ✅ |
| 8 | refresh token cũ không còn hợp lệ sau khi rotation | `saveRefreshToken("old-token", ...)` → `refreshTokens("old-token")` → `getRefreshToken("old-token")` | `null` (token cũ đã bị xóa) | `null` | ✅ |

---

### TokenService — revokeTokens

| # | Test Case | Input | Expected | Actual | Status |
|---|-----------|-------|----------|--------|--------|
| 9 | ném UnauthorizedError khi access token không hợp lệ (chuỗi rác) | `revokeTokens("garbage-token")` | Ném `UnauthorizedError { statusCode: 401, code: "token_invalid" }` | Đúng như expected | ✅ |
| 10 | sau khi revokeTokens, jti của token bị đánh dấu là revoked | Token hợp lệ → `revokeTokens(token)` → `isRevoked(jti)` | `isRevoked(jti) === true` | `true` | ✅ |
| 11 | trả về undefined (không ném lỗi) khi revoke thành công | Token hợp lệ → `revokeTokens(token)` | `resolves.toBeUndefined()` | `undefined` | ✅ |

---

## Property Tests (`token.service.property.test.js`)

| # | Property | Arbitraries | Assertion | Số lần chạy | Status |
|---|----------|-------------|-----------|-------------|--------|
| 12 | **Property 4: Refresh token rotation** — sau khi `refreshTokens`, refresh token cũ phải không còn hợp lệ | `userId`: string(1–64), `oldRefreshToken`: string(8–128) | `getRefreshToken(oldRefreshToken) === null` && `getRefreshToken(result.refreshToken) === userId` | 100 runs | ✅ |
