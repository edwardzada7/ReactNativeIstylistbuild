import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
  TextInput,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { Colors, FontSizes, Spacing, BorderRadius } from '../../src/constants/theme';
import { SHOP_CATEGORIES, ShopMainCategorySlug } from '../../src/constants/shopCategories';
import { getShopCategoryBySlug } from '../../src/constants/shopCategories';
import { shopService, Product } from '../../src/services/shop.service';
import { providerService } from '../../src/services/provider.service';
import { useCartStore } from '../../src/store/cartStore';
import { useAuth } from '../../src/contexts/AuthContext';
import { formatCurrency } from '../../src/utils/currency';
import { useTheme } from '../../src/contexts/ThemeContext';
import { ReportModal } from '../../src/components/common';

interface SharedShopScreenProps {
  showManageButton?: boolean;
}

export function SharedShopScreen({ showManageButton = false }: SharedShopScreenProps) {
  const router = useRouter();
  const { isProvider } = useAuth();
  const { colors } = useTheme();
  const [products, setProducts] = useState<Product[]>([]);
  const [providerNames, setProviderNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ShopMainCategorySlug | null>('beauty');
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null);
  const [reportTargetId, setReportTargetId] = useState<number | null>(null);
  const cartCount = useCartStore((s) => s.lines.reduce((n, l) => n + l.quantity, 0));
  const addItem = useCartStore((s) => s.addItem);

  const loadData = useCallback(async () => {
    try {
      const [list, providerList] = await Promise.all([
        shopService.getProducts(),
        providerService.getProvidersWithServices().catch(() => []),
      ]);
      setProducts(list);
      setProviderNames(
        Object.fromEntries(
          providerList.flatMap((provider) => {
            const name = provider.business_name || provider.businessName;
            return name ? [[provider.user_id, name], [provider.id, name]] : [];
          })
        )
      );
    } catch (err) {
      console.error('[shop] failed to load products', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const activeCategory = useMemo(
    () => SHOP_CATEGORIES.find((category) => category.slug === selectedCategory) ?? null,
    [selectedCategory]
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return products.filter((product) => {
      const matchesQuery = !query || product.name.toLowerCase().includes(query);
      const productCategorySlug = getShopCategoryBySlug(product.main_category || product.category || '')?.slug ?? null;
      const matchesCategory = !selectedCategory || productCategorySlug === selectedCategory;
      const productSubcategory = product.subcategory || null;
      const matchesSubcategory =
        !selectedSubcategory ||
        activeCategory?.subcategories.some(
          (subcategory) => subcategory.name === productSubcategory || subcategory.id === productSubcategory
        ) ||
        false;
      return matchesQuery && matchesCategory && matchesSubcategory;
    });
  }, [activeCategory?.subcategories, products, search, selectedCategory, selectedSubcategory]);

  const handleCategorySelection = (categorySlug: ShopMainCategorySlug | null) => {
    setSelectedCategory(categorySlug);
    setSelectedSubcategory(null);
  };

  const hasActiveFilters = Boolean(search.trim() || selectedCategory || selectedSubcategory);
  const resultsLabel = `${filtered.length} ${filtered.length === 1 ? 'Product' : 'Products'}`;

  const resetFilters = () => {
    setSearch('');
    setSelectedCategory('beauty');
    setSelectedSubcategory(null);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.titleWrap}>
          <Text style={[styles.title, { color: colors.text }]}>Shop</Text>
        </View>
        <View style={styles.headerActions}>
          {(showManageButton || isProvider) && (
            <TouchableOpacity
              style={[styles.manageButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => router.push('/(provider)/shop')}
              accessibilityRole="button"
              accessibilityLabel="Manage products"
            >
              <Ionicons name="settings-outline" size={20} color={colors.text} />
              <Text style={[styles.manageButtonText, { color: colors.text }]}>Manage</Text>
            </TouchableOpacity>
          )}
          {!isProvider && (
            <TouchableOpacity onPress={() => router.push('/shop/cart')} accessibilityRole="button" accessibilityLabel="Cart">
              <View>
                <Ionicons name="cart-outline" size={26} color={colors.text} />
                {cartCount > 0 && (
                  <View style={[styles.cartBadge, { backgroundColor: colors.primary }]}>
                    <Text style={styles.cartBadgeText}>{cartCount}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={[styles.searchWrap, { backgroundColor: colors.surface }]}>
        <Ionicons name="search-outline" size={18} color={colors.textMuted} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search products"
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <View style={styles.categorySection}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Explore by category</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cardRow}>
          <TouchableOpacity
            style={[
              styles.categoryCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
              !selectedCategory && { backgroundColor: colors.primary, borderColor: colors.primary },
            ]}
            onPress={() => handleCategorySelection(null)}
          >
            <Text style={styles.categoryCardIcon}>🛍</Text>
            <Text style={[styles.categoryCardText, { color: colors.text }, !selectedCategory && { color: '#fff' }]}>All</Text>
          </TouchableOpacity>
          {SHOP_CATEGORIES.map((category) => (
            <TouchableOpacity
              key={category.slug}
              style={[
                styles.categoryCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
                selectedCategory === category.slug && { backgroundColor: colors.primary, borderColor: colors.primary },
              ]}
              onPress={() => handleCategorySelection(category.slug)}
            >
              <Text style={styles.categoryCardIcon}>{category.icon}</Text>
              <Text style={[styles.categoryCardText, { color: colors.text }, selectedCategory === category.slug && { color: '#fff' }]}>{category.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        {activeCategory ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            <TouchableOpacity
              style={[
                styles.subchip,
                { backgroundColor: colors.background, borderColor: colors.border },
                !selectedSubcategory && { backgroundColor: colors.primary, borderColor: colors.primary },
              ]}
              onPress={() => setSelectedSubcategory(null)}
            >
              <Text style={[styles.subchipText, { color: colors.textSecondary }, !selectedSubcategory && { color: '#fff' }]}>All in {activeCategory.name}</Text>
            </TouchableOpacity>
            {activeCategory.subcategories.map((subcategory) => (
              <TouchableOpacity
                key={subcategory.id}
                style={[
                  styles.subchip,
                  { backgroundColor: colors.background, borderColor: colors.border },
                  selectedSubcategory === subcategory.id && { backgroundColor: colors.primary, borderColor: colors.primary },
                ]}
                onPress={() => setSelectedSubcategory(subcategory.id)}
              >
                <Text style={[styles.subchipText, { color: colors.textSecondary }, selectedSubcategory === subcategory.id && { color: '#fff' }]}>{subcategory.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.centerState}>
          <View style={[styles.emptyStateCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="sparkles-outline" size={34} color={colors.primary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No products found</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {products.length === 0 ? 'No products are available yet.' : 'Try adjusting your category, subcategory, or search terms.'}
            </Text>
            {hasActiveFilters ? (
              <TouchableOpacity style={[styles.clearButton, { backgroundColor: colors.primary }]} onPress={resetFilters}>
                <Text style={styles.clearButtonText}>Clear Filters</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      ) : (
        <>
          <View style={styles.resultsBar}>
            <Text style={[styles.resultsText, { color: colors.text }]}>{resultsLabel}</Text>
            <Text style={[styles.resultsHint, { color: colors.textSecondary }]}>Updated as you browse</Text>
          </View>
          <FlatList
            data={filtered}
            keyExtractor={(item) => String(item.id)}
            numColumns={2}
            contentContainerStyle={styles.grid}
            columnWrapperStyle={{ gap: Spacing.sm }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={colors.primary} />}
            renderItem={({ item }) => (
              <View style={[styles.card, { backgroundColor: colors.surface }]}>
                <TouchableOpacity
                  onPress={() => router.push(`/shop/${item.id}`)}
                  accessibilityRole="button"
                  accessibilityLabel={item.name}
                >
                {item.image_urls?.[0] ? (
                  <Image source={{ uri: item.image_urls[0] }} style={styles.cardImage} />
                ) : (
                  <View style={[styles.cardImage, styles.cardImagePlaceholder, { backgroundColor: colors.background }]}>
                    <Ionicons name="image-outline" size={28} color={colors.textMuted} />
                  </View>
                )}
                <Text style={[styles.cardName, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
                <Text style={[styles.cardPrice, { color: colors.primary }]}>{formatCurrency(item.price)}</Text>
                <Text style={[styles.cardProvider, { color: colors.textSecondary }]} numberOfLines={1}>
                  {providerNames[item.stylist_auth_id] || 'iStylist Provider'}
                </Text>
                {item.main_category || item.category ? (
                  <Text style={[styles.cardMeta, { color: colors.textSecondary }]} numberOfLines={1}>
                    {item.subcategory || item.main_category || item.category}
                  </Text>
                ) : null}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.addButton, { backgroundColor: colors.primary }]}
                  onPress={() => addItem({
                    productId: item.id,
                    name: item.name,
                    price: item.price,
                    image: item.image_urls?.[0] || null,
                    stylistAuthId: item.stylist_auth_id,
                  })}
                  accessibilityRole="button"
                  accessibilityLabel={`Add ${item.name} to cart`}
                >
                  <Ionicons name="cart-outline" size={16} color="#fff" />
                  <Text style={styles.addButtonText}>Add to Cart</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.reportButton}
                  onPress={() => setReportTargetId(item.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Report ${item.name}`}
                >
                  <Ionicons name="flag-outline" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            )}
          />
        </>
      )}
      <ReportModal
        visible={reportTargetId !== null}
        targetId={reportTargetId}
        targetType="PRODUCT"
        onClose={() => setReportTargetId(null)}
        onSubmitted={() => Alert.alert('Report submitted', 'Thank you. We will review this product.')}
      />
    </SafeAreaView>
  );
}

export default function CustomerShop() {
  const { isProvider } = useAuth();
  return <SharedShopScreen showManageButton={isProvider} />;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  titleWrap: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  title: { fontSize: FontSizes.xl, fontWeight: 'bold' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  manageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  manageButtonText: { fontSize: FontSizes.xs, fontWeight: '600' },
  cartBadge: { position: 'absolute', top: -6, right: -8, borderRadius: 8, minWidth: 16, height: 16, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3 },
  cartBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  reportButton: { position: 'absolute', top: Spacing.sm, right: Spacing.sm, padding: 4 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, borderRadius: BorderRadius.full, paddingHorizontal: Spacing.md, marginHorizontal: Spacing.lg, marginTop: Spacing.md, marginBottom: Spacing.sm, height: 44 },
  searchInput: { flex: 1, fontSize: FontSizes.sm },
  categorySection: { marginHorizontal: Spacing.lg, marginBottom: Spacing.sm },
  sectionTitle: { fontSize: FontSizes.sm, fontWeight: '700', marginBottom: Spacing.xs },
  cardRow: { flexDirection: 'row', gap: Spacing.sm, paddingVertical: 4 },
  categoryCard: { minHeight: 38, borderRadius: BorderRadius.full, paddingHorizontal: Spacing.md, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1 },
  categoryCardIcon: { fontSize: 16 },
  categoryCardText: { fontSize: FontSizes.xs, fontWeight: '700' },
  chipRow: { flexDirection: 'row', gap: Spacing.sm, paddingVertical: 4 },
  subchip: { paddingHorizontal: Spacing.sm, paddingVertical: 7, borderRadius: BorderRadius.full, borderWidth: 1 },
  subchipText: { fontSize: 11, fontWeight: '600' },
  resultsBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: Spacing.lg, marginBottom: Spacing.sm },
  resultsText: { fontSize: FontSizes.sm, fontWeight: '700' },
  resultsHint: { fontSize: FontSizes.xs },
  centerState: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.xl },
  emptyStateCard: { width: '100%', alignItems: 'center', justifyContent: 'center', borderRadius: BorderRadius.xl, padding: Spacing.xl, borderWidth: 1 },
  emptyTitle: { fontSize: FontSizes.lg, fontWeight: '700', marginTop: Spacing.sm },
  emptyText: { fontSize: FontSizes.sm, textAlign: 'center', marginTop: Spacing.xs },
  clearButton: { marginTop: Spacing.md, paddingHorizontal: Spacing.md, paddingVertical: 10, borderRadius: BorderRadius.full },
  clearButtonText: { color: '#fff', fontSize: FontSizes.sm, fontWeight: '700' },
  grid: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl, gap: Spacing.sm },
  card: { flex: 1, borderRadius: BorderRadius.md, padding: Spacing.sm, marginBottom: Spacing.sm },
  cardImage: { width: '100%', height: 150, borderRadius: BorderRadius.md },
  cardImagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  cardName: { fontSize: FontSizes.sm, fontWeight: '700', marginTop: Spacing.sm },
  cardPrice: { fontSize: FontSizes.sm, fontWeight: '700', marginTop: 4 },
  cardProvider: { fontSize: FontSizes.xs, marginTop: 4 },
  cardMeta: { fontSize: FontSizes.xs, marginTop: 4 },
  addButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: Spacing.sm, paddingVertical: 9, borderRadius: BorderRadius.md },
  addButtonText: { color: '#fff', fontSize: FontSizes.xs, fontWeight: '700' },
});
