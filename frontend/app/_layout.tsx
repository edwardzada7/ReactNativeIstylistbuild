import React from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { LogBox } from 'react-native';
import * as Sentry from '@sentry/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '@/src/contexts/AuthContext';
import { ThemeProvider } from '@/src/contexts/ThemeContext';
import { useIconFonts } from '@/src/hooks/use-icon-fonts';
import { screenCache } from '@/src/utils/screenCache';
import { usePushNotifications } from '@/src/hooks/usePushNotifications';
import { UnreadMessagesProvider } from '@/src/contexts/UnreadMessagesContext';
import '@/src/utils/androidTextFix';

// Disable logbox errors etc so that users can see the app
// and agent works as expected.
LogBox.ignoreAllLogs(true);

// Release builds: silence console.log so debug output (booking payloads, ids) is
// never written to the device log. console.warn / console.error still work.
if (!__DEV__) {
  console.log = () => {};
}

// Keep the native splash visible from cold start until icon fonts register.
// Required because @expo/vector-icons' componentDidMount fallback fires
// Font.loadAsync against a broken vendor path if any <Icon> mounts before
// the family is registered — which throws on Android Expo Go.
SplashScreen.preventAutoHideAsync();

// Crash and error reporting. The DSN is a public key (it can only send reports).
Sentry.init({
  dsn:
    process.env.EXPO_PUBLIC_SENTRY_DSN ||
    'https://c80a3945be5f13612ea1870fedb9766e@o4512467677216768.ingest.us.sentry.io/4512467697139712',
  enabled: !__DEV__,
  tracesSampleRate: 0,
  sendDefaultPii: false,
});

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

function AppShell() {
  const [loaded, error] = useIconFonts();
  const [cacheReady, setCacheReady] = useState(false);
  useEffect(() => {
    screenCache.hydrate().finally(() => setCacheReady(true));
  }, []);
  const router = useRouter();
  const segments = useSegments();
  const { isAuthenticated, isLoading, user } = useAuth();
  usePushNotifications(user?.auth_id);

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  useEffect(() => {
    if (isLoading) return;

    const current = segments[0];
    // (tabs) is guest-browsable; account-only tab screens show a sign-in prompt.
    const protectedGroup = current === '(provider)' || current === '(admin)';
    if (!isAuthenticated && protectedGroup) {
      router.replace('/(auth)/login');
    }
  }, [segments, isAuthenticated, isLoading, router]);

  // If the CDN is unreachable we fall through on error rather than wedging
  // the app — icons will tofu, but the app still boots.
  if ((!loaded && !error) || !cacheReady) return null;

  return (
    <UnreadMessagesProvider>
      <ThemeProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(onboarding)" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="(provider)" />
          <Stack.Screen name="(admin)" />
        </Stack>
      </ThemeProvider>
    </UnreadMessagesProvider>
  );
}

function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </QueryClientProvider>
  );
}
export default Sentry.wrap(RootLayout);
