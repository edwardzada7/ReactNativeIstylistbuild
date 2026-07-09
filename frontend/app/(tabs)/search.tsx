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
import { Image } from 'expo-image';
import { Colors, FontSizes, Spacing, BorderRadius } from '../../src/constants/theme';
import { providerService } from '../../src/services/provider.service';
import { formatPriceRange } from '../../src/utils/currency';
import { Provider, Category } from '../../src/types';
import { getErrorMessage } from '../../src/utils/errors';

const PAGE_SIZE = 10;

export default function Search() {
  const router = useRouter();
  const params = useLocalSearchParams<{ category?: string }>();

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
        setError(getErrorMessage(err, 'Could not load providers.'));
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
        selectedFilter === filter && styles.filterChipActive,
      ]}
      onPress={() => setSelectedFilter(filter)}
      accessibilityRole="button"
      accessibilityLabel={filter}
    >
      <Text
        style={[
          styles.filterText,
          selectedFilter === filter && styles.filterTextActive,
        ]}
      >
        {filter}
      </Text>
    </TouchableOpacity>
  );

  const renderResultCard = ({ item }: { item: Provider }) => (
    <TouchableOpacity
      style={styles.resultCard}
      onPress={() => router.push(`/provider/${item.id}`)}
      accessibilityRole="button"
      accessibilityLabel={item.business_name}
    >
      <View style={styles.resultIcon}>
        {item.avatar ? (
          <Image source={{ uri: item.avatar }} style={styles.resultPhoto} contentFit="cover" />
        ) : (
          <Ionicons name="storefront" size={32} color={Colors.primary} />
        )}
      </View>
      <View style={styles.resultInfo}>
        <Text style={styles.resultName} numberOfLines={1}>
          {item.business_name}
        </Text>
        <Text style={styles.resultCategory} numberOfLines={1}>
          {typeof item.category === 'string' ? item.category : item.location}
        </Text>
        <View style={styles.resultMeta}>
          <View style={styles.metaItem}>
            <Ionicons name="star" size={14} color={Colors.warning} />
            <Text style={styles.metaText}>{item.rating ? item.rating.toFixed(1) : 'New'}</Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="location" size={14} color={Colors.textSecondary} />
            <Text style={styles.metaText} numberOfLines={1}>
              {item.location}
            </Text>
          </View>
          <Text style={styles.priceText}>{formatPriceRange(item.price_range)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Search</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search services or providers..."
            placeholderTextColor={Colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
            >
              <Ionicons name="close-circle" size={20} color={Colors.textMuted} />
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
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.centerState}>
          <Ionicons name="alert-circle-outline" size={32} color={Colors.error} />
          <Text style={styles.emptyText}>{error}</Text>
        </View>
      ) : visibleProviders.length === 0 ? (
        <View style={styles.centerState}>
          <Ionicons name="search-outline" size={32} color={Colors.textMuted} />
          <Text style={styles.emptyText}>No providers found. Try a different search.</Text>
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
              <ActivityIndicator style={{ marginVertical: Spacing.md }} color={Colors.primary} />
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
    backgroundColor: Colors.background,
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
    color: Colors.text,
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
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSizes.md,
    color: Colors.text,
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
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterText: {
    fontSize: FontSizes.sm,
    color: Colors.text,
    fontWeight: '600',
  },
  filterTextActive: {
    color: Colors.text,
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
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  resultsList: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  resultCard: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  resultIcon: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
    overflow: 'hidden',
  },
  resultPhoto: {
    width: '100%',
    height: '100%',
  },
  resultInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  resultName: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  resultCategory: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
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
    color: Colors.textSecondary,
  },
  priceText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.primary,
    marginLeft: 'auto',
  },
});