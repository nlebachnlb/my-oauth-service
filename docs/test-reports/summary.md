# Test Report Summary — auth-service-oauth-jwt

**Ngày chạy:** 2026-03-25
**Model:** claude-sonnet-4-6

---

## Tổng quan

| Metric | Số lượng |
|--------|----------|
| Tổng test suites | 12 |
| Suites PASS | 8 |
| Suites FAIL | 4 |
| Tổng test cases | 112 |
| PASS | 87 |
| FAIL | 25 |
| Tỉ lệ pass | 77.7% |

---

## Kết quả từng suite

| # | Suite | File | Loại | Total | Pass | Fail | Status |
|---|-------|------|------|-------|------|------|--------|
| 1 | Config Module | `src/config/index.test.js` | Unit | 23 | 21 | 2 | ❌ |
| 2 | JWT Utility (Unit) | `src/utils/jwt.util.test.js` | Unit | 14 | 14 | 0 | ✅ |
| 3 | JWT Utility (Property) | `src/utils/jwt.util.property.test.js` | Property | 1 | 1 | 0 | ✅ |
| 4 | InMemoryTokenStore (Unit) | `src/store/memory.token.store.test.js` | Unit | 9 | 9 | 0 | ✅ |
| 5 | InMemoryTokenStore (Property) | `src/store/memory.token.store.property.test.js` | Property | 2 | 2 | 0 | ✅ |
| 6 | RedisTokenStore | `src/store/redis.token.store.test.js` | Unit (mock) | 3 | 0 | 3 | ❌ |
| 7 | Token Service (Unit) | `src/services/token.service.test.js` | Unit | 11 | 11 | 0 | ✅ |
| 8 | Token Service (Property) | `src/services/token.service.property.test.js` | Property | 1 | 1 | 0 | ✅ |
| 9 | OAuth Service | `src/services/oauth.service.test.js` | Unit (mock) | 14 | 14 | 0 | ✅ |
| 10 | OAuth Controller | `src/controllers/oauth.controller.test.js` | Unit (mock) | 5 | 4 | 1 | ❌ |
| 11 | Token Controller | `src/controllers/token.controller.test.js` | Unit (mock) | 8 | 8 | 0 | ✅ |
| 12 | Integration Tests | `src/app.integration.test.js` | Integration | 21 | 2 | 19 | ❌ |

---

## Failed Tests

| Suite | Test Case | Root Cause |
|-------|-----------|------------|
| Config | gọi process.exit(1) khi thiếu GITHUB_CLIENT_ID | `GITHUB_CLIENT_ID` không có trong mảng `REQUIRED` của config |
| Config | gọi process.exit(1) khi thiếu GITHUB_CLIENT_SECRET | `GITHUB_CLIENT_SECRET` không có trong mảng `REQUIRED` của config |
| RedisTokenStore | saveRefreshToken gọi Redis SET... | Mock `ioredis` thiếu method `on()` — constructor gọi `this._client.on('error', ...)` |
| RedisTokenStore | getRefreshToken trả về null khi key không tồn tại | Cùng root cause: mock thiếu `on()` |
| RedisTokenStore | isRevoked trả về true sau khi revokeAccessToken | Cùng root cause: mock thiếu `on()` |
| OAuth Controller | redirects to URL and stores state in session | Mock `req.session` thiếu method `save()` — controller gọi `req.session.save()` |
| Integration (×19) | Hầu hết test case | Session middleware trong `buildApp()` không có `save()` → `GET /auth/:provider` trả về 500 thay vì 302, khiến `beforeEach` fail |

---

## Phân tích Root Causes

### RC-1: GitHub vars không trong REQUIRED list
**Ảnh hưởng:** 2 tests (Config suite)
**Fix:** Thêm `"GITHUB_CLIENT_ID"` và `"GITHUB_CLIENT_SECRET"` vào mảng `REQUIRED` trong `src/config/index.js`

### RC-2: Mock ioredis thiếu method `on()`
**Ảnh hưởng:** 3 tests (RedisTokenStore suite)
**Fix:** Thêm `on: jest.fn()` vào `mockClient` trong `beforeEach` của `redis.token.store.test.js`

### RC-3: Mock session thiếu method `save()`
**Ảnh hưởng:** 1 test (OAuth Controller) + 19 tests (Integration) = **20 tests**
**Fix (controller test):** Thêm `save: jest.fn((cb) => cb(null))` vào `makeReq()` trong `oauth.controller.test.js`
**Fix (integration test):** Thêm `req.session.save = (cb) => cb(null)` vào session middleware trong `buildApp()` của `app.integration.test.js`

> **Lưu ý:** RC-3 là root cause nghiêm trọng nhất — gây 20 test failures từ một điểm thay đổi duy nhất (thêm `session.save()` vào controller khi production deploy lên Railway).

---

## Chi tiết

| Report | File |
|--------|------|
| Config Module | [01-config.md](./01-config.md) |
| JWT Utility | [02-jwt-util.md](./02-jwt-util.md) |
| InMemoryTokenStore | [03-memory-token-store.md](./03-memory-token-store.md) |
| RedisTokenStore | [04-redis-token-store.md](./04-redis-token-store.md) |
| Token Service | [05-token-service.md](./05-token-service.md) |
| OAuth Service | [06-oauth-service.md](./06-oauth-service.md) |
| OAuth Controller | [07-oauth-controller.md](./07-oauth-controller.md) |
| Token Controller | [08-token-controller.md](./08-token-controller.md) |
| Integration Tests | [09-integration.md](./09-integration.md) |
