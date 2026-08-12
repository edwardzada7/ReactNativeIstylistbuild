import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, FontSizes, Spacing, BorderRadius } from '../../src/constants/theme';
import { BrandColors } from '../../src/constants/brand';
import { BrandLogo } from '../../src/components/branding';
import { useAuth } from '../../src/contexts/AuthContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { providerService } from '../../src/services/provider.service';
import { notificationService } from '../../src/services/notification.service';
import { formatPriceRange } from '../../src/utils/currency';
import { Category, Provider } from '../../src/types';

export default function Home() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();

  const [categories, setCategories] = useState<Category[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnreadCount = useCallback(async () => {
    try {
      const res = await notificationService.getUnreadCount();
      setUnreadCount(res.count || 0);
    } catch (err) {
      console.error('[home] failed to load unread count', err);
    }
  }, []);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const [providerList, categoryList] = await Promise.all([
        providerService.getProvidersWithServices(),
        providerService.getCategories(),
      ]);
      setProviders(providerList);
      setCategories(categoryList);
      await refreshUnreadCount();
    } catch (err: any) {
      console.error('[home] failed to load data', err);
      setError(err?.friendlyMessage || 'Could not load providers. Pull down to retry.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [refreshUnreadCount]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useFocusEffect(
    useCallback(() => {
      refreshUnreadCount();
    }, [refreshUnreadCount])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const featuredProviders = providers.slice(0, 5);
  const popularProviders = [...providers]
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 8);

  const goToProvider = (id: string) => router.push(`/provider/${id}`);
  const goToCategory = (categoryName: string) =>
    router.push({ pathname: '/(tabs)/search', params: { category: categoryName } });

  const renderCategoryCard = ({ item }: { item: Category }) => {
    const iconName = (() => {
      switch (item.name) {
        case 'Beauty & Grooming':
          return 'sparkles';
        case 'Body & Aesthetic':
        case 'Body & Aesthetics':
          return 'body-outline';
        case 'Wellness & Care':
          return 'heart-outline';
        case 'Fashion & Bridal':
          return 'diamond-outline';
        case 'Events & Entertainment':
          return 'calendar-outline';
        case 'Classes & Learning':
          return 'school-outline';
        default:
          return (item.icon as any) || 'grid-outline';
      }
    })();

    return (
      <TouchableOpacity
        style={[styles.categoryCard, { backgroundColor: colors.surface }]}
        onPress={() => goToCategory(item.name)}
        accessibilityRole="button"
        accessibilityLabel={item.name}
      >
        <View style={[styles.categoryIcon, { backgroundColor: `${colors.primary}20` }]}>
          <Ionicons name={iconName as any} size={28} color={colors.primary} />
        </View>
        <Text style={[styles.categoryName, { color: colors.text }]} numberOfLines={1}>
          {item.name}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderProviderCard = (item: Provider) => (
    <TouchableOpacity
      key={item.id}
      style={[styles.providerCard, { backgroundColor: colors.surface }]}
      onPress={() => goToProvider(item.id)}
      accessibilityRole="button"
      accessibilityLabel={item.business_name}
    >
      <View style={[styles.providerImage, { backgroundColor: colors.surfaceLight }]}>
        {item.profile_image_url || item.avatar ? (
          <Image
            source={{ uri: item.profile_image_url || item.avatar }}
            style={styles.providerImagePhoto}
            contentFit="cover"
            transition={150}
          />
        ) : (
          <Ionicons name="person" size={32} color={colors.primary} />
        )}
      </View>
      <View style={styles.providerInfo}>
        <Text style={[styles.providerName, { color: colors.text }]} numberOfLines={1}>
          {item.business_name}
        </Text>
        <Text style={[styles.providerCategory, { color: colors.textSecondary }]} numberOfLines={1}>
          {typeof item.category === 'string' ? item.category : item.location}
        </Text>
        <View style={styles.providerMeta}>
          <View style={styles.rating}>
            <Ionicons name="star" size={14} color={colors.warning} />
            <Text style={[styles.ratingText, { color: colors.text }]}>{item.rating ? item.rating.toFixed(1) : 'New'}</Text>
            <Text style={[styles.reviewsText, { color: colors.textSecondary }]}>({item.review_count})</Text>
          </View>
          <Text style={[styles.price, { color: colors.textSecondary }]}>{formatPriceRange(item.price_range)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Finding great stylists for you...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.titleWrap}>
            <BrandLogo size={40} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.greeting, { color: colors.text }]}>Hello {user?.full_name || 'there'}! 👋</Text>
              <Text style={[styles.subGreeting, { color: colors.textSecondary }]}>Find your perfect style today</Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[styles.iconButton, { backgroundColor: colors.surface }]}
              onPress={() => router.push('/chat/list')}
              accessibilityRole="button"
              accessibilityLabel="Chat"
            >
              <Ionicons name="chatbubble-outline" size={24} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.iconButton, { backgroundColor: colors.surface }]}
              onPress={() => router.push('/notifications')}
              accessibilityRole="button"
              accessibilityLabel="Notifications"
            >
              <Ionicons name="notifications-outline" size={24} color={colors.text} />
              {unreadCount > 0 ? (
                <View style={[styles.badge, { backgroundColor: colors.error }]}>
                  <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.iconButton, { backgroundColor: colors.surface }]}
              onPress={() => router.push('/(tabs)/profile')}
              accessibilityRole="button"
              accessibilityLabel="Profile"
            >
              <Ionicons name="person-circle-outline" size={26} color={colors.text} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Search Bar */}
        <TouchableOpacity
          style={[styles.searchBar, { backgroundColor: colors.surface }]}
          onPress={() => router.push('/(tabs)/search')}
          accessibilityRole="button"
          accessibilityLabel="Search services or providers"
        >
          <Ionicons name="search" size={20} color={colors.textMuted} />
          <Text style={[styles.searchPlaceholder, { color: colors.textMuted }]}>Search services or providers...</Text>
        </TouchableOpacity>

        {/* Banner */}
        <LinearGradient
          colors={[BrandColors.primaryPink, BrandColors.primaryPurple]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.banner}
        >
          <View style={styles.bannerContent}>
            <Text style={[styles.bannerTitle, { color: '#fff' }]}>Special Offer!</Text>
            <Text style={[styles.bannerSubtitle, { color: '#fff', opacity: 0.9 }]}>
              Get 20% off on your first booking
            </Text>
            <TouchableOpacity
              style={[styles.bannerButton, { backgroundColor: colors.surfaceLight }]}
              onPress={() => router.push('/(tabs)/search')}
              accessibilityRole="button"
              accessibilityLabel="Book Now"
            >
              <Text style={[styles.bannerButtonText, { color: colors.primary }]}>Book Now</Text>
            </TouchableOpacity>
          </View>
          <BrandLogo size={56} />
        </LinearGradient>

        {error && (
          <View style={[styles.errorBanner, { backgroundColor: colors.surface }]}>
            <Ionicons name="alert-circle-outline" size={18} color={colors.error} />
            <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
          </View>
        )}

        {/* Categories */}
        {categories.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Categories</Text>
              <TouchableOpacity
                onPress={() => router.push('/(tabs)/search')}
                accessibilityRole="button"
                accessibilityLabel="See all categories"
              >
                <Text style={[styles.seeAll, { color: colors.primary }]}>See All</Text>
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
        )}

        {/* Featured Providers */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Featured Providers</Text>
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/search')}
              accessibilityRole="button"
              accessibilityLabel="See all featured providers"
            >
              <Text style={[styles.seeAll, { color: colors.primary }]}>See All</Text>
            </TouchableOpacity>
          </View>
          {featuredProviders.length > 0 ? (
            featuredProviders.map(renderProviderCard)
          ) : (
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No providers available right now.</Text>
          )}
        </View>

        {/* Popular Providers */}
        {popularProviders.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Popular Near You</Text>
              <TouchableOpacity
                onPress={() => router.push('/(tabs)/search')}
                accessibilityRole="button"
                accessibilityLabel="See all popular providers"
              >
                <Text style={[styles.seeAll, { color: colors.primary }]}>See All</Text>
              </TouchableOpacity>
            </View>
            {popularProviders.map(renderProviderCard)}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
  },
  loadingText: {
    fontSize: FontSizes.sm,
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
  },
  subGreeting: {
    fontSize: FontSizes.sm,
    marginTop: 4,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  titleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: { fontSize: 10, fontWeight: '700', color: '#fff' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    borderRadius: BorderRadius.md,
  },
  searchPlaceholder: {
    fontSize: FontSizes.md,
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
    marginBottom: 4,
  },
  bannerSubtitle: {
    fontSize: FontSizes.sm,
    marginBottom: Spacing.sm,
  },
  bannerButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    alignSelf: 'flex-start',
  },
  bannerButtonText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  bannerEmoji: {
    fontSize: 64,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  errorText: {
    flex: 1,
    fontSize: FontSizes.sm,
  },
  emptyText: {
    fontSize: FontSizes.sm,
    paddingHorizontal: Spacing.lg,
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
  },
  seeAll: {
    fontSize: FontSizes.sm,
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
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  categoryName: {
    fontSize: FontSizes.xs,
    textAlign: 'center',
  },
  providerCard: {
    flexDirection: 'row',
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  providerImage: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
    overflow: 'hidden',
  },
  providerImagePhoto: {
    width: '100%',
    height: '100%',
  },
  providerInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  providerName: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    marginBottom: 4,
  },
  providerCategory: {
    fontSize: FontSizes.sm,
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
  },
  reviewsText: {
    fontSize: FontSizes.xs,
  },
  price: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
});