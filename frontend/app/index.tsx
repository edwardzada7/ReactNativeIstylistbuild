import React, { useEffect } from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { BrandColors, BrandAssets } from '../src/constants/brand';
import { useAuth } from '../src/contexts/AuthContext';
import { Loading } from '../src/components/common';

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

    router.replace('/(auth)/login');
  }, [isLoading, isAuthenticated, user?.role, router]);

  if (isLoading) {
    return <Loading />;
  }

  return (
    <LinearGradient
      colors={[BrandColors.primaryPink, BrandColors.primaryPurple, BrandColors.accentCyan]}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <Animated.View entering={FadeIn.duration(600)} exiting={FadeOut.duration(200)} style={styles.content}>
        <Image source={BrandAssets.appImage} style={styles.brandImage} resizeMode="contain" />
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  brandImage: {
    width: '100%',
    maxWidth: 420,
    height: 480,
  },
});