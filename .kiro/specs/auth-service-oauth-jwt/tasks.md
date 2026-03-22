# Kế Hoạch Triển Khai: auth-service-oauth-jwt

## Tổng Quan

Triển khai dịch vụ xác thực Node.js/Express hỗ trợ OAuth 2.0 (Google, GitHub) và phát hành JWT ký bằng RS256. Token được lưu trữ qua `RedisTokenStore` (production) hoặc `InMemoryTokenStore` (dev/test).

## Tasks

- [x] 1. Khởi tạo cấu trúc dự án và cấu hình
  - [x] 1.1 Tạo cấu trúc thư mục và cài đặt dependencies
    - Tạo các thư mục: `src/config`, `src/controllers`, `src/services`, `src/utils`, `src/store`, `src/middleware`, `src/routes`
    - Cài đặt dependencies: `express`, `jsonwebtoken`, `uuid`, `ioredis`, `axios`, `ms`
    - Tạo `package.json` với scripts `start` và `test`
    - _Yêu cầu: 7.1, 7.5_

  - [x] 1.2 Triển khai module cấu hình `src/config/index.js`
    - Tải và validate tất cả biến môi trường bắt buộc: `JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`
    - Nếu thiếu biến bắt buộc → log lỗi mô tả và `process.exit(1)`
    - Xuất schema cấu hình với giá trị mặc định: `ACCESS_TOKEN_TTL=15m`, `REFRESH_TOKEN_TTL=7d`, `JWT_ISSUER=auth-service`
    - _Yêu cầu: 7.2, 7.5_

  - [x] 1.3 Viết unit test cho module cấu hình
    - Kiểm tra thoát khi thiếu biến bắt buộc
    - Kiểm tra giá trị mặc định được áp dụng đúng
    - _Yêu cầu: 7.2, 7.5_

- [x] 2. Triển khai JWT Utility
  - [x] 2.1 Triển khai `src/utils/jwt.util.js`
    - Hàm `sign(payload, ttl)`: ký RS256, tự động gán `jti` (UUID v4), `iss`, `aud` từ config
    - Hàm `verify(token)`: xác minh chữ ký, thời hạn, issuer — ném `TokenExpiredError` hoặc `JsonWebTokenError`
    - Hàm `decode(token)`: giải mã không xác minh chữ ký, trả về `null` nếu không hợp lệ
    - _Yêu cầu: 2.3, 2.4, 3.1, 6.1, 6.2, 6.4_

  - [x] 2.2 Viết property test cho tính chất round-trip của JWT
    - **Property 1: Round-trip consistency** — với mọi payload hợp lệ `{ sub, email, roles }`, `verify(sign(payload, ttl))` phải trả về payload tương đương bản gốc
    - **Validates: Yêu cầu 6.3**

  - [x] 2.3 Viết unit test cho JWT Utility
    - Test `verify` ném lỗi khi token hết hạn
    - Test `verify` ném lỗi khi chữ ký sai
    - Test `decode` trả về `null` với chuỗi không hợp lệ
    - Test `sign` luôn tạo `jti` duy nhất
    - _Yêu cầu: 3.3, 3.4, 6.4_

- [x] 3. Triển khai Token Store
  - [x] 3.1 Triển khai `src/store/memory.token.store.js`
    - Dùng hai `Map` nội bộ với timestamp để tự expire (không cần Redis)
    - Triển khai đầy đủ interface: `saveRefreshToken`, `getRefreshToken`, `deleteRefreshToken`, `revokeAccessToken`, `isRevoked`
    - _Yêu cầu: 2.2, 4.2, 5.1, 5.2_

  - [x] 3.2 Viết property test cho InMemoryTokenStore
    - **Property 2: Refresh token lookup** — token vừa lưu phải truy xuất được đúng `userId`
    - **Property 3: Revocation idempotency** — `revokeAccessToken` nhiều lần với cùng `jti` phải luôn khiến `isRevoked` trả về `true`
    - **Validates: Yêu cầu 2.2, 5.1**

  - [x] 3.3 Triển khai `src/store/redis.token.store.js`
    - Dùng `ioredis`, key pattern: `refresh:{token}` → `userId`, `revoked:{jti}` → `1`
    - Triển khai đầy đủ interface với TTL tương ứng
    - _Yêu cầu: 2.2, 4.2, 5.1, 5.2_

  - [x] 3.4 Viết unit test cho RedisTokenStore (mock ioredis)
    - Test `saveRefreshToken` gọi `SET` với TTL đúng
    - Test `getRefreshToken` trả về `null` khi key không tồn tại
    - Test `isRevoked` trả về `true` sau khi `revokeAccessToken`
    - _Yêu cầu: 2.2, 5.1_

- [x] 4. Checkpoint — Đảm bảo tất cả tests pass, hỏi người dùng nếu có thắc mắc.

- [x] 5. Triển khai Token Service
  - [x] 5.1 Triển khai `src/services/token.service.js`
    - `verifyAccessToken(accessToken)`: gọi `jwt.verify`, kiểm tra `isRevoked` — ném `UnauthorizedError` nếu thất bại
    - `refreshTokens(refreshToken)`: tra cứu `userId` từ store, xoay vòng refresh token (xóa cũ, tạo mới), phát hành access token mới
    - `revokeTokens(accessToken)`: thêm `jti` vào revocation list với TTL còn lại, xóa refresh token liên quan
    - _Yêu cầu: 3.1–3.5, 4.1–4.4, 5.1–5.4_

  - [x] 5.2 Viết property test cho Token Service
    - **Property 4: Refresh token rotation** — sau khi `refreshTokens`, refresh token cũ phải không còn hợp lệ
    - **Validates: Yêu cầu 4.2**

  - [x] 5.3 Viết unit test cho Token Service
    - Test `verifyAccessToken` trả về payload khi token hợp lệ
    - Test `verifyAccessToken` ném lỗi khi token bị revoke
    - Test `refreshTokens` ném lỗi khi refresh token không tồn tại trong store
    - Test `revokeTokens` ném lỗi khi access token không hợp lệ
    - _Yêu cầu: 3.3, 3.4, 3.5, 4.3, 4.4, 5.4_

- [x] 6. Triển khai OAuth Service
  - [x] 6.1 Triển khai `src/services/oauth.service.js`
    - `buildAuthorizationUrl(provider)`: tạo URL ủy quyền và state ngẫu nhiên cho Google/GitHub
    - `exchangeCodeForUser(provider, code)`: dùng `axios` trao đổi code lấy `{ id, email, name }` từ provider
    - `issueTokens(user)`: gọi `jwt.sign` + `store.saveRefreshToken`, trả về `{ accessToken, refreshToken }`
    - _Yêu cầu: 1.1, 1.2, 1.5, 2.1, 2.2_

  - [x] 6.2 Viết unit test cho OAuth Service (mock axios)
    - Test `buildAuthorizationUrl` tạo URL đúng với state
    - Test `exchangeCodeForUser` ném lỗi khi provider trả về lỗi (yêu cầu 1.4)
    - Test `issueTokens` lưu refresh token vào store
    - _Yêu cầu: 1.4, 2.1, 2.2_

- [x] 7. Triển khai Controllers và Routes
  - [x] 7.1 Triển khai `src/controllers/oauth.controller.js`
    - `GET /auth/:provider`: validate provider, gọi `buildAuthorizationUrl`, lưu state vào session, redirect
    - `GET /auth/:provider/callback`: so sánh state, gọi `exchangeCodeForUser` + `issueTokens`, trả về token
    - Trả về HTTP 400 nếu state không khớp, HTTP 502 nếu provider lỗi
    - _Yêu cầu: 1.1, 1.2, 1.3, 1.4_

  - [x] 7.2 Triển khai `src/controllers/token.controller.js`
    - `POST /token/verify`: đọc `accessToken` từ body, gọi `verifyAccessToken`, trả về payload hoặc lỗi 401
    - `POST /token/refresh`: đọc `refreshToken` từ body, gọi `refreshTokens`, trả về token pair mới
    - `POST /token/revoke`: đọc access token từ `Authorization: Bearer`, gọi `revokeTokens`, trả về 200
    - _Yêu cầu: 3.1–3.5, 4.1–4.4, 5.1–5.4_

  - [x] 7.3 Triển khai `src/routes/index.js` và `src/middleware/error.middleware.js`
    - Đăng ký tất cả routes vào Express router
    - Error middleware xử lý tập trung: map lỗi → HTTP status + error code theo bảng thiết kế
    - Làm sạch input người dùng trước khi log
    - _Yêu cầu: 7.4_

  - [x] 7.4 Viết unit test cho controllers (mock services)
    - Test redirect đúng URL với state
    - Test HTTP 400 khi state không khớp
    - Test HTTP 401 với các loại lỗi token khác nhau
    - _Yêu cầu: 1.3, 3.3, 3.4, 3.5_

- [x] 8. Triển khai Entry Point và Wiring
  - [x] 8.1 Triển khai `src/app.js`
    - Khởi tạo Express app, đăng ký middleware và routes
    - Chọn `RedisTokenStore` khi `NODE_ENV=production`, ngược lại dùng `InMemoryTokenStore`
    - Inject store vào services
    - _Yêu cầu: 7.1, 7.2_

  - [x] 8.2 Viết integration test cho luồng OAuth end-to-end (mock OAuth provider)
    - Test luồng đầy đủ: redirect → callback → nhận token
    - Test luồng refresh: dùng refresh token lấy access token mới
    - Test luồng revoke: đăng xuất và xác minh token bị từ chối
    - _Yêu cầu: 1.1–1.5, 2.1–2.4, 4.1–4.4, 5.1–5.4_

- [x] 9. Checkpoint cuối — Đảm bảo tất cả tests pass, hỏi người dùng nếu có thắc mắc.

- [x] 10. Tạo API doc cho service, hướng dẫn sử dụng

## Ghi Chú

- Tasks đánh dấu `*` là tùy chọn, có thể bỏ qua để triển khai MVP nhanh hơn
- Mỗi task tham chiếu yêu cầu cụ thể để đảm bảo traceability
- `InMemoryTokenStore` dùng cho dev/test, không cần Redis hay Docker
- Property tests xác minh tính đúng đắn phổ quát; unit tests xác minh các trường hợp cụ thể
