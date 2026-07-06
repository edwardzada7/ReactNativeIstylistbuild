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
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, FontSizes, Spacing, BorderRadius } from '../../src/constants/theme';
import { useAuth } from '../../src/contexts/AuthContext';
import { providerService } from '../../src/services/provider.service';
import { formatPriceRange } from '../../src/utils/currency';
import { Category, Provider } from '../../src/types';

export default function Home() {
  const router = useRouter();
  const { user } = useAuth();

  const [categories, setCategories] = useState<Category[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const [providerList, categoryList] = await Promise.all([
        providerService.getProvidersWithServices(),
        providerService.getCategories(),
      ]);
      setProviders(providerList);
      setCategories(categoryList);
    } catch (err: any) {
      console.error('[home] failed to load data', err);
      setError(err?.friendlyMessage || 'Could not load providers. Pull down to retry.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

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

  const renderCategoryCard = ({ item }: { item: Category }) => (
    <TouchableOpacity
      style={styles.categoryCard}
      onPress={() => goToCategory(item.name)}
      accessibilityRole="button"
      accessibilityLabel={item.name}
    >
      <View style={styles.categoryIcon}>
        <Ionicons name={item.icon as any} size={28} color={Colors.primary} />
      </View>
      <Text style={styles.categoryName} numberOfLines={1}>
        {item.name}
      </Text>
    </TouchableOpacity>
  );

  const renderProviderCard = (item: Provider) => (
    <TouchableOpacity
      key={item.id}
      style={styles.providerCard}
      onPress={() => goToProvider(item.id)}
      accessibilityRole="button"
      accessibilityLabel={item.business_name}
    >
      <View style={styles.providerImage}>
        {item.avatar ? (
          <Image
            source={{ uri: item.avatar }}
            style={styles.providerImagePhoto}
            contentFit="cover"
            transition={150}
          />
        ) : (
          <Ionicons name="person" size={32} color={Colors.primary} />
        )}
      </View>
      <View style={styles.providerInfo}>
        <Text style={styles.providerName} numberOfLines={1}>
          {item.business_name}
        </Text>
        <Text style={styles.providerCategory} numberOfLines={1}>
          {typeof item.category === 'string' ? item.category : item.location}
        </Text>
        <View style={styles.providerMeta}>
          <View style={styles.rating}>
            <Ionicons name="star" size={14} color={Colors.warning} />
            <Text style={styles.ratingText}>{item.rating ? item.rating.toFixed(1) : 'New'}</Text>
            <Text style={styles.reviewsText}>({item.review_count})</Text>
          </View>
          <Text style={styles.price}>{formatPriceRange(item.price_range)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Finding great stylists for you...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.primary}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hello {user?.full_name || 'there'}! 👋</Text>
            <Text style={styles.subGreeting}>Find your perfect style today</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => router.push('/notifications')}
              accessibilityRole="button"
              accessibilityLabel="Notifications"
            >
              <Ionicons name="notifications-outline" size={24} color={Colors.text} />
              <View style={styles.badge} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => router.push('/(tabs)/profile')}
              accessibilityRole="button"
              accessibilityLabel="Profile"
            >
              <Ionicons name="person-circle-outline" size={26} color={Colors.text} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Search Bar */}
        <TouchableOpacity
          style={styles.searchBar}
          onPress={() => router.push('/(tabs)/search')}
          accessibilityRole="button"
          accessibilityLabel="Search services or providers"
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
            <TouchableOpacity
              style={styles.bannerButton}
              onPress={() => router.push('/(tabs)/search')}
              accessibilityRole="button"
              accessibilityLabel="Book Now"
            >
              <Text style={styles.bannerButtonText}>Book Now</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.bannerEmoji}>🎉</Text>
        </LinearGradient>

        {error && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={18} color={Colors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Categories */}
        {categories.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Categories</Text>
              <TouchableOpacity
                onPress={() => router.push('/(tabs)/search')}
                accessibilityRole="button"
                accessibilityLabel="See all categories"
              >
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
        )}

        {/* Featured Providers */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Featured Providers</Text>
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/search')}
              accessibilityRole="button"
              accessibilityLabel="See all featured providers"
            >
              <Text style={styles.seeAll}>See All</Text>
            </TouchableOpacity>
          </View>
          {featuredProviders.length > 0 ? (
            featuredProviders.map(renderProviderCard)
          ) : (
            <Text style={styles.emptyText}>No providers available right now.</Text>
          )}
        </View>

        {/* Popular Providers */}
        {popularProviders.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Popular Near You</Text>
              <TouchableOpacity
                onPress={() => router.push('/(tabs)/search')}
                accessibilityRole="button"
                accessibilityLabel="See all popular providers"
              >
                <Text style={styles.seeAll}>See All</Text>
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
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
  },
  loadingText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  iconButton: {
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
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  errorText: {
    flex: 1,
    fontSize: FontSizes.sm,
    color: Colors.error,
  },
  emptyText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
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