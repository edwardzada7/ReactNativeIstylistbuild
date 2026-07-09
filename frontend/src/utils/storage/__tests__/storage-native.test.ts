/* eslint-disable import/first -- jest.mock() calls must be hoisted above the mocked imports */
// Exercises the native Storage implementation (index.ts) with AsyncStorage and
// expo-secure-store fully mocked, so the "never throw" contract (reads return
// the fallback, writes return false) is verified without a device/runtime.
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));
jest.mock('expo-secure-store', () => ({
  __esModule: true,
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { storage } from '../index';

const mockAsync = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
const mockSecure = SecureStore as jest.Mocked<typeof SecureStore>;

beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('Storage (native) general KV', () => {
  it('getItem returns the parsed value on success', async () => {
    mockAsync.getItem.mockResolvedValueOnce(JSON.stringify(123));
    await expect(storage.getItem('k', 0)).resolves.toBe(123);
    expect(mockAsync.getItem).toHaveBeenCalledWith('k');
  });

  it('getItem returns the fallback when the key is missing', async () => {
    mockAsync.getItem.mockResolvedValueOnce(null);
    await expect(storage.getItem('missing', 'fb')).resolves.toBe('fb');
  });

  it('getItem returns the fallback (and warns) when the backend throws', async () => {
    mockAsync.getItem.mockRejectedValueOnce(new Error('boom'));
    await expect(storage.getItem('k', 'fb')).resolves.toBe('fb');
    expect(console.warn).toHaveBeenCalled();
  });

  it('setItem JSON-encodes the value and reports success', async () => {
    mockAsync.setItem.mockResolvedValueOnce(undefined);
    await expect(storage.setItem('k', true)).resolves.toBe(true);
    expect(mockAsync.setItem).toHaveBeenCalledWith('k', JSON.stringify(true));
  });

  it('setItem returns false when the backend throws', async () => {
    mockAsync.setItem.mockRejectedValueOnce(new Error('boom'));
    await expect(storage.setItem('k', 1)).resolves.toBe(false);
  });

  it('removeItem reports success and false on failure', async () => {
    mockAsync.removeItem.mockResolvedValueOnce(undefined);
    await expect(storage.removeItem('k')).resolves.toBe(true);
    mockAsync.removeItem.mockRejectedValueOnce(new Error('boom'));
    await expect(storage.removeItem('k')).resolves.toBe(false);
  });
});

describe('Storage (native) secure KV', () => {
  it('secureGet parses on success and falls back on error', async () => {
    mockSecure.getItemAsync.mockResolvedValueOnce(JSON.stringify('secret'));
    await expect(storage.secureGet('token', '')).resolves.toBe('secret');

    mockSecure.getItemAsync.mockRejectedValueOnce(new Error('locked'));
    await expect(storage.secureGet('token', 'fb')).resolves.toBe('fb');
    expect(console.warn).toHaveBeenCalled();
  });

  it('secureSet encodes the value and reports success/failure', async () => {
    mockSecure.setItemAsync.mockResolvedValueOnce(undefined);
    await expect(storage.secureSet('token', 'abc')).resolves.toBe(true);
    expect(mockSecure.setItemAsync).toHaveBeenCalledWith('token', JSON.stringify('abc'));

    mockSecure.setItemAsync.mockRejectedValueOnce(new Error('boom'));
    await expect(storage.secureSet('token', 'abc')).resolves.toBe(false);
  });

  it('secureRemove reports success and false on failure', async () => {
    mockSecure.deleteItemAsync.mockResolvedValueOnce(undefined);
    await expect(storage.secureRemove('token')).resolves.toBe(true);
    mockSecure.deleteItemAsync.mockRejectedValueOnce(new Error('boom'));
    await expect(storage.secureRemove('token')).resolves.toBe(false);
  });
});
