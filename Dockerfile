# Stage 1: Dùng node:20-alpine làm base image
# "alpine" là bản Linux cực nhỏ (~5MB), phù hợp cho production
FROM node:20-alpine

# Tạo thư mục làm việc bên trong container
WORKDIR /app

# Copy package files TRƯỚC — tận dụng Docker layer cache
# Nếu src/ thay đổi nhưng package.json không đổi,
# Docker sẽ skip bước npm ci (tiết kiệm thời gian build)
COPY package.json package-lock.json ./

# Install dependencies cho môi trường Linux (không dùng npm install)
# npm ci: install chính xác theo package-lock.json, nhanh hơn và deterministic hơn
RUN npm ci --omit=dev

# Copy source code vào sau (sau npm ci để tận dụng cache)
COPY src/ ./src/
COPY scripts/ ./scripts/

# Chạy app với user "node" thay vì root — best practice bảo mật
USER node

# Khai báo port app sẽ lắng nghe
EXPOSE 3000

# Lệnh khởi động container
CMD ["node", "src/app.js"]
