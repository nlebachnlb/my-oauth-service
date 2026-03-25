# OAuth & Session Fundamentals

## 1. express-session hoạt động như thế nào?

### Cơ chế inject store

Khi bạn cấu hình:

```js
app.use(session({ store: redisStore }))
```

express-session đóng vai trò **orchestrator** — nó nhận store được inject vào và tự quản lý toàn bộ vòng đời session:

```
[Mỗi request đến]
      ↓
Đọc cookie sessionId  ──→  Lookup store  ──→  Gắn vào req.session
      ↓
[Handler xử lý, modify req.session]
      ↓
Cuối request: auto-save req.session  ──→  store.set(sessionId, data)
      ↓
Set-Cookie: sessionId=xyz  ──→  Browser lưu
```

- **Cookie** = chìa khóa định danh session (browser giữ)
- **Store** = kho lưu data thực sự (server giữ)
- **`req.session`** = interface để code đọc/ghi, không cần biết store là gì

### Design Pattern: Strategy Pattern

`req.session.save()` trong controller không cần biết store là Redis hay Memory.
Store được inject từ `app.js` — controller chỉ nói chuyện với interface `req.session`.

---

## 2. Session tồn tại qua nhiều request khác nhau như thế nào?

`req` trong `initiateAuth` và `req` trong `handleCallback` là **hai object khác nhau** — hai HTTP request khác nhau, không có global scope.

Cầu nối là **Cookie + Session Store**:

```
BROWSER                         SERVER
────────────────────────────────────────────────────────
1. GET /auth/google
                    → initiateAuth(req1)
                      req1.session.oauthState = "abc123"
                      save → Redis["sess:xyz"] = { oauthState: "abc123" }
                    ← Set-Cookie: sessionId=xyz
                      redirect → Google

2. [User login ở Google]

3. GET /callback?state=abc123&code=...
   Cookie: sessionId=xyz
                    → handleCallback(req2)
                      express-session đọc cookie → sessionId=xyz
                      load Redis["sess:xyz"] → req2.session = { oauthState: "abc123" }
                      req2.session.oauthState === "abc123" ✅
```

> Hai `req` khác nhau, nhưng cùng `sessionId` → express-session load cùng một data.
> Đây là bản chất của **stateful session over stateless HTTP**.

---

## 3. Tại sao phải gọi `req.session.save()` trước khi redirect?

### Vấn đề: Race condition với Redis

Nếu **không** gọi `save()` mà redirect thẳng:

```
t=0ms   req.session.oauthState = state  (ghi vào RAM)
t=1ms   res.redirect(url)               → browser nhận redirect
t=5ms   Browser → Google                → user login
t=8ms   Redis write hoàn tất            (quá muộn!)
t=50ms  Google callback về /callback    → đọc session.oauthState
        Redis chưa có data → state mismatch → LỖI ❌
```

Gọi `save()` đúng cách:

```js
req.session.oauthState = state;
req.session.save((err) => {
  if (err) return next(err);
  return res.redirect(url);  // redirect SAU KHI Redis confirm đã lưu xong ✅
});
```

### So sánh MemoryStore vs RedisStore

| | MemoryStore | RedisStore |
|---|---|---|
| Nơi lưu | RAM (cùng process) | Server Redis (network) |
| Tốc độ write | Đồng bộ, ~0ms | Async, ~1-10ms network |
| Cần explicit `save()` trước redirect? | Không bắt buộc | **Bắt buộc** |

> **Nguyên tắc:** Bất cứ khi nào redirect sau khi ghi session, luôn `save()` trước — đặc biệt với remote store (Redis, database).

---

## 4. OAuth `state` parameter — chống CSRF

### `state` có bắt buộc không?

Google **không bắt buộc** `state`, nhưng khuyến nghị mạnh mẽ. Đây là cơ chế chống **CSRF attack**.

### Nếu không có `state` — CSRF attack

```
1. Attacker tạo sẵn authorization URL của Google với account của họ
2. Attacker gửi URL đó cho victim (email, iframe ẩn...)
3. Victim click → Google redirect về /callback?code=attacker_code
4. App đổi code → victim bị login vào account attacker
5. Attacker đọc data victim đã upload lên account đó
```

### Với `state` — CSRF bị chặn

```
initiateAuth:
  state = uuidv4()              // random, không đoán được
  session.oauthState = state    // lưu server-side
  redirect → google?state=abc123

handleCallback:
  query.state === session.oauthState?
  ✅ khớp → tiếp tục
  ❌ không khớp → reject (CSRF detected)
```

Attacker không thể giả mạo vì không biết `state` value và không đọc được session của victim.

> **Nguyên tắc:** `state` là bằng chứng rằng flow OAuth được **chính app khởi tạo**, không phải bị attacker inject vào giữa chừng.

---

## 5. Tại sao OAuth dùng GET redirect, không phải POST?

### Browser chỉ tự động follow redirect bằng GET

Khi server trả về `302 Found` + `Location: https://accounts.google.com/...`, browser **tự động** navigate bằng GET. Không có cơ chế nào để browser tự động POST đến URL redirect.

### URL authorization không chứa data nhạy cảm

```
URL chứa:          URL KHÔNG chứa:
✅ client_id       ❌ client_secret  (giữ ở server)
✅ scope           ❌ access token   (chưa có)
✅ state           ❌ user data      (chưa có)
✅ redirect_uri
```

Data nhạy cảm được trao đổi ở bước sau — **server-to-server bằng POST** (app server gọi Google token endpoint với `client_secret`). Browser không tham gia bước đó.

### Flow tổng thể

```
Browser ←──GET──→ Google Login Page     (redirect, public)
Browser ←──GET──→ /callback?code=xxx    (redirect, code ngắn hạn ~60s)
Server  ←──POST─→ Google Token Endpoint (server-to-server, có client_secret)
```

> **Nguyên tắc:** GET cho những gì browser cần navigate. POST server-to-server cho những gì cần bảo mật thực sự. OAuth tách biệt rõ hai loại này.
