# Tài Liệu Yêu Cầu

## Giới Thiệu

Tài liệu này định nghĩa các yêu cầu cho một dịch vụ xác thực xây dựng trên Node.js. Dịch vụ cung cấp xác thực bên thứ ba dựa trên OAuth 2.0 và phát hành JWT token để quản lý phiên làm việc. Dịch vụ expose các HTTP endpoint mà các ứng dụng client sử dụng để xác thực người dùng, làm mới phiên và thu hồi quyền truy cập.

## Bảng Thuật Ngữ

- **Auth_Service**: Ứng dụng Node.js chịu trách nhiệm xác thực và quản lý token
- **OAuth_Provider**: Nhà cung cấp danh tính bên thứ ba (ví dụ: Google, GitHub) xác thực người dùng qua OAuth 2.0
- **JWT**: JSON Web Token — token có chữ ký, tự chứa, dùng để đại diện cho phiên xác thực
- **Access_Token**: JWT ngắn hạn được phát hành cho client sau khi xác thực thành công
- **Refresh_Token**: Token opaque dài hạn dùng để lấy Access_Token mới mà không cần xác thực lại
- **Token_Store**: Lớp lưu trữ bền vững (ví dụ: Redis hoặc database) dùng để theo dõi các token đã phát hành và đã thu hồi
- **Client**: Bất kỳ ứng dụng hoặc user agent nào sử dụng API của Auth_Service
- **Callback_URL**: URI chuyển hướng đã đăng ký với OAuth_Provider để nhận authorization code
- **Payload**: Các claims được nhúng bên trong JWT (ví dụ: user ID, roles, thời hạn)

---

## Yêu Cầu

### Yêu Cầu 1: Luồng Ủy Quyền OAuth 2.0

**User Story:** Là một ứng dụng client, tôi muốn khởi tạo luồng ủy quyền OAuth 2.0, để người dùng có thể xác thực bằng nhà cung cấp bên thứ ba được hỗ trợ.

#### Tiêu Chí Chấp Nhận

1. KHI Client yêu cầu endpoint ủy quyền với tên nhà cung cấp được hỗ trợ, Auth_Service PHẢI chuyển hướng Client đến URL ủy quyền của OAuth_Provider kèm theo tham số state và Callback_URL đã đăng ký.
2. KHI OAuth_Provider chuyển hướng về Callback_URL với authorization code hợp lệ và tham số state khớp, Auth_Service PHẢI trao đổi code để lấy thông tin xác thực OAuth từ OAuth_Provider.
3. NẾU tham số state trả về từ OAuth_Provider không khớp với state ban đầu, THÌ Auth_Service PHẢI từ chối callback và trả về lỗi HTTP 400.
4. NẾU OAuth_Provider trả về phản hồi lỗi tại Callback_URL, THÌ Auth_Service PHẢI trả về lỗi HTTP 502 kèm thông báo mô tả.
5. Auth_Service PHẢI hỗ trợ ít nhất hai OAuth_Provider (ví dụ: Google và GitHub) có thể cấu hình qua biến môi trường.

---

### Yêu Cầu 2: Phát Hành JWT

**User Story:** Là một ứng dụng client, tôi muốn nhận JWT sau khi xác thực OAuth thành công, để tôi có thể thực hiện các yêu cầu đã xác thực đến các tài nguyên được bảo vệ.

#### Tiêu Chí Chấp Nhận

1. KHI thông tin xác thực OAuth được lấy thành công từ OAuth_Provider, Auth_Service PHẢI phát hành Access_Token có chữ ký chứa định danh duy nhất của người dùng, email, roles và thời hạn được cấu hình qua biến môi trường `ACCESS_TOKEN_TTL` (mặc định: 15 phút).
2. KHI Access_Token được phát hành, Auth_Service PHẢI đồng thời phát hành Refresh_Token với thời hạn được cấu hình qua biến môi trường `REFRESH_TOKEN_TTL` (mặc định: 7 ngày) và lưu tham chiếu vào Token_Store.
3. Auth_Service PHẢI ký tất cả Access_Token bằng thuật toán RS256 với private key được tải từ biến môi trường.
4. Auth_Service PHẢI bao gồm các claims sau trong mỗi Payload của Access_Token: `sub` (user ID), `email`, `roles`, `iat` (thời điểm phát hành) và `exp` (thời hạn).

---

### Yêu Cầu 3: Xác Minh Token

**User Story:** Là một resource server, tôi muốn xác minh JWT do Auth_Service phát hành, để tôi có thể ủy quyền các yêu cầu đến.

#### Tiêu Chí Chấp Nhận

1. KHI Client trình bày Access_Token tại endpoint xác minh, Auth_Service PHẢI kiểm tra chữ ký, thời hạn và issuer claim của token.
2. KHI Access_Token hợp lệ được trình bày, Auth_Service PHẢI trả về Payload đã giải mã với phản hồi HTTP 200.
3. NẾU chữ ký của Access_Token không hợp lệ, THÌ Auth_Service PHẢI trả về lỗi HTTP 401.
4. NẾU Access_Token đã hết hạn, THÌ Auth_Service PHẢI trả về lỗi HTTP 401 kèm thông báo chỉ rõ token đã hết hạn.
5. NẾU Access_Token đã bị thu hồi, THÌ Auth_Service PHẢI trả về lỗi HTTP 401.

---

### Yêu Cầu 4: Làm Mới Token

**User Story:** Là một ứng dụng client, tôi muốn đổi Refresh_Token lấy Access_Token mới, để người dùng vẫn được xác thực mà không cần khởi tạo lại luồng OAuth.

#### Tiêu Chí Chấp Nhận

1. KHI Client trình bày Refresh_Token hợp lệ, chưa hết hạn tại endpoint làm mới, Auth_Service PHẢI phát hành Access_Token mới với thời hạn được lấy từ cấu hình `ACCESS_TOKEN_TTL`.
2. KHI Access_Token mới được phát hành qua làm mới, Auth_Service PHẢI xoay vòng Refresh_Token và vô hiệu hóa token cũ trong Token_Store.
3. NẾU Refresh_Token được trình bày không tồn tại trong Token_Store, THÌ Auth_Service PHẢI trả về lỗi HTTP 401.
4. NẾU Refresh_Token được trình bày đã hết hạn, THÌ Auth_Service PHẢI xóa nó khỏi Token_Store và trả về lỗi HTTP 401.

---

### Yêu Cầu 5: Thu Hồi Token (Đăng Xuất)

**User Story:** Là một ứng dụng client, tôi muốn thu hồi token của người dùng, để người dùng được đăng xuất và phiên làm việc bị vô hiệu hóa.

#### Tiêu Chí Chấp Nhận

1. KHI Client gọi endpoint đăng xuất với Access_Token hợp lệ, Auth_Service PHẢI thêm claim `jti` của Access_Token vào danh sách thu hồi trong Token_Store với TTL bằng thời gian còn lại của token.
2. KHI Client gọi endpoint đăng xuất với Access_Token hợp lệ, Auth_Service PHẢI đồng thời xóa Refresh_Token liên quan khỏi Token_Store.
3. KHI thu hồi thành công, Auth_Service PHẢI trả về phản hồi HTTP 200.
4. NẾU Access_Token trình bày tại endpoint đăng xuất không hợp lệ hoặc đã hết hạn, THÌ Auth_Service PHẢI trả về lỗi HTTP 401.

---

### Yêu Cầu 6: Tuần Tự Hóa JWT và Tính Toàn Vẹn Round-Trip

**User Story:** Là một developer, tôi muốn việc mã hóa và giải mã JWT nhất quán và không mất dữ liệu, để dữ liệu token không bao giờ bị hỏng qua các ranh giới tuần tự hóa.

#### Tiêu Chí Chấp Nhận

1. Auth_Service PHẢI tuần tự hóa tất cả Payload của Access_Token thành chuỗi JWT compact bằng thuật toán RS256.
2. Auth_Service PHẢI giải tuần tự hóa chuỗi JWT compact trở lại thành đối tượng Payload.
3. VỚI MỌI đối tượng Payload hợp lệ, việc mã hóa rồi giải mã PHẢI tạo ra Payload tương đương với bản gốc (tính chất round-trip).
4. NẾU chuỗi JWT không hợp lệ được trình bày để giải mã, THÌ Auth_Service PHẢI trả về lỗi phân tích mô tả thay vì ném exception không được xử lý.

---

### Yêu Cầu 7: Bảo Mật và Cấu Hình

**User Story:** Là một system operator, tôi muốn Auth_Service tuân theo các thực hành bảo mật tốt nhất, để thông tin xác thực và token được bảo vệ.

#### Tiêu Chí Chấp Nhận

1. Auth_Service PHẢI tải tất cả secrets (private key, client ID, client secret) chỉ từ biến môi trường và KHÔNG ĐƯỢC chấp nhận chúng như tham số yêu cầu.
2. KHI Auth_Service khởi động và thiếu biến môi trường bắt buộc, Auth_Service PHẢI ghi log lỗi mô tả và thoát với mã trạng thái khác 0.
3. Auth_Service PHẢI đặt cờ `HttpOnly` và `Secure` trên bất kỳ cookie nào dùng để truyền token.
4. TRONG KHI xử lý bất kỳ yêu cầu nào, Auth_Service PHẢI làm sạch tất cả đầu vào do người dùng cung cấp trước khi sử dụng trong truy vấn hoặc log output.
5. Auth_Service PHẢI đọc các tham số cấu hình sau từ biến môi trường với giá trị mặc định hợp lý khi không được cung cấp:
   - `ACCESS_TOKEN_TTL`: thời hạn Access_Token (mặc định: `15m`)
   - `REFRESH_TOKEN_TTL`: thời hạn Refresh_Token (mặc định: `7d`)
   - `JWT_ISSUER`: giá trị issuer claim trong JWT (mặc định: `auth-service`)
   - `JWT_AUDIENCE`: giá trị audience claim trong JWT (tùy chọn)
