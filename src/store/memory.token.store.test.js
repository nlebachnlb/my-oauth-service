'use strict';

const { InMemoryTokenStore } = require('./memory.token.store');

describe('InMemoryTokenStore', () => {
  let store;

  beforeEach(() => {
    store = new InMemoryTokenStore();
  });

  // --- saveRefreshToken / getRefreshToken ---

  test('getRefreshToken trả về userId sau khi saveRefreshToken', async () => {
    await store.saveRefreshToken('tok1', 'user-123', 60);
    const userId = await store.getRefreshToken('tok1');
    expect(userId).toBe('user-123');
  });

  test('getRefreshToken trả về null với token không tồn tại', async () => {
    const userId = await store.getRefreshToken('nonexistent');
    expect(userId).toBeNull();
  });

  test('getRefreshToken trả về null khi token đã hết hạn', async () => {
    await store.saveRefreshToken('tok-expired', 'user-456', 0); // TTL = 0s → hết hạn ngay
    // Đợi 1ms để chắc chắn hết hạn
    await new Promise((r) => setTimeout(r, 1));
    const userId = await store.getRefreshToken('tok-expired');
    expect(userId).toBeNull();
  });

  // --- deleteRefreshToken ---

  test('deleteRefreshToken xóa token khỏi store', async () => {
    await store.saveRefreshToken('tok2', 'user-789', 60);
    await store.deleteRefreshToken('tok2');
    const userId = await store.getRefreshToken('tok2');
    expect(userId).toBeNull();
  });

  test('deleteRefreshToken không ném lỗi khi token không tồn tại', async () => {
    await expect(store.deleteRefreshToken('ghost')).resolves.toBeUndefined();
  });

  // --- revokeAccessToken / isRevoked ---

  test('isRevoked trả về false khi jti chưa bị thu hồi', async () => {
    const revoked = await store.isRevoked('jti-abc');
    expect(revoked).toBe(false);
  });

  test('isRevoked trả về true sau khi revokeAccessToken', async () => {
    await store.revokeAccessToken('jti-abc', 60);
    const revoked = await store.isRevoked('jti-abc');
    expect(revoked).toBe(true);
  });

  test('isRevoked trả về false khi jti đã hết hạn trong revocation list', async () => {
    await store.revokeAccessToken('jti-expired', 0); // TTL = 0s
    await new Promise((r) => setTimeout(r, 1));
    const revoked = await store.isRevoked('jti-expired');
    expect(revoked).toBe(false);
  });

  test('revokeAccessToken idempotent — gọi nhiều lần vẫn trả về true', async () => {
    await store.revokeAccessToken('jti-dup', 60);
    await store.revokeAccessToken('jti-dup', 60);
    const revoked = await store.isRevoked('jti-dup');
    expect(revoked).toBe(true);
  });
});
