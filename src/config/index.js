'use strict';

// Biến môi trường bắt buộc
const REQUIRED = [
  'JWT_PRIVATE_KEY',
  'JWT_PUBLIC_KEY',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GITHUB_CLIENT_ID',
  'GITHUB_CLIENT_SECRET',
];

// Validate biến môi trường bắt buộc khi khởi động
const missing = REQUIRED.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(
    `[config] Thiếu biến môi trường bắt buộc: ${missing.join(', ')}. ` +
    'Vui lòng cung cấp đầy đủ trước khi khởi động dịch vụ.'
  );
  process.exit(1);
}

// Schema cấu hình với giá trị mặc định
const config = {
  jwt: {
    privateKey: process.env.JWT_PRIVATE_KEY,   // PEM string
    publicKey:  process.env.JWT_PUBLIC_KEY,    // PEM string
    issuer:     process.env.JWT_ISSUER     || 'auth-service',
    audience:   process.env.JWT_AUDIENCE   || undefined,
    accessTTL:  process.env.ACCESS_TOKEN_TTL  || '15m',
    refreshTTL: process.env.REFRESH_TOKEN_TTL || '7d',
  },
  providers: {
    google: {
      clientId:     process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackUrl:  process.env.GOOGLE_CALLBACK_URL,
    },
    github: {
      clientId:     process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackUrl:  process.env.GITHUB_CALLBACK_URL,
    },
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
};

module.exports = config;
