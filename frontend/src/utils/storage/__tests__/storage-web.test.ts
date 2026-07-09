/* eslint-disable import/first -- jest.mock() calls must be hoisted above the mocked imports */
// Covers the web Storage implementation (index.web.ts). On web there is no
// Keychain, so the secure* helpers must transparently delegate to the plain
// AsyncStorage-backed methods.
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Storage } from '../index.web';

const mockAsync = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('Storage (web)', () => {
  const storage = new Storage();

  it('reads/writes via AsyncStorage', async () => {
    mockAsync.getItem.mockResolvedValueOnce(JSON.stringify('v'));
    await expect(storage.getItem('k', '')).resolves.toBe('v');
    await storage.setItem('k', 5);
    expect(mockAsync.setItem).toHaveBeenCalledWith('k', JSON.stringify(5));
  });

  it('secureGet delegates to the same AsyncStorage-backed read', async () => {
    mockAsync.getItem.mockResolvedValueOnce(JSON.stringify('secret'));
    await expect(storage.secureGet('token', '')).resolves.toBe('secret');
    expect(mockAsync.getItem).toHaveBeenCalledWith('token');
  });

  it('secureSet delegates to the AsyncStorage-backed write', async () => {
    mockAsync.setItem.mockResolvedValueOnce(undefined);
    await expect(storage.secureSet('token', 'abc')).resolves.toBe(true);
    expect(mockAsync.setItem).toHaveBeenCalledWith('token', JSON.stringify('abc'));
  });

  it('secureRemove delegates to the AsyncStorage-backed remove', async () => {
    mockAsync.removeItem.mockResolvedValueOnce(undefined);
    await expect(storage.secureRemove('token')).resolves.toBe(true);
    expect(mockAsync.removeItem).toHaveBeenCalledWith('token');
  });
});
