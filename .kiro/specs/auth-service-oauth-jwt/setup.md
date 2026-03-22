# Hướng Dẫn Cài Đặt và Chạy Project

Tài liệu này dành cho người chưa có kinh nghiệm với Node.js. Hãy làm theo từng bước.

---

## Bước 1: Cài Đặt Node.js

Node.js là môi trường chạy JavaScript trên máy tính (tương tự như JVM cho Java).

1. Truy cập https://nodejs.org
2. Tải bản **LTS** (Long Term Support) — bản ổn định nhất
3. Chạy file cài đặt, nhấn Next liên tục
4. Kiểm tra cài đặt thành công bằng cách mở terminal và gõ:

```bash
node --version   # Kết quả ví dụ: v20.11.0
npm --version    # Kết quả ví dụ: 10.2.4
```

> `npm` là công cụ quản lý thư viện, được cài kèm tự động với Node.js.

---

## Bước 2: Cài Đặt Thư Viện Project

Sau khi clone/tải source code về máy, mở terminal tại thư mục gốc của project và chạy:

```bash
npm install
```

Lệnh này đọc file `package.json` và tải tất cả thư viện cần thiết vào thư mục `node_modules/`. Chỉ cần chạy một lần (hoặc khi có thay đổi dependencies).

---

## Bước 3: Tạo RSA Key Pair

Project dùng thuật toán RS256 để ký JWT, cần một cặp khóa public/private. Chạy lệnh sau trong terminal:

```bash
# Tạo private key
openssl genrsa -out private.pem 2048

# Tạo public key từ private key
openssl rsa -in private.pem -pubout -out public.pem
```

> Nếu máy Windows chưa có `openssl`, tải tại https://slproweb.com/products/Win32OpenSSL.html (chọn bản Win64 Light).

Sau khi chạy xong, bạn sẽ có 2 file: `private.pem` và `public.pem` trong thư mục hiện tại.

---

## Bước 4: Lấy OAuth Client ID & Secret

### Google

1. Truy cập https://console.cloud.google.com
2. Tạo project mới (hoặc chọn project có sẵn)
3. Vào menu **APIs & Services** → **Credentials**
4. Nhấn **Create Credentials** → **OAuth 2.0 Client IDs**
5. Application type: chọn **Web application**
6. Thêm vào **Authorized redirect URIs**: `http://localhost:3000/auth/google/callback`
7. Nhấn Create → Copy **Client ID** và **Client Secret**

### GitHub

1. Đăng nhập GitHub → vào **Settings** (góc trên phải avatar)
2. Kéo xuống chọn **Developer settings** → **OAuth Apps** → **New OAuth App**
3. Điền:
   - Application name: tùy ý (ví dụ: `auth-service-dev`)
   - Homepage URL: `http://localhost:3000`
   - Authorization callback URL: `http://localhost:3000/auth/github/callback`
4. Nhấn **Register application** → Copy **Client ID**
5. Nhấn **Generate a new client secret** → Copy **Client Secret**

---

## Bước 5: Tạo File `.env`

File `.env` chứa tất cả cấu hình nhạy cảm, không được commit lên Git.

Tạo file tên `.env` tại thư mục gốc project với nội dung sau:

```env
NODE_ENV=development

# JWT Keys — paste nội dung từ file .pem, thay newline bằng \n
JWT_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n<nội dung private.pem>\n-----END RSA PRIVATE KEY-----"
JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n<nội dung public.pem>\n-----END PUBLIC KEY-----"
JWT_ISSUER=auth-service
JWT_AUDIENCE=my-app

# Token TTL
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL=7d

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback

# GitHub OAuth
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
GITHUB_CALLBACK_URL=http://localhost:3000/auth/github/callback
```

### Cách lấy nội dung key để paste vào `.env`

Chạy lệnh sau để in nội dung key dạng một dòng (thay `\n` thật bằng ký tự `\n` trong chuỗi):

```bash
# Windows (PowerShell)
(Get-Content private.pem) -join '\n'
(Get-Content public.pem) -join '\n'
```

Copy kết quả và paste vào giá trị tương ứng trong `.env`, bọc trong dấu ngoặc kép `"..."`.

---

## Bước 6: Chạy Project

### Môi trường development (local)

```bash
npm run dev
```

Server sẽ khởi động tại `http://localhost:3000`. Không cần cài Redis — project tự dùng bộ nhớ trong khi `NODE_ENV=development`.

### Môi trường production

Cần có Redis đang chạy. Cập nhật `.env`:

```env
NODE_ENV=production
REDIS_URL=redis://localhost:6379
```

Sau đó chạy:

```bash
npm start
```

---

## Bước 7: Kiểm Tra Hoạt Động

Mở trình duyệt hoặc dùng công cụ như [Postman](https://www.postman.com/downloads/) để gọi thử:

```
GET http://localhost:3000/auth/google
```

Nếu redirect sang trang đăng nhập Google → project đang chạy đúng.

---

## Lưu Ý Quan Trọng

- **Không commit file `.env` lên Git.** Đảm bảo file `.gitignore` có dòng `.env`.
- File `private.pem` và `public.pem` cũng không nên commit — thêm vào `.gitignore`.
- Mỗi môi trường (dev, staging, production) nên có bộ key và OAuth credentials riêng.
