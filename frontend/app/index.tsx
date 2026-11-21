import React, { useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, StyleSheet, Image } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { BrandAssets } from '../src/constants/brand';
import { useAuth } from '../src/contexts/AuthContext';

export default function Index() {
  const router = useRouter();
  const { isAuthenticated, isLoading, user } = useAuth();

  useEffect(() => {
    if (isLoading) return;

    if (isAuthenticated) {
      if (user?.role === 'admin') {
        router.replace('/(admin)/feed-moderation');
      } else if (user?.role === 'provider') {
        router.replace('/(provider)/dashboard');
      } else {
        router.replace('/(tabs)');
      }
      return;
    }

    // First-time visitors see the short welcome tour once; everyone else browses as a guest.
    // Individual booking, payment, messaging, review and reporting actions enforce auth.
    AsyncStorage.getItem('onboarding_seen')
      .then((seen) => router.replace(seen ? '/(tabs)' : '/(onboarding)'))
      .catch(() => router.replace('/(tabs)'));
  }, [isLoading, isAuthenticated, user?.role, router]);

  return (
    <View style={styles.container}>
      <Animated.View entering={FadeIn.duration(300)} exiting={FadeOut.duration(200)} style={styles.content}>
        <Image source={BrandAssets.logo} style={styles.brandImage} resizeMode="contain" />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  content: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  brandImage: {
    width: 138,
    height: 138,
  },
});