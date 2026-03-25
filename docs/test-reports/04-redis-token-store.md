# Test Suite: RedisTokenStore

## Thông tin chung

- **File:** `src/store/redis.token.store.test.js`
- **Module được test:** `src/store/redis.token.store.js`
- **Loại test:** Unit (mock ioredis)
- **Tổng tests:** 3 | **Pass:** 0 | **Fail:** 3
- **Trạng thái:** ❌ FAIL

---

## Test Cases

### RedisTokenStore

| # | Test Case | Input / Setup | Expected | Actual | Status |
|---|-----------|---------------|----------|--------|--------|
| 1 | saveRefreshToken gọi Redis SET với key pattern `refresh:{token}`, value là userId, và TTL đúng (EX) | Mock `Redis` constructor → `mockClient.set`. Gọi `saveRefreshToken("abc123", "user-42", 3600)` | `mockClient.set` được gọi với `("refresh:abc123", "user-42", "EX", 3600)` | `TypeError: this._client.on is not a function` | ❌ |
| 2 | getRefreshToken trả về null khi key không tồn tại trong Redis | Mock `mockClient.get` trả về `null`. Gọi `getRefreshToken("nonexistent")` | `result === null`, `mockClient.get` được gọi với `"refresh:nonexistent"` | `TypeError: this._client.on is not a function` | ❌ |
| 3 | isRevoked trả về true sau khi gọi revokeAccessToken | Mock `mockClient.get` trả về `"1"`. Gọi `revokeAccessToken("jti-xyz", 900)` → `isRevoked("jti-xyz")` | `mockClient.set` gọi với `("revoked:jti-xyz", "1", "EX", 900)`, `revoked === true` | `TypeError: this._client.on is not a function` | ❌ |

---

## Chi tiết lỗi

**Error:** `TypeError: this._client.on is not a function`

**Location:** `src/store/redis.token.store.js:25` — constructor gọi `this._client.on('error', ...)`

**Root cause:** Mock object trong test chỉ định nghĩa `{ set, get, del }` nhưng **không có method `on()`**. Trong khi đó, `redis.token.store.js` sau khi được refactor cho production-ready đã thêm `this._client.on('error', ...)` vào constructor. Mock chưa được cập nhật để bao gồm `on`.

```js
// Test mock (thiếu .on):
mockClient = {
  set: jest.fn().mockResolvedValue('OK'),
  get: jest.fn().mockResolvedValue(null),
  del: jest.fn().mockResolvedValue(1),
};

// Constructor của RedisTokenStore (gọi .on):
this._client.on('error', (err) => {
  console.error('[RedisTokenStore] connection error:', err.message);
});
```

**Fix cần thiết:** Thêm `on: jest.fn()` vào `mockClient` trong `beforeEach`.
