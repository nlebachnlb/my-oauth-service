# Test Suite: OAuth Service

## Thông tin chung

- **File:** `src/services/oauth.service.test.js`
- **Module được test:** `src/services/oauth.service.js`
- **Loại test:** Unit (mock axios)
- **Tổng tests:** 14 | **Pass:** 14 | **Fail:** 0
- **Trạng thái:** ✅ PASS

---

## Test Cases

### OAuthService — buildAuthorizationUrl

| # | Test Case | Input | Expected | Actual | Status |
|---|-----------|-------|----------|--------|--------|
| 1 | tạo URL Google đúng với client_id, redirect_uri, scope và state | `buildAuthorizationUrl("google")` | URL gốc: `https://accounts.google.com/o/oauth2/v2/auth`, params: `client_id=google-client-id`, `redirect_uri=.../google/callback`, `response_type=code`, `scope` chứa `"email"`, `state` trùng khớp | Đúng như expected | ✅ |
| 2 | tạo URL GitHub đúng với client_id, redirect_uri, scope và state | `buildAuthorizationUrl("github")` | URL gốc: `https://github.com/login/oauth/authorize`, params: `client_id=github-client-id`, `state` trùng khớp | Đúng như expected | ✅ |
| 3 | mỗi lần gọi tạo state khác nhau | Gọi `buildAuthorizationUrl("google")` 2 lần | `state1 !== state2` | Đúng như expected | ✅ |
| 4 | ném lỗi khi provider không được hỗ trợ | `buildAuthorizationUrl("facebook")` | Ném lỗi | Đúng như expected | ✅ |

---

### OAuthService — exchangeCodeForUser

| # | Test Case | Input | Expected | Actual | Status |
|---|-----------|-------|----------|--------|--------|
| 5 | trả về `{ id, email, name }` khi Google trả về thành công | `axios.post` mock → `{ access_token: "google-access-token" }`, `axios.get` mock → `{ sub: "google-user-123", email: "user@gmail.com", name: "Test User" }` | `{ id: "google-user-123", email: "user@gmail.com", name: "Test User" }` | Đúng như expected | ✅ |
| 6 | trả về `{ id, email, name }` khi GitHub trả về thành công | `axios.post` mock → `{ access_token: "github-access-token" }`, `axios.get` mock → `{ id: 456, login: "ghuser", email: "ghuser@github.com", name: "GH User" }` | `{ id: "456", email: "ghuser@github.com", name: "GH User" }` (id được convert sang string) | Đúng như expected | ✅ |
| 7 | ném OAuthError khi provider trả về error trong response body | `axios.post` mock → `{ error: "bad_verification_code", error_description: "..." }` | Ném `OAuthError { statusCode: 502, code: "provider_error" }` | Đúng như expected | ✅ |
| 8 | ném OAuthError khi axios ném lỗi network | `axios.post.mockRejectedValue(new Error("Network Error"))` | Ném `OAuthError { statusCode: 502 }` | Đúng như expected | ✅ |
| 9 | ném OAuthError khi provider không trả về access_token | `axios.post` mock → `{}` (không có `access_token`) | Ném `OAuthError { statusCode: 502 }` | Đúng như expected | ✅ |
| 10 | ném OAuthError khi lấy user info thất bại | `axios.post` mock OK, `axios.get.mockRejectedValue(new Error("Unauthorized"))` | Ném `OAuthError { statusCode: 502 }` | Đúng như expected | ✅ |

---

### OAuthService — issueTokens

| # | Test Case | Input | Expected | Actual | Status |
|---|-----------|-------|----------|--------|--------|
| 11 | trả về accessToken và refreshToken | `issueTokens({ id: "user-1", email: "user@test.com", name: "Test" })` | `{ accessToken: string, refreshToken: string }` | Đúng như expected | ✅ |
| 12 | lưu refresh token vào store với userId đúng | `issueTokens({ id: "user-42", ... })` → `store.getRefreshToken(refreshToken)` | `"user-42"` | `"user-42"` | ✅ |
| 13 | accessToken chứa sub và email đúng | `issueTokens({ id: "user-99", email: "u99@test.com", ... })` → `jwtUtil.verify(accessToken)` | `payload.sub === "user-99"`, `payload.email === "u99@test.com"` | Đúng như expected | ✅ |
| 14 | mỗi lần issueTokens tạo refresh token duy nhất | Gọi `issueTokens()` 2 lần với cùng user | `rt1 !== rt2` | Đúng như expected | ✅ |
