# Tech Stack

- Runtime: Node.js (CommonJS modules)
- Framework: Express 4
- JWT: `jsonwebtoken` (RS256 signing/verification)
- Token storage: `ioredis` (production), in-memory `Map` (dev/test)
- HTTP client: `axios` (OAuth provider calls)
- ID generation: `uuid` v4 (JWT `jti` claims)
- TTL parsing: `ms`

## Dev Dependencies

- Test runner: Jest 29 with `--experimental-vm-modules` flag
- Property-based testing: `fast-check`

## Common Commands

```bash
# Start the service
npm start

# Run tests (single pass)
node --experimental-vm-modules node_modules/.bin/jest
```

## Environment Variables

Required at startup (service exits with non-zero code if missing):
- `JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY` — PEM strings for RS256
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`

Optional with defaults:
- `ACCESS_TOKEN_TTL` (default: `15m`)
- `REFRESH_TOKEN_TTL` (default: `7d`)
- `JWT_ISSUER` (default: `auth-service`)
- `JWT_AUDIENCE`
- `REDIS_URL` (default: `redis://localhost:6379`)
- `NODE_ENV` — set to `production` to use `RedisTokenStore`
