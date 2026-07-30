import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Colors, FontSizes, Spacing } from '../src/constants/theme';
import { BrandAssets, BrandColors } from '../src/constants/brand';
import { useAuth } from '../src/contexts/AuthContext';
import { Loading } from '../src/components/common';

export default function Index() {
  const router = useRouter();
  const { isAuthenticated, isLoading, user } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      const timer = setTimeout(() => {
        if (isAuthenticated) {
          if (user?.role === 'admin') {
            router.replace('/(admin)/feed-moderation');
          } else if (user?.role === 'provider') {
            router.replace('/(provider)/dashboard');
          } else {
            router.replace('/(tabs)');
          }
        } else {
          router.replace('/(onboarding)');
        }
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [isLoading, isAuthenticated, user?.role]);

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
      <Animated.View
        entering={FadeIn.duration(1000)}
        exiting={FadeOut.duration(500)}
        style={styles.content}
      >
        <View style={styles.logoContainer}>
          <Image source={BrandAssets.logo} style={styles.logo} resizeMode="contain" />
        </View>
        <Text style={styles.title}>iStylist</Text>
        <Text style={styles.tagline}>Your Beauty & Style Partner</Text>
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
    alignItems: 'center',
  },
  logoContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  logo: {
    width: 112,
    height: 112,
  },
  title: {
    fontSize: FontSizes.xxxl,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  tagline: {
    fontSize: FontSizes.lg,
    color: Colors.text,
    opacity: 0.9,
  },
});