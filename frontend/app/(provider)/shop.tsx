import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Image, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Button, Input } from '../../src/components/common';
import { useAuth } from '../../src/contexts/AuthContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { shopService, Product } from '../../src/services/shop.service';
import { Colors, FontSizes, Spacing, BorderRadius } from '../../src/constants/theme';
import { getShopCategoryBySlug, SHOP_CATEGORIES, ShopMainCategorySlug } from '../../src/constants/shopCategories';
import { formatCurrency } from '../../src/utils/currency';

type ShopView = 'marketplace' | 'my-products';

export default function ProviderShop() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  const [view, setView] = useState<ShopView>('marketplace');
  const [myProducts, setMyProducts] = useState<Product[]>([]);
  const [marketplace, setMarketplace] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState({ name: '', description: '', price: '', stock: '', image: '' });
  const [marketplaceSearch, setMarketplaceSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ShopMainCategorySlug | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null);
  const [addingProductId, setAddingProductId] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    if (!user?.auth_id) { setLoading(false); return; }
    try {
      const [mine, approved] = await Promise.all([shopService.getProviderShopProducts(user.auth_id), shopService.getProducts()]);
      setMyProducts(mine); setMarketplace(approved);
    } catch (error: any) { console.error('[provider-shop] failed to load', error); Alert.alert('Could not load shop', error?.friendlyMessage || error?.message || 'Please try again.'); }
    finally { setLoading(false); }
  }, [user?.auth_id]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const openEditor = (product?: Product) => {
    setEditing(product || null);
    setForm({ name: product?.name || '', description: product?.description || '', price: product ? String(product.price) : '', stock: product ? String(product.stock) : '', image: product?.image_urls?.[0] || '' });
    setModalVisible(true);
  };

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== 'granted') { Alert.alert('Permission needed', 'Please allow photo library access to add a product photo.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.7, base64: true });
    const asset = result.assets?.[0];
    if (!result.canceled && asset?.base64) setForm((current) => ({ ...current, image: `data:image/jpeg;base64,${asset.base64}` }));
  };

  const saveProduct = async () => {
    const price = Number(form.price); const stock = Number(form.stock);
    if (!form.name.trim() || !Number.isFinite(price) || price <= 0 || !Number.isInteger(stock) || stock < 0) { Alert.alert('Missing info', 'Enter a product name, valid price, and stock quantity.'); return; }
    setSaving(true);
    try {
      const input = { name: form.name.trim(), description: form.description.trim(), price, stock, image_urls: form.image ? [form.image] : undefined };
      if (editing) await shopService.updateProduct(editing.id, input); else await shopService.createProduct(input);
      setModalVisible(false); await loadData();
    } catch (error: any) { Alert.alert('Error', error?.friendlyMessage || error?.message || 'Could not save this product.'); }
    finally { setSaving(false); }
  };

  const deleteProduct = (product: Product) => Alert.alert('Delete Product', `Remove "${product.name}" from your shop?`, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => { try { await shopService.deleteProduct(product.id); setMyProducts((items) => items.filter((item) => item.id !== product.id)); } catch (error: any) { Alert.alert('Error', error?.friendlyMessage || 'Could not delete this product.'); } } },
  ]);

  const handleAddToShop = async (product: Product) => {
    if (!user?.auth_id) { Alert.alert('Sign in required', 'Please sign in again before adding a product.'); return; }
    setAddingProductId(product.id);
    try {
      const result = await shopService.addProductToProviderShop(product);
      await loadData();
      Alert.alert(result.added ? 'Added to My Shop' : 'Already Added', result.added ? `${product.name} is now in My Products.` : `${product.name} is already in My Products.`);
    } catch (error: any) {
      Alert.alert('Could not add product', error?.friendlyMessage || error?.message || 'Please try again.');
    } finally { setAddingProductId(null); }
  };

  const activeCategory = useMemo(
    () => SHOP_CATEGORIES.find((category) => category.slug === selectedCategory) ?? null,
    [selectedCategory]
  );

  const filteredMarketplace = useMemo(() => {
    const query = marketplaceSearch.trim().toLowerCase();

    return marketplace.filter((product) => {
      const matchesSearch = !query || [product.name, product.description || '']
        .join(' ')
        .toLowerCase()
        .includes(query);
      const productCategory = getShopCategoryBySlug(product.main_category || product.category);
      const matchesCategory = !selectedCategory || productCategory?.slug === selectedCategory;
      const matchesSubcategory = !selectedSubcategory || (
        productCategory?.slug === selectedCategory &&
        product.subcategory?.toLowerCase() === activeCategory?.subcategories
          .find((subcategory) => subcategory.id === selectedSubcategory)?.name.toLowerCase()
      );

      return matchesSearch && matchesCategory && matchesSubcategory;
    });
  }, [activeCategory, marketplace, marketplaceSearch, selectedCategory, selectedSubcategory]);

  const products = view === 'my-products' ? myProducts : filteredMarketplace;
  const myProductIds = useMemo(() => new Set(myProducts.map((product) => product.id)), [myProducts]);
  const hasMarketplaceFilters = Boolean(marketplaceSearch.trim() || selectedCategory || selectedSubcategory);

  const clearMarketplaceFilters = () => {
    setMarketplaceSearch('');
    setSelectedCategory(null);
    setSelectedSubcategory(null);
  };

  const handleCategorySelection = (category: ShopMainCategorySlug | null) => {
    setSelectedCategory(category);
    setSelectedSubcategory(null);
  };

  const renderProductCard = (product: Product) => {
    const alreadyAdded = myProductIds.has(product.id);
    const isMarketplaceListing = Boolean(product.isMarketplaceListing);

    return (
      <TouchableOpacity
        key={product.id}
        style={[styles.card, { backgroundColor: colors.surface }]}
        onPress={() => view === 'my-products' ? (isMarketplaceListing ? undefined : openEditor(product)) : router.push(`/shop/${product.id}`)}
      >
        {product.image_urls?.[0] ? <Image source={{ uri: product.image_urls[0] }} style={styles.image} /> : <View style={[styles.image, styles.imagePlaceholder, { backgroundColor: colors.background }]}><Ionicons name="image-outline" size={22} color={colors.textMuted} /></View>}
        <View style={styles.cardBody}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{product.name}</Text>
          <Text style={[styles.meta, { color: colors.textSecondary }]}>{formatCurrency(product.price)} · {product.stock} in stock</Text>
          {view === 'my-products' && <Text style={[styles.status, { color: isMarketplaceListing ? colors.primary : product.approved ? Colors.success : Colors.warning }]}>{isMarketplaceListing ? 'Marketplace listing' : product.approved ? 'Live' : 'Pending Approval'}</Text>}
        </View>
        {view === 'my-products' ? isMarketplaceListing ? null : <View style={styles.cardActions}><TouchableOpacity onPress={() => openEditor(product)}><Ionicons name="create-outline" size={20} color={colors.primary} /></TouchableOpacity><TouchableOpacity onPress={() => deleteProduct(product)}><Ionicons name="trash-outline" size={20} color={colors.error} /></TouchableOpacity></View> : <TouchableOpacity style={[{ borderWidth: 1, borderRadius: BorderRadius.sm, paddingHorizontal: 8, paddingVertical: 7 }, { borderColor: alreadyAdded ? colors.border : colors.primary }]} onPress={() => handleAddToShop(product)} disabled={alreadyAdded || addingProductId === product.id} accessibilityRole="button" accessibilityLabel={alreadyAdded ? `${product.name} already added` : `Add ${product.name} to My Shop`}><Text style={[{ fontSize: FontSizes.xs, fontWeight: '700' }, { color: alreadyAdded ? colors.textMuted : colors.primary }]}>{addingProductId === product.id ? 'Adding...' : alreadyAdded ? 'Already Added' : 'Add to My Shop'}</Text></TouchableOpacity>}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}><View><Text style={[styles.title, { color: colors.text }]}>Shop</Text><Text style={[styles.subtitle, { color: colors.textSecondary }]}>{view === 'my-products' ? 'Manage your products' : 'Browse the marketplace'}</Text></View><View style={styles.headerActions}>{view === 'my-products' && <TouchableOpacity style={[styles.primaryAction, { backgroundColor: colors.primary }]} onPress={() => openEditor()}><Ionicons name="add" size={18} color="#fff" /><Text style={styles.primaryActionText}>Add Product</Text></TouchableOpacity>}<TouchableOpacity style={[styles.secondaryAction, { borderColor: colors.border }]} onPress={() => router.push('/(provider)/orders')}><Text style={[styles.secondaryActionText, { color: colors.text }]}>Orders</Text></TouchableOpacity></View></View>
      <View style={styles.tabs}>{(['marketplace', 'my-products'] as ShopView[]).map((option) => <TouchableOpacity key={option} style={[styles.tab, { backgroundColor: colors.surface }, view === option && { backgroundColor: colors.primary }]} onPress={() => setView(option)}><Text style={[styles.tabText, { color: colors.textSecondary }, view === option && { color: '#fff' }]}>{option === 'my-products' ? 'My Products' : 'Marketplace'}</Text></TouchableOpacity>)}</View>
      {view === 'marketplace' && (
        <View style={styles.marketplaceControls}>
          <View style={[styles.searchWrap, { backgroundColor: colors.surface }]}>
            <Ionicons name="search-outline" size={18} color={colors.textMuted} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Search marketplace"
              placeholderTextColor={colors.textMuted}
              value={marketplaceSearch}
              onChangeText={setMarketplaceSearch}
            />
            {marketplaceSearch ? (
              <TouchableOpacity onPress={() => setMarketplaceSearch('')} accessibilityRole="button" accessibilityLabel="Clear marketplace search">
                <Ionicons name="close-circle" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            ) : null}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            <TouchableOpacity
              style={[styles.filterChip, { backgroundColor: colors.surface, borderColor: colors.border }, !selectedCategory && { backgroundColor: colors.primary, borderColor: colors.primary }]}
              onPress={() => handleCategorySelection(null)}
            >
              <Text style={[styles.filterChipText, { color: colors.textSecondary }, !selectedCategory && { color: '#fff' }]}>All</Text>
            </TouchableOpacity>
            {SHOP_CATEGORIES.map((category) => (
              <TouchableOpacity
                key={category.slug}
                style={[styles.filterChip, { backgroundColor: colors.surface, borderColor: colors.border }, selectedCategory === category.slug && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                onPress={() => handleCategorySelection(category.slug)}
              >
                <Text style={[styles.filterChipText, { color: colors.textSecondary }, selectedCategory === category.slug && { color: '#fff' }]}>{category.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {activeCategory ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
              <TouchableOpacity
                style={[styles.subcategoryChip, { backgroundColor: colors.background, borderColor: colors.border }, !selectedSubcategory && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                onPress={() => setSelectedSubcategory(null)}
              >
                <Text style={[styles.filterChipText, { color: colors.textSecondary }, !selectedSubcategory && { color: '#fff' }]}>All in {activeCategory.name}</Text>
              </TouchableOpacity>
              {activeCategory.subcategories.map((subcategory) => (
                <TouchableOpacity
                  key={subcategory.id}
                  style={[styles.subcategoryChip, { backgroundColor: colors.background, borderColor: colors.border }, selectedSubcategory === subcategory.id && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                  onPress={() => setSelectedSubcategory(subcategory.id)}
                >
                  <Text style={[styles.filterChipText, { color: colors.textSecondary }, selectedSubcategory === subcategory.id && { color: '#fff' }]}>{subcategory.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : null}
          {hasMarketplaceFilters ? (
            <TouchableOpacity style={styles.clearFilters} onPress={clearMarketplaceFilters} accessibilityRole="button" accessibilityLabel="Clear marketplace filters">
              <Ionicons name="refresh-outline" size={15} color={colors.primary} />
              <Text style={[styles.clearFiltersText, { color: colors.primary }]}>Clear filters</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      )}
      {loading ? <View style={styles.center}><Text style={{ color: colors.textSecondary }}>Loading shop...</Text></View> : products.length === 0 ? <View style={styles.center}><Ionicons name="bag-handle-outline" size={34} color={colors.textMuted} /><Text style={{ color: colors.textSecondary }}>{view === 'my-products' ? 'No products yet.' : hasMarketplaceFilters ? 'No marketplace products match your filters.' : 'No approved products are available.'}</Text></View> : <ScrollView contentContainerStyle={styles.content}>{products.map(renderProductCard)}</ScrollView>}
      <Modal visible={modalVisible} animationType="slide" onRequestClose={() => setModalVisible(false)}><SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}><View style={styles.modalHeader}><TouchableOpacity onPress={() => setModalVisible(false)}><Ionicons name="close" size={24} color={colors.text} /></TouchableOpacity><Text style={[styles.title, { color: colors.text }]}>{editing ? 'Edit Product' : 'Add Product'}</Text><View style={{ width: 24 }} /></View><ScrollView contentContainerStyle={styles.content}><TouchableOpacity style={[styles.imagePicker, { borderColor: colors.border }]} onPress={pickImage}>{form.image ? <Image source={{ uri: form.image }} style={styles.imagePickerPreview} /> : <Ionicons name="camera-outline" size={28} color={colors.primary} />}</TouchableOpacity><Input label="Product Name" value={form.name} onChangeText={(value) => setForm((current) => ({ ...current, name: value }))} /><Input label="Description" value={form.description} onChangeText={(value) => setForm((current) => ({ ...current, description: value }))} multiline /><Input label="Price (NGN)" value={form.price} onChangeText={(value) => setForm((current) => ({ ...current, price: value }))} keyboardType="decimal-pad" /><Input label="Stock Quantity" value={form.stock} onChangeText={(value) => setForm((current) => ({ ...current, stock: value }))} keyboardType="number-pad" /><Button title={editing ? 'Save Changes' : 'Add Product'} onPress={saveProduct} loading={saving} fullWidth size="large" /></ScrollView></SafeAreaView></Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ container: { flex: 1 }, header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.lg }, title: { fontSize: FontSizes.xl, fontWeight: '700' }, subtitle: { fontSize: FontSizes.xs, marginTop: 2 }, headerActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }, primaryAction: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.sm, paddingVertical: 9, borderRadius: BorderRadius.md }, primaryActionText: { color: '#fff', fontWeight: '700', fontSize: FontSizes.xs }, secondaryAction: { borderWidth: 1, paddingHorizontal: Spacing.sm, paddingVertical: 8, borderRadius: BorderRadius.md }, secondaryActionText: { fontWeight: '600', fontSize: FontSizes.xs }, tabs: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.lg, marginBottom: Spacing.md }, tab: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: BorderRadius.md }, tabText: { fontSize: FontSizes.sm, fontWeight: '600' }, marketplaceControls: { marginHorizontal: Spacing.lg, marginBottom: Spacing.sm }, searchWrap: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, borderRadius: BorderRadius.full, paddingHorizontal: Spacing.md, height: 40, marginBottom: Spacing.xs }, searchInput: { flex: 1, fontSize: FontSizes.sm }, filterRow: { gap: Spacing.sm, paddingVertical: 4 }, filterChip: { borderWidth: 1, borderRadius: BorderRadius.full, paddingHorizontal: Spacing.sm, paddingVertical: 7 }, subcategoryChip: { borderWidth: 1, borderRadius: BorderRadius.full, paddingHorizontal: Spacing.sm, paddingVertical: 6 }, filterChipText: { fontSize: FontSizes.xs, fontWeight: '600' }, clearFilters: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4, paddingVertical: 4 }, clearFiltersText: { fontSize: FontSizes.xs, fontWeight: '700' }, content: { padding: Spacing.lg, paddingBottom: Spacing.xl }, card: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.sm, borderRadius: BorderRadius.md, marginBottom: Spacing.sm }, image: { width: 56, height: 56, borderRadius: BorderRadius.sm }, imagePlaceholder: { justifyContent: 'center', alignItems: 'center' }, cardBody: { flex: 1 }, name: { fontSize: FontSizes.sm, fontWeight: '700' }, meta: { fontSize: FontSizes.xs, marginTop: 3 }, status: { fontSize: FontSizes.xs, fontWeight: '700', marginTop: 4 }, cardActions: { flexDirection: 'row', gap: Spacing.sm }, center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.sm }, imagePicker: { height: 120, width: 120, alignSelf: 'center', borderWidth: 1, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.lg }, imagePickerPreview: { width: '100%', height: '100%' }, modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.lg } });

