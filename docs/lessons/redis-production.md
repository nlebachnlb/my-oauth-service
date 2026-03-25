# Redis trong Production

## Redis là gì?

Redis là **in-memory key-value store** — lưu data trong RAM, truy xuất cực nhanh.

Project này dùng Redis để lưu 2 loại key:
- `refresh:{token}` → userId
- `revoked:{jti}` → 1

Mỗi key có **TTL (time-to-live)** — hết TTL thì Redis tự xóa. Đây là lý do dùng Redis thay vì database thông thường cho token storage.

## redis:// vs rediss://

Tương tự `http` vs `https`:
- `redis://` = plain text, không mã hóa → dùng trong internal network (Docker Compose)
- `rediss://` = Redis over TLS, mã hóa traffic → bắt buộc khi kết nối đến managed Redis trên cloud (Railway, Upstash...)

## Hardening RedisTokenStore cho Production

```javascript
constructor(redisUrl) {
  this._client = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,  // Retry tối đa 3 lần trước khi throw error
    enableReadyCheck: true,
  });

  // QUAN TRỌNG: Phải có .on('error') để tránh crash process
  this._client.on('error', (err) => {
    console.error('[RedisTokenStore] connection error:', err.message);
  });

  this._client.on('reconnecting', () => {
    console.warn('[RedisTokenStore] reconnecting to Redis...');
  });

  this._client.on('ready', () => {
    console.info('[RedisTokenStore] connected to Redis');
  });
}
```

**Tại sao không fallback sang InMemory khi Redis down?**

Khi Redis down và switch sang InMemory:
- Refresh token cũ trong Redis → không tìm thấy → user bị logout
- Revocation list → mất → token đã revoke có thể dùng lại → **security hole**

→ Đúng hơn là để ioredis tự reconnect (built-in), trả lỗi 503 cho client nếu quá timeout.

## Session Store với Redis

`express-session` mặc định dùng `MemoryStore` — leak memory và không scale. Trong production cần dùng Redis:

```javascript
const ConnectRedis = require('connect-redis');
const RedisStore = ConnectRedis.default || ConnectRedis;

const sessionStore = process.env.NODE_ENV === 'production'
  ? new RedisStore({
      client: new Redis(config.redis.url),
      disableTouch: true,
    })
  : undefined;
```

**Lưu ý version compatibility:**
- `connect-redis@9`: chỉ hỗ trợ `node-redis` client, không hỗ trợ `ioredis`
- `connect-redis@7`: hỗ trợ `ioredis`, export class trực tiếp

## Hosting Options cho Redis

| Option | Chi phí | Độ phức tạp | Phù hợp |
|--------|---------|-------------|---------|
| Railway Redis plugin | ~$5/tháng | Thấp (1 click) | Side project |
| Upstash | Free tier | Thấp | Side project |
| Docker Compose local | Free | Thấp | Dev/test |
| AWS ElastiCache | Cao | Cao | Enterprise |
