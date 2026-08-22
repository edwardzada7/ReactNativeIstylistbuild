import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors, FontSizes, Spacing, BorderRadius } from '../../src/constants/theme';
import { providerService } from '../../src/services/provider.service';
import { formatPriceRange } from '../../src/utils/currency';
import { Provider, Category } from '../../src/types';
import { formatRating } from '../../src/utils/display';
import { useTheme } from '../../src/contexts/ThemeContext';
import { ProfileAvatar } from '../../src/components/common';

const PAGE_SIZE = 10;

export default function Search() {
  const router = useRouter();
  const params = useLocalSearchParams<{ category?: string }>();
  const { colors } = useTheme();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [categories, setCategories] = useState<Category[]>([]);
  const [allProviders, setAllProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    if (params.category) setSelectedFilter(params.category);
  }, [params.category]);

  useEffect(() => {
    (async () => {
      try {
        setError(null);
        const [providerList, categoryList] = await Promise.all([
          providerService.getProvidersWithServices(),
          providerService.getCategories(),
        ]);
        setAllProviders(providerList);
        setCategories(categoryList);
      } catch (err: any) {
        console.error('[search] failed to load providers', err);
        setError(err?.friendlyMessage || 'Could not load providers.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filters = useMemo(() => ['All', ...categories.map((c) => c.name)], [categories]);

  const filteredProviders = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return allProviders.filter((p) => {
      const matchesFilter =
        selectedFilter === 'All' ||
        (typeof p.category === 'string' &&
          p.category.toLowerCase() === selectedFilter.toLowerCase()) ||
        p.services.some(
          (s) => (s.category || '').toLowerCase() === selectedFilter.toLowerCase()
        );
      if (!matchesFilter) return false;
      if (!query) return true;
      const haystack = [
        p.business_name,
        typeof p.category === 'string' ? p.category : '',
        p.location,
        ...p.services.map((s) => s.name),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [allProviders, selectedFilter, searchQuery]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [selectedFilter, searchQuery]);

  const visibleProviders = filteredProviders.slice(0, visibleCount);
  const hasMore = visibleCount < filteredProviders.length;

  const renderFilterChip = (filter: string) => (
    <TouchableOpacity
      key={filter}
      style={[
        styles.filterChip,
        { backgroundColor: colors.surface, borderColor: colors.border },
        selectedFilter === filter && { backgroundColor: colors.primary, borderColor: colors.primary },
      ]}
      onPress={() => setSelectedFilter(filter)}
      accessibilityRole="button"
      accessibilityLabel={filter}
    >
      <Text
        style={[
          styles.filterText,
          { color: colors.text },
          selectedFilter === filter && { color: colors.text },
        ]}
      >
        {filter}
      </Text>
    </TouchableOpacity>
  );

  const renderResultCard = ({ item }: { item: Provider }) => (
    <TouchableOpacity
      style={[styles.resultCard, { backgroundColor: colors.surface }]}
      onPress={() => router.push(`/provider/${item.id}`)}
      accessibilityRole="button"
      accessibilityLabel={item.business_name}
    >
      <View style={styles.resultPhotoContainer}>
        <ProfileAvatar 
          uri={item.profile_image_url || item.avatar} 
          name={item.business_name} 
          size={48}
          type="provider"
        />
      </View>
      <View style={styles.resultInfo}>
        <Text style={[styles.resultName, { color: colors.text }]} numberOfLines={1}>
          {item.business_name}
        </Text>
        <Text style={[styles.resultCategory, { color: colors.textSecondary }]} numberOfLines={1}>
          {typeof item.category === 'string' ? item.category : item.location}
        </Text>
        <View style={styles.resultMeta}>
          <View style={styles.metaItem}>
            <Ionicons name="star" size={14} color={colors.warning} />
            <Text style={[styles.metaText, { color: colors.textSecondary }]}>{formatRating(item.rating)}</Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="location" size={14} color={colors.textSecondary} />
            <Text style={[styles.metaText, { color: colors.textSecondary }]} numberOfLines={1}>
              {item.location}
            </Text>
          </View>
          <Text style={[styles.priceText, { color: colors.primary }]}>{formatPriceRange(item.price_range)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Search</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <View style={[styles.searchBar, { backgroundColor: colors.surface }]}>
          <Ionicons name="search" size={20} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search services or providers..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
            >
              <Ionicons name="close-circle" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filtersContainer}
      >
        {filters.map(renderFilterChip)}
      </ScrollView>

      {/* Results */}
      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.centerState}>
          <Ionicons name="alert-circle-outline" size={32} color={colors.error} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{error}</Text>
        </View>
      ) : visibleProviders.length === 0 ? (
        <View style={styles.centerState}>
          <Ionicons name="search-outline" size={32} color={colors.textMuted} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No providers found. Try a different search.</Text>
        </View>
      ) : (
        <FlashList
          data={visibleProviders}
          renderItem={renderResultCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.resultsList}
          showsVerticalScrollIndicator={false}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (hasMore) setVisibleCount((c) => c + PAGE_SIZE);
          }}
          ListFooterComponent={
            hasMore ? (
              <ActivityIndicator style={{ marginVertical: Spacing.md }} color={colors.primary} />
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  title: {
    fontSize: FontSizes.xxl,
    fontWeight: 'bold',
  },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSizes.md,
    paddingVertical: Spacing.sm,
  },
  filtersContainer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
  },
  filterChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  filterText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  centerState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  emptyText: {
    fontSize: FontSizes.sm,
    textAlign: 'center',
  },
  resultsList: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  resultCard: {
    flexDirection: 'row',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  resultPhotoContainer: {
    marginRight: Spacing.md,
  },
  resultInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  resultName: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    marginBottom: 4,
  },
  resultCategory: {
    fontSize: FontSizes.sm,
    marginBottom: Spacing.sm,
  },
  resultMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 1,
  },
  metaText: {
    fontSize: FontSizes.xs,
  },
  priceText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    marginLeft: 'auto',
  },
});