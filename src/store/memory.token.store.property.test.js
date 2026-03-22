'use strict';

const fc = require('fast-check');
const { InMemoryTokenStore } = require('./memory.token.store');

/**
 * Arbitraries dùng chung
 */
const tokenArb = fc.string({ minLength: 1, maxLength: 128 });
const userIdArb = fc.string({ minLength: 1, maxLength: 64 });
const jtiArb = fc.string({ minLength: 1, maxLength: 64 });
// TTL đủ lớn để không hết hạn trong quá trình test (60–3600 giây)
const ttlArb = fc.integer({ min: 60, max: 3600 });

describe('InMemoryTokenStore — Property Tests', () => {
  /**
   * Property 2: Refresh token lookup
   * Với mọi (token, userId, ttl) hợp lệ,
   * getRefreshToken(token) sau saveRefreshToken(token, userId, ttl)
   * phải trả về đúng userId ban đầu.
   *
   * Validates: Yêu cầu 2.2
   */
  test('Property 2: token vừa lưu phải truy xuất được đúng userId', async () => {
    await fc.assert(
      fc.asyncProperty(tokenArb, userIdArb, ttlArb, async (token, userId, ttl) => {
        const store = new InMemoryTokenStore();
        await store.saveRefreshToken(token, userId, ttl);
        const result = await store.getRefreshToken(token);
        return result === userId;
      }),
      { numRuns: 200 }
    );
  });

  /**
   * Property 3: Revocation idempotency
   * Với mọi (jti, ttl) hợp lệ và mọi số lần gọi revokeAccessToken >= 1,
   * isRevoked(jti) phải luôn trả về true.
   *
   * Validates: Yêu cầu 5.1
   */
  test('Property 3: revokeAccessToken nhiều lần vẫn khiến isRevoked trả về true', async () => {
    await fc.assert(
      fc.asyncProperty(
        jtiArb,
        ttlArb,
        fc.integer({ min: 1, max: 10 }), // số lần revoke
        async (jti, ttl, revokeCount) => {
          const store = new InMemoryTokenStore();
          for (let i = 0; i < revokeCount; i++) {
            await store.revokeAccessToken(jti, ttl);
          }
          const revoked = await store.isRevoked(jti);
          return revoked === true;
        }
      ),
      { numRuns: 200 }
    );
  });
});
