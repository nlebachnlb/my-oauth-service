'use strict';

/**
 * Property-based test cho JWT Utility
 * Validates: Yêu cầu 6.3 — Round-trip consistency
 *
 * Với mọi payload hợp lệ { sub, email, roles },
 * verify(sign(payload, ttl)) phải trả về payload tương đương bản gốc.
 */

const crypto = require('crypto');
const fc = require('fast-check');

// Tạo RSA key pair cho test — phải dùng prefix `mock` để jest.mock() factory cho phép tham chiếu
const mockKeyPair = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

jest.mock('../config', () => ({
  jwt: {
    privateKey: mockKeyPair.privateKey,
    publicKey: mockKeyPair.publicKey,
    issuer: 'test-issuer',
    audience: undefined,
    accessTTL: '15m',
    refreshTTL: '7d',
  },
  providers: {
    google: { clientId: 'g-id', clientSecret: 'g-secret', callbackUrl: '' },
    github: { clientId: 'gh-id', clientSecret: 'gh-secret', callbackUrl: '' },
  },
  redis: { url: 'redis://localhost:6379' },
}));

const { sign, verify } = require('./jwt.util');

// Arbitraries cho payload hợp lệ
const subArb = fc.string({ minLength: 1, maxLength: 64 }).filter((s) => s.trim().length > 0);
const emailArb = fc
  .tuple(
    fc.stringMatching(/^[a-z][a-z0-9]{0,19}$/),
    fc.stringMatching(/^[a-z][a-z0-9]{0,9}$/),
    fc.constantFrom('com', 'net', 'org', 'io'),
  )
  .map(([local, domain, tld]) => `${local}@${domain}.${tld}`);
const rolesArb = fc.array(
  fc.constantFrom('user', 'admin', 'moderator', 'viewer'),
  { minLength: 1, maxLength: 4 },
);

const validPayloadArb = fc.record({
  sub: subArb,
  email: emailArb,
  roles: rolesArb,
});

describe('JWT Utility — Property Tests', () => {
  /**
   * Property 1: Round-trip consistency
   * Validates: Yêu cầu 6.3
   */
  it('Property 1: verify(sign(payload)) phải trả về sub, email, roles tương đương bản gốc', () => {
    fc.assert(
      fc.property(validPayloadArb, (payload) => {
        const token = sign(payload, '15m');
        const decoded = verify(token);

        expect(decoded.sub).toBe(payload.sub);
        expect(decoded.email).toBe(payload.email);
        expect(decoded.roles).toEqual(payload.roles);
      }),
      { numRuns: 100 },
    );
  });
});
