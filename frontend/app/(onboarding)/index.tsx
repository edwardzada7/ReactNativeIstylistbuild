import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, FontSizes, Spacing, BorderRadius } from '../../src/constants/theme';
import { Button } from '../../src/components/common';

const { width } = Dimensions.get('window');

const slides = [
  {
    id: '1',
    icon: 'search-outline' as const,
    title: 'Find Top Stylists',
    description: 'Discover verified beauty and style professionals near you with top ratings',
  },
  {
    id: '2',
    icon: 'calendar-outline' as const,
    title: 'Book Instantly',
    description: 'Schedule appointments instantly with real-time availability',
  },
  {
    id: '3',
    icon: 'shield-checkmark-outline' as const,
    title: 'Secure Payments',
    description: 'Pay securely with escrow protection until service completion',
  },
  {
    id: '4',
    icon: 'star-outline' as const,
    title: 'Rate & Review',
    description: 'Share your experience and help others make informed decisions',
  },
];

export default function Onboarding() {
  const router = useRouter();
  const flatListRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleNext = () => {
    if (currentIndex < slides.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
    } else {
      router.replace('/(auth)/login');
    }
  };

  const handleSkip = () => {
    router.replace('/(auth)/login');
  };

  const renderItem = ({ item }: { item: typeof slides[0] }) => (
    <View style={styles.slide}>
      <View style={styles.iconContainer}>
        <Ionicons name={item.icon} size={80} color={Colors.primary} />
      </View>
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.description}>{item.description}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>

      <FlatList
        ref={flatListRef}
        data={slides}
        renderItem={renderItem}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(event) => {
          const index = Math.round(event.nativeEvent.contentOffset.x / width);
          setCurrentIndex(index);
        }}
        keyExtractor={(item) => item.id}
      />

      <View style={styles.footer}>
        <View style={styles.pagination}>
          {slides.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                index === currentIndex && styles.activeDot,
              ]}
            />
          ))}
        </View>

        <Button
          title={currentIndex === slides.length - 1 ? "Get Started" : "Next"}
          onPress={handleNext}
          fullWidth
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  skipButton: {
    alignSelf: 'flex-end',
    padding: Spacing.md,
    marginRight: Spacing.md,
  },
  skipText: {
    fontSize: FontSizes.md,
    color: Colors.primary,
    fontWeight: '600',
  },
  slide: {
    width,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  iconContainer: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  title: {
    fontSize: FontSizes.xxl,
    fontWeight: 'bold',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  description: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  footer: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
    gap: Spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.border,
  },
  activeDot: {
    backgroundColor: Colors.primary,
    width: 24,
  },
});