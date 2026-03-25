# Test Suite: InMemoryTokenStore

## Thông tin chung

- **Files:** `src/store/memory.token.store.test.js` + `src/store/memory.token.store.property.test.js`
- **Module được test:** `src/store/memory.token.store.js`
- **Loại test:** Unit + Property-based
- **Tổng tests:** 11 | **Pass:** 11 | **Fail:** 0
- **Trạng thái:** ✅ PASS

---

## Unit Tests (`memory.token.store.test.js`)

### saveRefreshToken / getRefreshToken

| # | Test Case | Input | Expected | Actual | Status |
|---|-----------|-------|----------|--------|--------|
| 1 | getRefreshToken trả về userId sau khi saveRefreshToken | `saveRefreshToken("tok1", "user-123", 60)` → `getRefreshToken("tok1")` | `"user-123"` | `"user-123"` | ✅ |
| 2 | getRefreshToken trả về null với token không tồn tại | `getRefreshToken("nonexistent")` | `null` | `null` | ✅ |
| 3 | getRefreshToken trả về null khi token đã hết hạn | `saveRefreshToken("tok-expired", "user-456", 0)` → đợi 1ms → `getRefreshToken("tok-expired")` | `null` (TTL=0s → hết hạn ngay) | `null` | ✅ |

---

### deleteRefreshToken

| # | Test Case | Input | Expected | Actual | Status |
|---|-----------|-------|----------|--------|--------|
| 4 | deleteRefreshToken xóa token khỏi store | `saveRefreshToken("tok2", "user-789", 60)` → `deleteRefreshToken("tok2")` → `getRefreshToken("tok2")` | `null` | `null` | ✅ |
| 5 | deleteRefreshToken không ném lỗi khi token không tồn tại | `deleteRefreshToken("ghost")` | `resolves.toBeUndefined()` (không ném lỗi) | Resolve undefined | ✅ |

---

### revokeAccessToken / isRevoked

| # | Test Case | Input | Expected | Actual | Status |
|---|-----------|-------|----------|--------|--------|
| 6 | isRevoked trả về false khi jti chưa bị thu hồi | `isRevoked("jti-abc")` | `false` | `false` | ✅ |
| 7 | isRevoked trả về true sau khi revokeAccessToken | `revokeAccessToken("jti-abc", 60)` → `isRevoked("jti-abc")` | `true` | `true` | ✅ |
| 8 | isRevoked trả về false khi jti đã hết hạn trong revocation list | `revokeAccessToken("jti-expired", 0)` → đợi 1ms → `isRevoked("jti-expired")` | `false` (TTL=0s → hết hạn) | `false` | ✅ |
| 9 | revokeAccessToken idempotent — gọi nhiều lần vẫn trả về true | `revokeAccessToken("jti-dup", 60)` × 2 → `isRevoked("jti-dup")` | `true` | `true` | ✅ |

---

## Property Tests (`memory.token.store.property.test.js`)

| # | Property | Arbitraries | Assertion | Số lần chạy | Status |
|---|----------|-------------|-----------|-------------|--------|
| 10 | **Property 2: Refresh token lookup** — token vừa lưu phải truy xuất được đúng userId | `token`: string(1–128), `userId`: string(1–64), `ttl`: integer(60–3600) | `getRefreshToken(token) === userId` sau `saveRefreshToken(token, userId, ttl)` | 200 runs | ✅ |
| 11 | **Property 3: Revocation idempotency** — `revokeAccessToken` nhiều lần vẫn khiến `isRevoked` trả về `true` | `jti`: string(1–64), `ttl`: integer(60–3600), `revokeCount`: integer(1–10) | `isRevoked(jti) === true` sau khi revoke `revokeCount` lần | 200 runs | ✅ |
