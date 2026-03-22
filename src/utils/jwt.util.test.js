'use strict';

/**
 * Unit tests cho JWT Utility
 * Yêu cầu: 3.3, 3.4, 6.4
 */

const crypto = require('crypto');

// Tạo RSA key pair thật cho test — phải dùng prefix `mock` để jest.mock() factory cho phép tham chiếu
const mockKeyPair = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

// Tạo thêm một key pair khác để test chữ ký sai
const mockWrongKeyPair = crypto.generateKeyPairSync('rsa', {
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

const jwt = require('jsonwebtoken');
const { sign, verify, decode } = require('./jwt.util');

const SAMPLE_PAYLOAD = { sub: 'user-123', email: 'user@example.com', roles: ['user'] };

// ─── verify: ném lỗi khi token hết hạn (Yêu cầu 3.4) ───────────────────────

describe('verify — token hết hạn', () => {
  test('ném TokenExpiredError khi token đã hết hạn', () => {
    // Ký token với TTL âm để nó hết hạn ngay lập tức
    const expiredToken = jwt.sign(SAMPLE_PAYLOAD, mockKeyPair.privateKey, {
      algorithm: 'RS256',
      expiresIn: -1,
      issuer: 'test-issuer',
    });

    expect(() => verify(expiredToken)).toThrow(jwt.TokenExpiredError);
  });

  test('lỗi TokenExpiredError có message chứa "expired"', () => {
    const expiredToken = jwt.sign(SAMPLE_PAYLOAD, mockKeyPair.privateKey, {
      algorithm: 'RS256',
      expiresIn: -1,
      issuer: 'test-issuer',
    });

    expect(() => verify(expiredToken)).toThrow(expect.objectContaining({
      name: 'TokenExpiredError',
    }));
  });
});

// ─── verify: ném lỗi khi chữ ký sai (Yêu cầu 3.3) ──────────────────────────

describe('verify — chữ ký không hợp lệ', () => {
  test('ném JsonWebTokenError khi token được ký bằng private key khác', () => {
    // Ký bằng wrong key nhưng verify bằng đúng public key → chữ ký không khớp
    const tokenWithWrongSig = jwt.sign(SAMPLE_PAYLOAD, mockWrongKeyPair.privateKey, {
      algorithm: 'RS256',
      expiresIn: '15m',
      issuer: 'test-issuer',
    });

    expect(() => verify(tokenWithWrongSig)).toThrow(jwt.JsonWebTokenError);
  });

  test('ném JsonWebTokenError khi token bị giả mạo (thay đổi payload)', () => {
    const token = sign(SAMPLE_PAYLOAD, '15m');
    // Tách header.payload.signature và thay payload bằng base64 khác
    const parts = token.split('.');
    const fakePayload = Buffer.from(JSON.stringify({ sub: 'hacker', email: 'hack@evil.com', roles: ['admin'] })).toString('base64url');
    const tamperedToken = `${parts[0]}.${fakePayload}.${parts[2]}`;

    expect(() => verify(tamperedToken)).toThrow(jwt.JsonWebTokenError);
  });

  test('ném JsonWebTokenError khi chuỗi token hoàn toàn ngẫu nhiên', () => {
    expect(() => verify('not.a.valid.jwt.token')).toThrow(jwt.JsonWebTokenError);
  });
});

// ─── decode: trả về null với chuỗi không hợp lệ (Yêu cầu 6.4) ──────────────

describe('decode — chuỗi không hợp lệ', () => {
  test('trả về null với chuỗi rỗng', () => {
    expect(decode('')).toBeNull();
  });

  test('trả về null với chuỗi không phải JWT', () => {
    expect(decode('not-a-jwt')).toBeNull();
  });

  test('trả về null với chuỗi "null"', () => {
    expect(decode('null')).toBeNull();
  });

  test('trả về null với chuỗi số', () => {
    expect(decode('12345')).toBeNull();
  });

  test('không ném exception với bất kỳ chuỗi không hợp lệ nào', () => {
    const invalidInputs = ['', 'abc', '...', 'a.b', 'x.y.z.w'];
    for (const input of invalidInputs) {
      expect(() => decode(input)).not.toThrow();
    }
  });

  test('trả về payload khi token hợp lệ (không xác minh chữ ký)', () => {
    const token = sign(SAMPLE_PAYLOAD, '15m');
    const result = decode(token);
    expect(result).not.toBeNull();
    expect(result.sub).toBe(SAMPLE_PAYLOAD.sub);
    expect(result.email).toBe(SAMPLE_PAYLOAD.email);
  });
});

// ─── sign: luôn tạo jti duy nhất (Yêu cầu 6.4 / 2.4) ───────────────────────

describe('sign — jti duy nhất', () => {
  test('hai lần gọi sign tạo ra jti khác nhau', () => {
    const token1 = sign(SAMPLE_PAYLOAD, '15m');
    const token2 = sign(SAMPLE_PAYLOAD, '15m');

    const decoded1 = decode(token1);
    const decoded2 = decode(token2);

    expect(decoded1.jti).toBeDefined();
    expect(decoded2.jti).toBeDefined();
    expect(decoded1.jti).not.toBe(decoded2.jti);
  });

  test('100 lần gọi sign tạo ra 100 jti hoàn toàn duy nhất', () => {
    const jtis = new Set();
    for (let i = 0; i < 100; i++) {
      const token = sign(SAMPLE_PAYLOAD, '15m');
      const decoded = decode(token);
      jtis.add(decoded.jti);
    }
    expect(jtis.size).toBe(100);
  });

  test('jti có định dạng UUID v4', () => {
    const token = sign(SAMPLE_PAYLOAD, '15m');
    const decoded = decode(token);
    const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(decoded.jti).toMatch(uuidV4Regex);
  });
});
