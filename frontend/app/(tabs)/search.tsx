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
import { SERVICE_CATALOG } from '../../src/constants/serviceCatalog';
import { formatPriceRange } from '../../src/utils/currency';
import { Provider, Category } from '../../src/types';
import { useTheme } from '../../src/contexts/ThemeContext';
import { ProfileAvatar, RatingStars, VerifiedBadge, isVerifiedProfile } from '../../src/components/common';
import { peopleService } from '../../src/services/people.service';

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
        peopleService.withProviderRatings(providerList).then(setAllProviders).catch(() => undefined);
      } catch (err: any) {
        console.error('[search] failed to load providers', err);
        setError(err?.friendlyMessage || 'Could not load providers.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filters = useMemo(() => ['All', ...categories.map((c) => c.name)], [categories]);

  // Every slug/name that belongs to each top-level category (category -> services -> sub-services),
  // so "Beauty & Grooming" also matches providers whose primary category is "makeup" or "haircut".
  const categoryTerms = useMemo(() => {
    const map = new Map<string, Set<string>>();
    const norm = (v: any) => String(v ?? '').toLowerCase().trim();
    Object.values(SERVICE_CATALOG).forEach((cat: any) => {
      const terms = new Set<string>([norm(cat.id), norm(cat.name)]);
      Object.values(cat.services || {}).forEach((svc: any) => {
        terms.add(norm(svc.id));
        terms.add(norm(svc.name));
        (svc.subServices || []).forEach((sub: any) => {
          terms.add(norm(sub.id));
          terms.add(norm(sub.name));
        });
      });
      map.set(norm(cat.name), terms);
      map.set(norm(cat.id), terms);
    });
    categories.forEach((c) => {
      const terms = map.get(norm(c.id)) || map.get(norm(c.name)) || new Set<string>();
      terms.add(norm(c.id));
      terms.add(norm(c.name));
      map.set(norm(c.name), terms);
    });
    return map;
  }, [categories]);

  const filteredProviders = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return allProviders.filter((p: any) => {
      const categoryValues = [
        typeof p.category === 'string' ? p.category : p.category?.name || '',
        p.primary_category,
        p.primary_service,
        ...(p.services || []).flatMap((service: any) => [service.category, service.name, service.service_id, service.sub_service_id]),
      ]
        .filter(Boolean)
        .map((value) => String(value).toLowerCase().trim());
      const terms = categoryTerms.get(selectedFilter.toLowerCase().trim());
      const matchesFilter =
        selectedFilter === 'All' ||
        categoryValues.some((v) => v === selectedFilter.toLowerCase().trim() || (terms ? terms.has(v) : false));
      if (!matchesFilter) return false;
      if (!query) return true;
      const haystack = [
        p.business_name,
        typeof p.category === 'string' ? p.category : '',
        p.primary_category,
        p.primary_service,
        p.location,
        ...(p.services || []).map((s: any) => s.name),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [allProviders, selectedFilter, searchQuery, categoryTerms]);

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
          uri={item.avatarUrl || item.profileImage || item.profile_image_url || item.avatar}
          name={item.business_name} 
          size={48}
          type="provider"
        />
      </View>
      <View style={styles.resultInfo}>
        <View style={styles.resultNameRow}>
          <Text style={[styles.resultName, { color: colors.text }]} numberOfLines={1}>{item.business_name}</Text>
          <VerifiedBadge verified={isVerifiedProfile(item)} />
        </View>
        <Text style={[styles.resultCategory, { color: colors.textSecondary }]} numberOfLines={1}>
          {typeof item.category === 'string' ? item.category : item.location}
        </Text>
        <View style={styles.resultMeta}>
          <View style={styles.metaItem}>
            <RatingStars rating={item.rating} count={item.ratingCount ?? item.review_count} size={12} testID={`search-rating-${item.id}`} />
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="location" size={14} color={colors.textSecondary} />
            <Text style={[styles.metaText, { color: colors.textSecondary }]} numberOfLines={1}>
              {item.location}
            </Text>
          </View>
          {!!String(item.price_range ?? '').replace(/[₦$\s]/g, '') && (
            <Text style={[styles.priceText, { color: colors.primary }]}>{formatPriceRange(item.price_range)}</Text>
          )}
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
        style={styles.filtersScroller}
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
    alignItems: 'center',
    gap: Spacing.sm,
  },
  filtersScroller: { flexGrow: 0, flexShrink: 0, height: 56 },
  filterChip: {
    height: 36,
    flexShrink: 0,
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
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
  resultNameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, flexShrink: 1 },
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