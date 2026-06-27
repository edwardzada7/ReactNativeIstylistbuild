import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, FontSizes, Spacing, BorderRadius } from '../../src/constants/theme';
import { Card } from '../../src/components/common';
import { useAuth } from '../../src/contexts/AuthContext';

const { width } = Dimensions.get('window');

const categories = [
  { id: '1', name: 'Hair Styling', icon: 'cut' },
  { id: '2', name: 'Makeup', icon: 'color-palette' },
  { id: '3', name: 'Nails', icon: 'hand-left' },
  { id: '4', name: 'Spa', icon: 'water' },
  { id: '5', name: 'Massage', icon: 'fitness' },
  { id: '6', name: 'Skin Care', icon: 'sparkles' },
];

const featuredProviders = [
  {
    id: '1',
    name: 'Glamour Studio',
    category: 'Hair & Makeup',
    rating: 4.9,
    reviews: 234,
    price: '$$',
    image: '💇',
  },
  {
    id: '2',
    name: 'Elegance Spa',
    category: 'Spa & Wellness',
    rating: 4.8,
    reviews: 189,
    price: '$$$',
    image: '💆',
  },
];

export default function Home() {
  const router = useRouter();
  const { user } = useAuth();

  const renderCategoryCard = ({ item }: { item: typeof categories[0] }) => (
    <TouchableOpacity style={styles.categoryCard}>
      <View style={styles.categoryIcon}>
        <Ionicons name={item.icon as any} size={28} color={Colors.primary} />
      </View>
      <Text style={styles.categoryName}>{item.name}</Text>
    </TouchableOpacity>
  );

  const renderProviderCard = ({ item }: { item: typeof featuredProviders[0] }) => (
    <TouchableOpacity style={styles.providerCard}>
      <View style={styles.providerImage}>
        <Text style={styles.providerEmoji}>{item.image}</Text>
      </View>
      <View style={styles.providerInfo}>
        <Text style={styles.providerName}>{item.name}</Text>
        <Text style={styles.providerCategory}>{item.category}</Text>
        <View style={styles.providerMeta}>
          <View style={styles.rating}>
            <Ionicons name="star" size={14} color={Colors.warning} />
            <Text style={styles.ratingText}>{item.rating}</Text>
            <Text style={styles.reviewsText}>({item.reviews})</Text>
          </View>
          <Text style={styles.price}>{item.price}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hello {user?.full_name || 'there'}! 👋</Text>
            <Text style={styles.subGreeting}>Find your perfect style today</Text>
          </View>
          <TouchableOpacity style={styles.notificationButton}>
            <Ionicons name="notifications-outline" size={24} color={Colors.text} />
            <View style={styles.badge} />
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <TouchableOpacity
          style={styles.searchBar}
          onPress={() => router.push('/(tabs)/search')}
        >
          <Ionicons name="search" size={20} color={Colors.textMuted} />
          <Text style={styles.searchPlaceholder}>Search services or providers...</Text>
        </TouchableOpacity>

        {/* Banner */}
        <LinearGradient
          colors={[Colors.primary, Colors.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.banner}
        >
          <View style={styles.bannerContent}>
            <Text style={styles.bannerTitle}>Special Offer!</Text>
            <Text style={styles.bannerSubtitle}>
              Get 20% off on your first booking
            </Text>
            <TouchableOpacity style={styles.bannerButton}>
              <Text style={styles.bannerButtonText}>Book Now</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.bannerEmoji}>🎉</Text>
        </LinearGradient>

        {/* Categories */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Categories</Text>
            <TouchableOpacity>
              <Text style={styles.seeAll}>See All</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={categories}
            renderItem={renderCategoryCard}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoriesList}
          />
        </View>

        {/* Featured Providers */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Featured Providers</Text>
            <TouchableOpacity>
              <Text style={styles.seeAll}>See All</Text>
            </TouchableOpacity>
          </View>
          {featuredProviders.map((provider) => (
            <View key={provider.id}>{renderProviderCard({ item: provider })}</View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingBottom: Spacing.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  greeting: {
    fontSize: FontSizes.xl,
    fontWeight: 'bold',
    color: Colors.text,
  },
  subGreeting: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  notificationButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.error,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    borderRadius: BorderRadius.md,
  },
  searchPlaceholder: {
    fontSize: FontSizes.md,
    color: Colors.textMuted,
  },
  banner: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bannerContent: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: FontSizes.xl,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 4,
  },
  bannerSubtitle: {
    fontSize: FontSizes.sm,
    color: Colors.text,
    opacity: 0.9,
    marginBottom: Spacing.sm,
  },
  bannerButton: {
    backgroundColor: Colors.text,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    alignSelf: 'flex-start',
  },
  bannerButtonText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.primary,
  },
  bannerEmoji: {
    fontSize: 64,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
    color: Colors.text,
  },
  seeAll: {
    fontSize: FontSizes.sm,
    color: Colors.primary,
    fontWeight: '600',
  },
  categoriesList: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  categoryCard: {
    width: 80,
    alignItems: 'center',
  },
  categoryIcon: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  categoryName: {
    fontSize: FontSizes.xs,
    color: Colors.text,
    textAlign: 'center',
  },
  providerCard: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  providerImage: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  providerEmoji: {
    fontSize: 40,
  },
  providerInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  providerName: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  providerCategory: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  providerMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.text,
  },
  reviewsText: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
  },
  price: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.primary,
  },
});