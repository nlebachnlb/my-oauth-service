# Test Suite: JWT Utility

## Thông tin chung

- **Files:** `src/utils/jwt.util.test.js` + `src/utils/jwt.util.property.test.js`
- **Module được test:** `src/utils/jwt.util.js`
- **Loại test:** Unit + Property-based
- **Tổng tests:** 15 | **Pass:** 15 | **Fail:** 0
- **Trạng thái:** ✅ PASS

---

## Unit Tests (`jwt.util.test.js`)

### verify — token hết hạn

| # | Test Case | Input | Expected | Actual | Status |
|---|-----------|-------|----------|--------|--------|
| 1 | ném TokenExpiredError khi token đã hết hạn | Token ký với `expiresIn: -1` (hết hạn ngay) | Ném `jwt.TokenExpiredError` | Đúng như expected | ✅ |
| 2 | lỗi TokenExpiredError có message chứa "expired" | Token ký với `expiresIn: -1` | Error có `name === "TokenExpiredError"` | Đúng như expected | ✅ |

---

### verify — chữ ký không hợp lệ

| # | Test Case | Input | Expected | Actual | Status |
|---|-----------|-------|----------|--------|--------|
| 3 | ném JsonWebTokenError khi token được ký bằng private key khác | Token ký bằng `wrongKeyPair.privateKey`, verify bằng `publicKey` gốc | Ném `jwt.JsonWebTokenError` | Đúng như expected | ✅ |
| 4 | ném JsonWebTokenError khi token bị giả mạo (thay đổi payload) | Token hợp lệ bị thay payload bằng `{ sub: "hacker", roles: ["admin"] }` | Ném `jwt.JsonWebTokenError` | Đúng như expected | ✅ |
| 5 | ném JsonWebTokenError khi chuỗi token hoàn toàn ngẫu nhiên | `"not.a.valid.jwt.token"` | Ném `jwt.JsonWebTokenError` | Đúng như expected | ✅ |

---

### decode — chuỗi không hợp lệ

| # | Test Case | Input | Expected | Actual | Status |
|---|-----------|-------|----------|--------|--------|
| 6 | trả về null với chuỗi rỗng | `""` | `null` | `null` | ✅ |
| 7 | trả về null với chuỗi không phải JWT | `"not-a-jwt"` | `null` | `null` | ✅ |
| 8 | trả về null với chuỗi "null" | `"null"` | `null` | `null` | ✅ |
| 9 | trả về null với chuỗi số | `"12345"` | `null` | `null` | ✅ |
| 10 | không ném exception với bất kỳ chuỗi không hợp lệ nào | `["", "abc", "...", "a.b", "x.y.z.w"]` | Không ném exception với bất kỳ input nào | Không ném exception | ✅ |
| 11 | trả về payload khi token hợp lệ (không xác minh chữ ký) | Token hợp lệ được ký bằng `sign()` | `result.sub === "user-123"`, `result.email === "user@example.com"` | Đúng như expected | ✅ |

---

### sign — jti duy nhất

| # | Test Case | Input | Expected | Actual | Status |
|---|-----------|-------|----------|--------|--------|
| 12 | hai lần gọi sign tạo ra jti khác nhau | Gọi `sign()` 2 lần với cùng payload | `decoded1.jti !== decoded2.jti` | Đúng như expected | ✅ |
| 13 | 100 lần gọi sign tạo ra 100 jti hoàn toàn duy nhất | Gọi `sign()` 100 lần, đưa jti vào `Set` | `Set.size === 100` | `Set.size === 100` | ✅ |
| 14 | jti có định dạng UUID v4 | Gọi `sign()` 1 lần | jti khớp regex UUID v4 | Đúng như expected | ✅ |

---

## Property Tests (`jwt.util.property.test.js`)

| # | Property | Arbitraries | Assertion | Số lần chạy | Status |
|---|----------|-------------|-----------|-------------|--------|
| 15 | **Property 1: Round-trip consistency** — `verify(sign(payload))` phải trả về sub, email, roles tương đương | `sub`: string(1–64), `email`: `local@domain.tld`, `roles`: array of `["user","admin","moderator","viewer"]` | `decoded.sub === payload.sub` && `decoded.email === payload.email` && `decoded.roles` deep equals | 100 runs | ✅ |
