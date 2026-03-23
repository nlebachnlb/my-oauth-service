# Deploy lên Railway

## Tổng quan

Railway là PaaS (Platform as a Service) — deploy nhanh, tích hợp Redis sẵn, phù hợp side project.

## Các bước deploy

### 1. Chuẩn bị

Generate RS256 key pair:
```bash
node scripts/generate-keys.js
```

### 2. Tạo project trên Railway

1. Vào [railway.app](https://railway.app) → "New Project"
2. "Deploy from GitHub repo" → chọn repo
3. Railway tự detect `Dockerfile` và dùng nó để build

### 3. Thêm Redis

Project → "New" → "Database" → "Redis"

Railway tạo Redis instance và inject `REDIS_URL` vào environment. Tuy nhiên cần **manually link** bằng cách:
- Vào service auth-service → tab "Variables" → "Add Variable Reference" → chọn Redis → `REDIS_URL`

Hoặc vào Redis service → tab "Connect" → copy connection string → paste vào Variables của auth-service.

### 4. Set Environment Variables

Vào service → tab "Variables":

```
NODE_ENV=production
JWT_PRIVATE_KEY=<output từ generate-keys.js>
JWT_PUBLIC_KEY=<output từ generate-keys.js>
GOOGLE_CLIENT_ID=<từ Google Cloud Console>
GOOGLE_CLIENT_SECRET=<từ Google Cloud Console>
GITHUB_CLIENT_ID=<từ GitHub OAuth App>
GITHUB_CLIENT_SECRET=<từ GitHub OAuth App>
SESSION_SECRET=<random 32 bytes hex>
GOOGLE_CALLBACK_URL=https://your-app.up.railway.app/auth/google/callback
GITHUB_CALLBACK_URL=https://your-app.up.railway.app/auth/github/callback
```

Generate SESSION_SECRET:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 5. Cập nhật OAuth App settings

**Google Cloud Console:**
- Tạo OAuth client loại **"Web application"** (không phải Desktop)
- Thêm vào "Authorized redirect URIs":
  - `http://localhost:3000/auth/google/callback`
  - `https://your-app.up.railway.app/auth/google/callback`

**GitHub:**
- Settings → Developer settings → OAuth Apps → cập nhật "Authorization callback URL"

---

## Các vấn đề thường gặp

### `invalid_state` error

Nguyên nhân: Session cookie không được gửi đúng cách sau cross-site redirect (Google → app).

Fix:
1. `app.set('trust proxy', 1)` — cần thiết khi app đứng sau reverse proxy của Railway
2. `cookie: { secure: true, sameSite: 'none' }` — cho phép cookie được gửi trong cross-site redirect
3. `req.session.save()` trước `res.redirect()` — đảm bảo state được persist vào Redis trước khi redirect

### `ERR syntax error` từ Redis

Nguyên nhân: `connect-redis@9` không tương thích với `ioredis`.

Fix: Dùng `connect-redis@7`.

### Google OAuth client type

- **Desktop**: Dành cho native app (Electron, CLI). Không có "Authorized redirect URIs"
- **Web application**: Dành cho HTTP server. Bắt buộc phải dùng cho project này

### `REDIS_URL` vẫn là `localhost`

Railway không tự inject `REDIS_URL` nếu chưa link Redis service với auth-service. Cần link thủ công qua tab "Variables".

---

## Reverse Proxy và Cookie

Railway đứng sau một reverse proxy (load balancer). Express không biết request đến qua HTTPS — nó thấy HTTP từ proxy.

Cần `app.set('trust proxy', 1)` để Express tin tưởng header `X-Forwarded-Proto` từ Railway, từ đó cookie `secure` hoạt động đúng.

## Test Production Local

Thay vì push lên Railway để test, dùng Docker Compose:

```bash
docker compose up --build
```

Truy cập `http://localhost:3000` — môi trường giống production (Redis, NODE_ENV=production).
