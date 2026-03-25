'use strict';

/**
 * Unit tests cho src/config/index.js
 * Yêu cầu: 7.2, 7.5
 */

// Biến môi trường bắt buộc đầy đủ để dùng trong các test
const FULL_ENV = {
  JWT_PRIVATE_KEY: 'fake-private-key',
  JWT_PUBLIC_KEY: 'fake-public-key',
  GOOGLE_CLIENT_ID: 'google-client-id',
  GOOGLE_CLIENT_SECRET: 'google-client-secret',
};

// Lưu lại process.env gốc và mock process.exit
let originalEnv;
let exitSpy;

beforeEach(() => {
  originalEnv = { ...process.env };
  // Xóa tất cả biến liên quan để test sạch
  const allKeys = [
    ...Object.keys(FULL_ENV),
    'ACCESS_TOKEN_TTL',
    'REFRESH_TOKEN_TTL',
    'JWT_ISSUER',
    'JWT_AUDIENCE',
    'REDIS_URL',
  ];
  allKeys.forEach((k) => delete process.env[k]);

  exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
    throw new Error('process.exit called');
  });

  jest.resetModules();
});

afterEach(() => {
  process.env = originalEnv;
  exitSpy.mockRestore();
});

// ─── Helpers ────────────────────────────────────────────────────────────────

function setEnv(overrides = {}) {
  Object.assign(process.env, { ...FULL_ENV, ...overrides });
}

function loadConfig() {
  return require('./index');
}

// ─── Tests: thoát khi thiếu biến bắt buộc (Yêu cầu 7.2) ────────────────────

describe('Thoát khi thiếu biến môi trường bắt buộc', () => {
  const requiredVars = [
    'JWT_PRIVATE_KEY',
    'JWT_PUBLIC_KEY',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
  ];

  test.each(requiredVars)(
    'gọi process.exit(1) khi thiếu %s',
    (missingVar) => {
      // Set đầy đủ rồi xóa biến cần test
      setEnv();
      delete process.env[missingVar];

      expect(() => loadConfig()).toThrow('process.exit called');
      expect(exitSpy).toHaveBeenCalledWith(1);
    }
  );

  test('gọi process.exit(1) khi thiếu tất cả biến bắt buộc', () => {
    // Không set bất kỳ biến nào
    expect(() => loadConfig()).toThrow('process.exit called');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  test('gọi process.exit(1) khi thiếu nhiều biến cùng lúc', () => {
    setEnv();
    delete process.env.JWT_PRIVATE_KEY;
    delete process.env.GOOGLE_CLIENT_ID;

    expect(() => loadConfig()).toThrow('process.exit called');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  test('không gọi process.exit khi đủ tất cả biến bắt buộc', () => {
    setEnv();
    expect(() => loadConfig()).not.toThrow();
    expect(exitSpy).not.toHaveBeenCalled();
  });
});

// ─── Tests: giá trị mặc định (Yêu cầu 7.5) ─────────────────────────────────

describe('Giá trị mặc định khi không cung cấp biến tùy chọn', () => {
  beforeEach(() => setEnv());

  test('ACCESS_TOKEN_TTL mặc định là "15m"', () => {
    const config = loadConfig();
    expect(config.jwt.accessTTL).toBe('15m');
  });

  test('REFRESH_TOKEN_TTL mặc định là "7d"', () => {
    const config = loadConfig();
    expect(config.jwt.refreshTTL).toBe('7d');
  });

  test('JWT_ISSUER mặc định là "auth-service"', () => {
    const config = loadConfig();
    expect(config.jwt.issuer).toBe('auth-service');
  });

  test('JWT_AUDIENCE mặc định là undefined', () => {
    const config = loadConfig();
    expect(config.jwt.audience).toBeUndefined();
  });

  test('REDIS_URL mặc định là "redis://localhost:6379"', () => {
    const config = loadConfig();
    expect(config.redis.url).toBe('redis://localhost:6379');
  });
});

// ─── Tests: giá trị được cung cấp ghi đè mặc định ──────────────────────────

describe('Giá trị cung cấp ghi đè mặc định', () => {
  test('ACCESS_TOKEN_TTL được ghi đè', () => {
    setEnv({ ACCESS_TOKEN_TTL: '30m' });
    const config = loadConfig();
    expect(config.jwt.accessTTL).toBe('30m');
  });

  test('REFRESH_TOKEN_TTL được ghi đè', () => {
    setEnv({ REFRESH_TOKEN_TTL: '14d' });
    const config = loadConfig();
    expect(config.jwt.refreshTTL).toBe('14d');
  });

  test('JWT_ISSUER được ghi đè', () => {
    setEnv({ JWT_ISSUER: 'my-custom-issuer' });
    const config = loadConfig();
    expect(config.jwt.issuer).toBe('my-custom-issuer');
  });

  test('JWT_AUDIENCE được ghi đè', () => {
    setEnv({ JWT_AUDIENCE: 'my-app' });
    const config = loadConfig();
    expect(config.jwt.audience).toBe('my-app');
  });

  test('REDIS_URL được ghi đè', () => {
    setEnv({ REDIS_URL: 'redis://redis-server:6380' });
    const config = loadConfig();
    expect(config.redis.url).toBe('redis://redis-server:6380');
  });
});

// ─── Tests: giá trị bắt buộc được load đúng ─────────────────────────────────

describe('Giá trị bắt buộc được load đúng vào config', () => {
  test('jwt.privateKey lấy từ JWT_PRIVATE_KEY', () => {
    setEnv();
    const config = loadConfig();
    expect(config.jwt.privateKey).toBe(FULL_ENV.JWT_PRIVATE_KEY);
  });

  test('jwt.publicKey lấy từ JWT_PUBLIC_KEY', () => {
    setEnv();
    const config = loadConfig();
    expect(config.jwt.publicKey).toBe(FULL_ENV.JWT_PUBLIC_KEY);
  });

  test('providers.google.clientId lấy từ GOOGLE_CLIENT_ID', () => {
    setEnv();
    const config = loadConfig();
    expect(config.providers.google.clientId).toBe(FULL_ENV.GOOGLE_CLIENT_ID);
  });

});
