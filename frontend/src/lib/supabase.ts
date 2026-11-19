import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import { LargeSecureStore } from './secureStore';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[supabase] EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY are missing. ' +
      'Auth calls will fail until they are set in frontend/.env'
  );
}

// Mobile needs an encrypted persistent storage adapter and must not try to
// parse sessions out of redirect URLs. Web can safely fall back to the
// browser's own localStorage-backed default and URL detection.
// createClient throws on an empty URL, which closes the app at launch. Fall back to
// inert placeholders so the app still opens; sign-in then shows an error instead.
export const supabase = createClient(
  supabaseUrl || 'https://missing-config.invalid',
  supabaseAnonKey || 'missing-config',
  {
  auth: {
    storage: Platform.OS === 'web' ? undefined : new LargeSecureStore(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
  }
);
