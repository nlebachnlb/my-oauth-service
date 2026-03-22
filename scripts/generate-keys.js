/**
 * Script tạo RSA key pair (RS256) và ghi vào file .env
 * Chạy: node scripts/generate-keys.js
 */

const { generateKeyPairSync } = require('crypto');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');

// Generate RSA 2048-bit key pair
const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

// Chuyển PEM multiline thành single-line với \n
const toEnvValue = (pem) => pem.replace(/\n/g, '\\n');

// Đọc .env hiện tại
let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';

// Replace hoặc append JWT_PRIVATE_KEY
const replaceOrAppend = (content, key, value) => {
  const regex = new RegExp(`^${key}=.*$`, 'm');
  const line = `${key}="${value}"`;
  return regex.test(content) ? content.replace(regex, line) : content + `\n${line}`;
};

envContent = replaceOrAppend(envContent, 'JWT_PRIVATE_KEY', toEnvValue(privateKey));
envContent = replaceOrAppend(envContent, 'JWT_PUBLIC_KEY', toEnvValue(publicKey));

fs.writeFileSync(envPath, envContent, 'utf8');

console.log('✅ RSA key pair đã được tạo và ghi vào .env');
console.log('   JWT_PRIVATE_KEY — PKCS8 format');
console.log('   JWT_PUBLIC_KEY  — SPKI format');
