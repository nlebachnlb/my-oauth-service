# Test Suite: Config Module

## Thông tin chung

- **File:** `src/config/index.test.js`
- **Module được test:** `src/config/index.js`
- **Loại test:** Unit
- **Tổng tests:** 23 | **Pass:** 21 | **Fail:** 2
- **Trạng thái:** ❌ FAIL

---

## Test Cases

### Thoát khi thiếu biến môi trường bắt buộc

| # | Test Case | Input | Expected | Actual | Status |
|---|-----------|-------|----------|--------|--------|
| 1 | gọi process.exit(1) khi thiếu JWT_PRIVATE_KEY | ENV thiếu `JWT_PRIVATE_KEY` | `process.exit(1)` được gọi, hàm ném `"process.exit called"` | Đúng như expected | ✅ |
| 2 | gọi process.exit(1) khi thiếu JWT_PUBLIC_KEY | ENV thiếu `JWT_PUBLIC_KEY` | `process.exit(1)` được gọi | Đúng như expected | ✅ |
| 3 | gọi process.exit(1) khi thiếu GOOGLE_CLIENT_ID | ENV thiếu `GOOGLE_CLIENT_ID` | `process.exit(1)` được gọi | Đúng như expected | ✅ |
| 4 | gọi process.exit(1) khi thiếu GOOGLE_CLIENT_SECRET | ENV thiếu `GOOGLE_CLIENT_SECRET` | `process.exit(1)` được gọi | Đúng như expected | ✅ |
| 5 | gọi process.exit(1) khi thiếu GITHUB_CLIENT_ID | ENV thiếu `GITHUB_CLIENT_ID` | `process.exit(1)` được gọi | Hàm **không** ném lỗi (process.exit không được gọi) | ❌ |
| 6 | gọi process.exit(1) khi thiếu GITHUB_CLIENT_SECRET | ENV thiếu `GITHUB_CLIENT_SECRET` | `process.exit(1)` được gọi | Hàm **không** ném lỗi (process.exit không được gọi) | ❌ |
| 7 | gọi process.exit(1) khi thiếu tất cả biến bắt buộc | ENV không có bất kỳ biến nào | `process.exit(1)` được gọi | Đúng như expected | ✅ |
| 8 | gọi process.exit(1) khi thiếu nhiều biến cùng lúc | ENV thiếu `JWT_PRIVATE_KEY` + `GOOGLE_CLIENT_ID` | `process.exit(1)` được gọi | Đúng như expected | ✅ |
| 9 | không gọi process.exit khi đủ tất cả biến bắt buộc | ENV đầy đủ tất cả biến | Hàm không ném lỗi | Đúng như expected | ✅ |

**Lỗi chi tiết (Test #5, #6):**
```
expect(received).toThrow(expected)
Expected substring: "process.exit called"
Received function did not throw
```
**Root cause:** `GITHUB_CLIENT_ID` và `GITHUB_CLIENT_SECRET` không có trong mảng `REQUIRED` của `src/config/index.js`.

---

### Giá trị mặc định khi không cung cấp biến tùy chọn

| # | Test Case | Input | Expected | Actual | Status |
|---|-----------|-------|----------|--------|--------|
| 10 | ACCESS_TOKEN_TTL mặc định là "15m" | Không set `ACCESS_TOKEN_TTL` | `config.jwt.accessTTL === "15m"` | `"15m"` | ✅ |
| 11 | REFRESH_TOKEN_TTL mặc định là "7d" | Không set `REFRESH_TOKEN_TTL` | `config.jwt.refreshTTL === "7d"` | `"7d"` | ✅ |
| 12 | JWT_ISSUER mặc định là "auth-service" | Không set `JWT_ISSUER` | `config.jwt.issuer === "auth-service"` | `"auth-service"` | ✅ |
| 13 | JWT_AUDIENCE mặc định là undefined | Không set `JWT_AUDIENCE` | `config.jwt.audience === undefined` | `undefined` | ✅ |
| 14 | REDIS_URL mặc định là "redis://localhost:6379" | Không set `REDIS_URL` | `config.redis.url === "redis://localhost:6379"` | `"redis://localhost:6379"` | ✅ |

---

### Giá trị cung cấp ghi đè mặc định

| # | Test Case | Input | Expected | Actual | Status |
|---|-----------|-------|----------|--------|--------|
| 15 | ACCESS_TOKEN_TTL được ghi đè | `ACCESS_TOKEN_TTL=30m` | `config.jwt.accessTTL === "30m"` | `"30m"` | ✅ |
| 16 | REFRESH_TOKEN_TTL được ghi đè | `REFRESH_TOKEN_TTL=14d` | `config.jwt.refreshTTL === "14d"` | `"14d"` | ✅ |
| 17 | JWT_ISSUER được ghi đè | `JWT_ISSUER=my-custom-issuer` | `config.jwt.issuer === "my-custom-issuer"` | `"my-custom-issuer"` | ✅ |
| 18 | JWT_AUDIENCE được ghi đè | `JWT_AUDIENCE=my-app` | `config.jwt.audience === "my-app"` | `"my-app"` | ✅ |
| 19 | REDIS_URL được ghi đè | `REDIS_URL=redis://redis-server:6380` | `config.redis.url === "redis://redis-server:6380"` | `"redis://redis-server:6380"` | ✅ |

---

### Giá trị bắt buộc được load đúng vào config

| # | Test Case | Input | Expected | Actual | Status |
|---|-----------|-------|----------|--------|--------|
| 20 | jwt.privateKey lấy từ JWT_PRIVATE_KEY | `JWT_PRIVATE_KEY=fake-private-key` | `config.jwt.privateKey === "fake-private-key"` | `"fake-private-key"` | ✅ |
| 21 | jwt.publicKey lấy từ JWT_PUBLIC_KEY | `JWT_PUBLIC_KEY=fake-public-key` | `config.jwt.publicKey === "fake-public-key"` | `"fake-public-key"` | ✅ |
| 22 | providers.google.clientId lấy từ GOOGLE_CLIENT_ID | `GOOGLE_CLIENT_ID=google-client-id` | `config.providers.google.clientId === "google-client-id"` | `"google-client-id"` | ✅ |
| 23 | providers.github.clientId lấy từ GITHUB_CLIENT_ID | `GITHUB_CLIENT_ID=github-client-id` | `config.providers.github.clientId === "github-client-id"` | `"github-client-id"` | ✅ |
