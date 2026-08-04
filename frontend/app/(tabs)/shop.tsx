import React, { useCallback, useMemo, useState } from 'react';
import {
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
import { useCartStore } from '../../src/store/cartStore';
import { useAuth } from '../../src/contexts/AuthContext';
import { formatCurrency } from '../../src/utils/currency';

/**
 * Shop - Customer product listing (Phase 3A). Real data via
 * shopService.getProducts() (Supabase, approved+in-stock products only).
 */
export default function CustomerShop() {
  const router = useRouter();
  const { isProvider } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ShopMainCategorySlug | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null);
  const cartCount = useCartStore((s) => s.lines.reduce((n, l) => n + l.quantity, 0));

  const loadData = useCallback(async () => {
    try {
      const list = await shopService.getProducts();
      setProducts(list);
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

  const activeCategory = useMemo(() => SHOP_CATEGORIES.find((category) => category.slug === selectedCategory) ?? null, [selectedCategory]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return products.filter((product) => {
      const matchesQuery = !query || product.name.toLowerCase().includes(query);
      const productCategorySlug = getShopCategoryBySlug(product.main_category || product.category || '')?.slug ?? null;
      const matchesCategory = !selectedCategory || productCategorySlug === selectedCategory;
      const productSubcategory = product.subcategory || null;
      const matchesSubcategory = !selectedSubcategory || !!activeCategory?.subcategories.find((subcategory) => subcategory.name === productSubcategory || subcategory.id === productSubcategory);
      return matchesQuery && matchesCategory && matchesSubcategory;
    });
  }, [activeCategory?.subcategories, products, search, selectedCategory, selectedSubcategory]);

  const handleCategorySelection = (categorySlug: ShopMainCategorySlug | null) => {
    setSelectedCategory(categorySlug);
    setSelectedSubcategory(null);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Shop</Text>
        <View style={styles.headerActions}>
          {isProvider && (
            <TouchableOpacity
              style={styles.manageButton}
              onPress={() => router.push('/(provider)/shop')}
              accessibilityRole="button"
              accessibilityLabel="Manage products"
            >
              <Ionicons name="settings-outline" size={20} color={Colors.text} />
              <Text style={styles.manageButtonText}>Manage</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => router.push('/shop/cart')} accessibilityRole="button" accessibilityLabel="Cart">
            <View>
              <Ionicons name="cart-outline" size={26} color={Colors.text} />
              {cartCount > 0 && (
                <View style={styles.cartBadge}>
                  <Text style={styles.cartBadgeText}>{cartCount}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={18} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search products"
          placeholderTextColor={Colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <View style={styles.categorySection}>
        <Text style={styles.sectionTitle}>Browse by category</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          <TouchableOpacity style={[styles.chip, !selectedCategory && styles.chipActive]} onPress={() => handleCategorySelection(null)}>
            <Text style={[styles.chipText, !selectedCategory && styles.chipTextActive]}>All</Text>
          </TouchableOpacity>
          {SHOP_CATEGORIES.map((category) => (
            <TouchableOpacity
              key={category.slug}
              style={[styles.chip, selectedCategory === category.slug && styles.chipActive]}
              onPress={() => handleCategorySelection(category.slug)}
            >
              <Text style={[styles.chipText, selectedCategory === category.slug && styles.chipTextActive]}>{category.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        {activeCategory ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            <TouchableOpacity style={[styles.subchip, !selectedSubcategory && styles.subchipActive]} onPress={() => setSelectedSubcategory(null)}>
              <Text style={[styles.subchipText, !selectedSubcategory && styles.subchipTextActive]}>All in {activeCategory.name}</Text>
            </TouchableOpacity>
            {activeCategory.subcategories.map((subcategory) => (
              <TouchableOpacity
                key={subcategory.id}
                style={[styles.subchip, selectedSubcategory === subcategory.id && styles.subchipActive]}
                onPress={() => setSelectedSubcategory(subcategory.id)}
              >
                <Text style={[styles.subchipText, selectedSubcategory === subcategory.id && styles.subchipTextActive]}>{subcategory.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.centerState}>
          <Ionicons name="bag-handle-outline" size={32} color={Colors.textMuted} />
          <Text style={styles.emptyText}>
            {products.length === 0 ? 'No products available yet.' : 'No products match your current filters.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          numColumns={2}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={{ gap: Spacing.sm }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={Colors.primary} />}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={() => router.push(`/shop/${item.id}`)} accessibilityRole="button" accessibilityLabel={item.name}>
              {item.image_urls?.[0] ? (
                <Image source={{ uri: item.image_urls[0] }} style={styles.cardImage} />
              ) : (
                <View style={[styles.cardImage, styles.cardImagePlaceholder]}>
                  <Ionicons name="image-outline" size={28} color={Colors.textMuted} />
                </View>
              )}
              <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.cardPrice}>{formatCurrency(item.price)}</Text>
              {item.main_category || item.category ? (
                <Text style={styles.cardMeta} numberOfLines={1}>{item.subcategory || item.main_category || item.category}</Text>
              ) : null}
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  title: { fontSize: FontSizes.xl, fontWeight: 'bold', color: Colors.text },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  manageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  manageButtonText: { fontSize: FontSizes.xs, fontWeight: '600', color: Colors.text },
  cartBadge: { position: 'absolute', top: -6, right: -8, backgroundColor: Colors.primary, borderRadius: 8, minWidth: 16, height: 16, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3 },
  cartBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.surface, borderRadius: BorderRadius.full, paddingHorizontal: Spacing.md, marginHorizontal: Spacing.lg, marginTop: Spacing.md, marginBottom: Spacing.sm, height: 44 },
  searchInput: { flex: 1, fontSize: FontSizes.sm, color: Colors.text },
  categorySection: { marginHorizontal: Spacing.lg, marginBottom: Spacing.sm },
  sectionTitle: { fontSize: FontSizes.sm, fontWeight: '700', color: Colors.text, marginBottom: Spacing.xs },
  chipRow: { flexDirection: 'row', gap: Spacing.sm, paddingVertical: 4 },
  chip: { paddingHorizontal: Spacing.md, paddingVertical: 8, borderRadius: BorderRadius.full, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: FontSizes.xs, color: Colors.textSecondary, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  subchip: { paddingHorizontal: Spacing.sm, paddingVertical: 7, borderRadius: BorderRadius.full, backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border },
  subchipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  subchipText: { fontSize: 11, color: Colors.textSecondary, fontWeight: '600' },
  subchipTextActive: { color: '#fff' },
  centerState: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.xl },
  emptyText: { fontSize: FontSizes.sm, color: Colors.textSecondary, textAlign: 'center' },
  grid: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl, gap: Spacing.sm },
  card: { flex: 1, backgroundColor: Colors.surface, borderRadius: BorderRadius.md, padding: Spacing.sm, marginBottom: Spacing.sm },
  cardImage: { width: '100%', height: 120, borderRadius: BorderRadius.sm, marginBottom: Spacing.sm },
  cardImagePlaceholder: { backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' },
  cardName: { fontSize: FontSizes.sm, fontWeight: '600', color: Colors.text },
  cardPrice: { fontSize: FontSizes.sm, fontWeight: '700', color: Colors.primary, marginTop: 2 },
  cardMeta: { fontSize: FontSizes.xs, color: Colors.textSecondary, marginTop: 4 },
});
