import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { apiService } from '../services/api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function registerToken(authId: string): Promise<void> {
  if (!Device.isDevice) return; // emulators cannot receive push
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') {
    status = (await Notifications.requestPermissionsAsync()).status;
  }
  if (status !== 'granted') return;
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? (Constants as any).easConfig?.projectId;
  const token = (await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data;
  await apiService.post('/push/register', { auth_id: authId, token, platform: Platform.OS });
}

/** Registers this phone for push after sign-in and opens the right screen on tap. */
export function usePushNotifications(authId?: string | null) {
  const router = useRouter();

  useEffect(() => {
    if (!authId) return;
    registerToken(authId).catch((err) => console.warn('[push] registration failed', err));
  }, [authId]);

  useEffect(() => {
    const open = (data: any) => {
      try {
        const type = String(data?.type || '');
        if (data?.booking_id && type.includes('booking')) router.push(`/bookings/${data.booking_id}` as any);
        else if (type.includes('message') || type.includes('chat')) router.push('/messages' as any);
        else router.push('/notifications' as any);
      } catch (e) {
        console.warn('[push] open failed', e);
      }
    };
    const sub = Notifications.addNotificationResponseReceivedListener((r) =>
      open(r.notification.request.content.data)
    );
    return () => sub.remove();
  }, [router]);
}
