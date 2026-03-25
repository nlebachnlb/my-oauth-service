# Test Suite: OAuth Controller

## Thông tin chung

- **File:** `src/controllers/oauth.controller.test.js`
- **Module được test:** `src/controllers/oauth.controller.js`
- **Loại test:** Unit (mock oauthService, mock req/res/next)
- **Tổng tests:** 5 | **Pass:** 4 | **Fail:** 1
- **Trạng thái:** ❌ FAIL

---

## Test Cases

### OAuthController — initiateAuth

| # | Test Case | Input | Expected | Actual | Status |
|---|-----------|-------|----------|--------|--------|
| 1 | redirects to the URL returned by buildAuthorizationUrl and stores state in session | `req.params.provider = "google"`, `req.session = {}` (không có `save()`). `oauthService.buildAuthorizationUrl` mock → `{ url: "https://...", state: "abc123" }` | `req.session.oauthState === "abc123"`, `res.redirect("https://...")` được gọi, `next` không được gọi | `TypeError: req.session.save is not a function` | ❌ |
| 2 | calls next with 400 error for unsupported provider | `req.params.provider = "facebook"` | `next()` được gọi với error `{ statusCode: 400, code: "bad_request" }`, `res.redirect` không được gọi | Đúng như expected | ✅ |

---

### OAuthController — handleCallback

| # | Test Case | Input | Expected | Actual | Status |
|---|-----------|-------|----------|--------|--------|
| 3 | calls next with 400 invalid_state when state mismatches | `req.query.state = "wrong-state"`, `req.session.oauthState = "correct-state"` | `next()` gọi với `{ statusCode: 400, code: "invalid_state", message: "State parameter mismatch" }` | Đúng như expected | ✅ |
| 4 | returns `{ accessToken, refreshToken }` on success | State khớp, `exchangeCodeForUser` mock → `fakeUser`, `issueTokens` mock → `{ accessToken: "...", refreshToken: "..." }` | `res.json({ accessToken, refreshToken })`, `req.session.oauthState === undefined` (đã xóa), `next` không gọi | Đúng như expected | ✅ |
| 5 | forwards OAuthError to next when exchangeCodeForUser throws | State khớp, `exchangeCodeForUser.mockRejectedValue(OAuthError)` | `next(oauthErr)` được gọi, `res.json` không gọi | Đúng như expected | ✅ |

---

## Chi tiết lỗi

**Error:** `TypeError: req.session.save is not a function`

**Location:** `src/controllers/oauth.controller.js:33`

**Root cause:** Controller gọi `req.session.save(callback)` để persist session trước khi redirect (cần thiết cho production với Redis session). Nhưng mock `req.session` trong test chỉ là `{}` (plain object), không có method `save()`.

```js
// Controller (oauth.controller.js):
req.session.oauthState = state;
req.session.save((err) => {   // ← gọi .save()
  if (err) return next(err);
  return res.redirect(url);
});

// Test mock (thiếu .save):
function makeReq(overrides = {}) {
  return {
    params: {},
    query: {},
    session: {},   // ← không có .save()
    ...overrides,
  };
}
```

**Fix cần thiết:** Thêm `save: jest.fn((cb) => cb(null))` vào mock session trong `makeReq()`.
