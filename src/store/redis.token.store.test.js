'use strict';

// Mock ioredis trước khi require RedisTokenStore
jest.mock('ioredis');
const Redis = require('ioredis');

const { RedisTokenStore } = require('./redis.token.store');

describe('RedisTokenStore', () => {
  let store;
  let mockClient;

  beforeEach(() => {
    // Tạo mock client với các method cần thiết
    mockClient = {
      set: jest.fn().mockResolvedValue('OK'),
      get: jest.fn().mockResolvedValue(null),
      del: jest.fn().mockResolvedValue(1),
    };

    // Mock constructor Redis trả về mockClient
    Redis.mockImplementation(() => mockClient);

    store = new RedisTokenStore('redis://localhost:6379');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // --- saveRefreshToken ---

  test('saveRefreshToken gọi Redis SET với key pattern refresh:{token}, value là userId, và TTL đúng (EX)', async () => {
    await store.saveRefreshToken('abc123', 'user-42', 3600);

    expect(mockClient.set).toHaveBeenCalledTimes(1);
    expect(mockClient.set).toHaveBeenCalledWith('refresh:abc123', 'user-42', 'EX', 3600);
  });

  // --- getRefreshToken ---

  test('getRefreshToken trả về null khi key không tồn tại trong Redis', async () => {
    mockClient.get.mockResolvedValue(null);

    const result = await store.getRefreshToken('nonexistent');

    expect(result).toBeNull();
    expect(mockClient.get).toHaveBeenCalledWith('refresh:nonexistent');
  });

  // --- isRevoked sau revokeAccessToken ---

  test('isRevoked trả về true sau khi gọi revokeAccessToken', async () => {
    // Sau khi revoke, get trả về '1'
    mockClient.get.mockResolvedValue('1');

    await store.revokeAccessToken('jti-xyz', 900);
    const revoked = await store.isRevoked('jti-xyz');

    expect(mockClient.set).toHaveBeenCalledWith('revoked:jti-xyz', '1', 'EX', 900);
    expect(mockClient.get).toHaveBeenCalledWith('revoked:jti-xyz');
    expect(revoked).toBe(true);
  });
});
