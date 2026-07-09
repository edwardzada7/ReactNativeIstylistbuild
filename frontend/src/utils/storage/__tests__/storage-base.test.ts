import { StorageBase, StorageItemValue } from '../storage-base';

// Minimal concrete subclass that exposes the protected `retrieve` helper so the
// shared (platform-agnostic) parsing/fallback logic can be unit-tested without
// pulling in AsyncStorage / SecureStore.
class TestStorage extends StorageBase {
  public retrievePublic<F extends StorageItemValue>(raw: string | null, fallback: F) {
    return this.retrieve(raw, fallback);
  }
  async getItem<F extends StorageItemValue>(_k: string, fallback: F) {
    return fallback;
  }
  async setItem() {
    return true;
  }
  async removeItem() {
    return true;
  }
  async secureGet<F extends StorageItemValue>(_k: string, fallback: F) {
    return fallback;
  }
  async secureSet() {
    return true;
  }
  async secureRemove() {
    return true;
  }
}

describe('StorageBase.retrieve', () => {
  let storage: TestStorage;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    storage = new TestStorage();
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('returns the fallback when the stored value is null (missing key)', () => {
    expect(storage.retrievePublic(null, 'fallback')).toBe('fallback');
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('round-trips JSON-encoded values back to their original type', () => {
    expect(storage.retrievePublic(JSON.stringify('hello'), '')).toBe('hello');
    expect(storage.retrievePublic(JSON.stringify(42), 0)).toBe(42);
    expect(storage.retrievePublic(JSON.stringify(true), false)).toBe(true);
    expect(storage.retrievePublic(JSON.stringify(null), 'x')).toBeNull();
  });

  it('warns and returns the fallback on malformed JSON', () => {
    expect(storage.retrievePublic('{not valid json', 'fallback')).toBe('fallback');
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain('[storage]');
  });
});
