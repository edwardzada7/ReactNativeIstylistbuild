import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as aesjs from 'aes-js';
import 'react-native-get-random-values';

// Supabase sessions (access + refresh token JSON) can exceed SecureStore's
// ~2048 byte limit, so we store the session payload (encrypted) in
// AsyncStorage and keep only the small AES-256 encryption key in SecureStore,
// which is backed by the OS keychain / keystore.
const ENCRYPTION_KEY_ID = 'istylist_supabase_encryption_key';

async function getOrCreateEncryptionKey(): Promise<Uint8Array> {
  const existing = await SecureStore.getItemAsync(ENCRYPTION_KEY_ID);
  let keyHex: string = existing ?? '';
  if (!keyHex) {
    const keyBytes = new Uint8Array(32);
    crypto.getRandomValues(keyBytes);
    keyHex = aesjs.utils.hex.fromBytes(keyBytes);
    await SecureStore.setItemAsync(ENCRYPTION_KEY_ID, keyHex);
  }
  return new Uint8Array(aesjs.utils.hex.toBytes(keyHex));
}

async function encrypt(value: string): Promise<string> {
  const key = await getOrCreateEncryptionKey();
  const textBytes = aesjs.utils.utf8.toBytes(value);
  const iv = new Uint8Array(16);
  crypto.getRandomValues(iv);
  const aesCtr = new aesjs.ModeOfOperation.ctr(key, new aesjs.Counter(iv));
  const encryptedBytes = aesCtr.encrypt(textBytes);
  return `${aesjs.utils.hex.fromBytes(iv)}:${aesjs.utils.hex.fromBytes(encryptedBytes)}`;
}

async function decrypt(payload: string): Promise<string | null> {
  if (!payload) return null;
  const [ivHex, cipherHex] = payload.split(':');
  if (!ivHex || !cipherHex) return null;
  const key = await getOrCreateEncryptionKey();
  const iv = new Uint8Array(aesjs.utils.hex.toBytes(ivHex));
  const encryptedBytes = new Uint8Array(aesjs.utils.hex.toBytes(cipherHex));
  const aesCtr = new aesjs.ModeOfOperation.ctr(key, new aesjs.Counter(iv));
  const decryptedBytes = aesCtr.decrypt(encryptedBytes);
  return aesjs.utils.utf8.fromBytes(decryptedBytes);
}

/**
 * Storage adapter passed to supabase-js `auth.storage`.
 * Encrypts session JSON with an AES key held in SecureStore, and persists
 * the ciphertext in AsyncStorage (which has no practical size limit).
 */
export class LargeSecureStore {
  async getItem(key: string): Promise<string | null> {
    const payload = await AsyncStorage.getItem(key);
    if (!payload) return null;
    try {
      return await decrypt(payload);
    } catch (err) {
      console.warn('[secureStore] failed to decrypt session, clearing', err);
      await AsyncStorage.removeItem(key);
      return null;
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    if (value == null) {
      await AsyncStorage.removeItem(key);
      return;
    }
    try {
      const encrypted = await encrypt(value);
      await AsyncStorage.setItem(key, encrypted);
    } catch (err) {
      // Persisting the new session failed. Deliberately don't re-throw:
      // supabase-js calls this on every sign-in AND every token refresh, and
      // a thrown storage error there would surface as a spurious login
      // failure / logout for what may be a transient device-storage hiccup.
      // But we must NOT leave the previous (now-stale) ciphertext behind - a
      // later getItem would otherwise resurrect an outdated session - and the
      // failure must be loud rather than silently swallowed, so log at error
      // level and clear the key.
      console.error('[secureStore] failed to persist session, clearing key', err);
      await AsyncStorage.removeItem(key).catch((removeErr) => {
        console.error('[secureStore] failed to clear stale session key', removeErr);
      });
    }
  }

  async removeItem(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
  }
}
