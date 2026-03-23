# Docker Fundamentals

## Container vs VM

- **VM**: Mỗi VM có kernel Linux riêng, boot mất vài giây, tốn RAM nhiều
- **Container**: Nhiều container chia sẻ cùng một kernel Linux của host. Container chỉ là một process được cô lập bằng `namespaces` và `cgroups`

Trên Windows, Docker Desktop chạy một **WSL2 VM** ẩn bên dưới. Các container Linux chạy trong VM đó.

```
Windows
└── WSL2 VM (1 Linux kernel duy nhất)
    ├── container: redis-1        (process được cô lập)
    └── container: auth-service-1 (process được cô lập)
```

## Image vs Container

- **Image**: Bản thiết kế (giống class trong OOP)
- **Container**: Instance đang chạy (giống object)

Image được lấy từ **Docker Hub** (registry công khai). Khi chạy `docker compose up`, Docker tự pull image về nếu chưa có.

## Alpine Linux

`alpine` trong tên image = dùng Alpine Linux làm base OS (~5MB). So sánh:
- `redis:7` (Ubuntu base) ~ 130MB
- `redis:7-alpine` ~ 30MB

Cùng chức năng, nhẹ hơn 4 lần. Production nên dùng alpine.

---

## Dockerfile

Recipe để build image cho app. Mỗi lệnh tạo ra một **layer**.

```dockerfile
FROM node:20-alpine          # Base image: Alpine Linux + Node.js 20

WORKDIR /app                 # Thư mục làm việc bên trong container

COPY package.json package-lock.json ./   # Copy package files TRƯỚC
RUN npm ci --omit=dev                    # Install dependencies

COPY src/ ./src/             # Copy source code SAU (tận dụng layer cache)
COPY scripts/ ./scripts/

USER node                    # Chạy với non-root user (bảo mật)
EXPOSE 3000
CMD ["node", "src/app.js"]
```

### Docker Layer Cache

Mỗi layer được cache riêng. Khi build lại, Docker chỉ rebuild từ layer đầu tiên bị thay đổi trở đi.

**Tại sao copy `package.json` trước `src/`?**
- Nếu chỉ sửa code trong `src/`, layer `COPY package.json` và `RUN npm ci` vẫn được cache
- `npm ci` không chạy lại → build nhanh hơn nhiều

### Tại sao không copy `node_modules`?

- `node_modules` trên Windows có thể chứa binary compiled cho Windows → lỗi khi chạy trong container Linux
- Đúng quy trình: copy `package.json` + `package-lock.json`, chạy `npm ci` bên trong container

---

## .dockerignore

Giống `.gitignore` nhưng cho Docker — loại trừ file không cần thiết khi build image:

```
node_modules    # Install lại bên trong container
.env            # Inject lúc runtime, không bake vào image
*.pem, *.key    # Secrets không được đưa vào image
.git
```

---

## docker-compose.yml

Định nghĩa nhiều container chạy cùng nhau trong một **virtual network** nội bộ.

```yaml
services:
  redis:
    image: redis:7-alpine
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s

  auth-service:
    build: .
    ports:
      - "3000:3000"    # host:container
    environment:
      - NODE_ENV=production
      - REDIS_URL=redis://redis:6379   # "redis" = tên service bên trên
    depends_on:
      redis:
        condition: service_healthy
```

### Docker Internal DNS

Trong network nội bộ của Compose, mỗi service name trở thành một hostname:
- `localhost` trong container = chính container đó
- `redis` = container Redis, Docker DNS tự resolve thành IP nội bộ

→ Dùng `redis://redis:6379`, không phải `redis://localhost:6379`

### Lệnh cơ bản

```bash
docker compose up --build    # Build và chạy (--build để rebuild image)
docker compose up -d         # Chạy ở background
docker compose down          # Dừng và xóa containers
docker --version
docker compose version
```
