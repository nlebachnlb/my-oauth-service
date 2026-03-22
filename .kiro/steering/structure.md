# Project Structure

```
src/
├── app.js                      # Entry point — wires Express, selects token store by NODE_ENV
├── config/
│   └── index.js                # Loads and validates env vars, exits on missing required vars
├── controllers/
│   ├── oauth.controller.js     # GET /auth/:provider, GET /auth/:provider/callback
│   └── token.controller.js     # POST /token/verify|refresh|revoke
├── services/
│   ├── oauth.service.js        # OAuth URL building, code exchange, token issuance
│   └── token.service.js        # Access token verify/refresh/revoke logic
├── utils/
│   └── jwt.util.js             # sign(), verify(), decode() — RS256 via jsonwebtoken
├── store/
│   ├── token.store.js          # Shared interface definition
│   ├── redis.token.store.js    # Production: ioredis, keys refresh:{token} / revoked:{jti}
│   └── memory.token.store.js   # Dev/test: two Maps with timestamp-based expiry
├── middleware/
│   └── error.middleware.js     # Centralized error → HTTP status mapping
└── routes/
    └── index.js                # Registers all routes on the Express router
```

## Conventions

- All modules use CommonJS (`require`/`module.exports`)
- Services receive the token store via dependency injection from `app.js`
- `InMemoryTokenStore` is always used in tests — no Redis or Docker required
- Config is imported as a singleton; never pass secrets through request parameters
- Error types map to specific HTTP status codes and `error` string codes (see design doc)
- Tests live alongside or near the modules they cover; Jest is the only test runner
- Property-based tests use `fast-check` and validate universal correctness properties (round-trip, rotation, idempotency)
