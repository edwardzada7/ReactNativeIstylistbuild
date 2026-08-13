import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Colors, FontSizes, Spacing, BorderRadius } from '../../src/constants/theme';
import { SHOP_CATEGORIES } from '../../src/constants/shopCategories';
import { Button, Input } from '../../src/components/common';
import { useAuth } from '../../src/contexts/AuthContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { shopService, Product } from '../../src/services/shop.service';
import { formatCurrency } from '../../src/utils/currency';

type ShopView = 'my-products' | 'marketplace';

export default function ProviderShop() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  const authId = user?.auth_id;

  const [view, setView] = useState<ShopView>('marketplace');
  const [myProducts, setMyProducts] = useState<Product[]>([]);
  const [marketplaceProducts, setMarketplaceProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    price: '',
    stock: '',
    image: '' as string,
    mainCategory: 'beauty',
    subcategory: 'hair-care',
  });

  const loadData = useCallback(async () => {
    if (!authId) return;
    try {
      const [providerProducts, approvedProducts] = await Promise.all([
        shopService.getProviderProducts(authId).catch(() => []),
        shopService.getProducts().catch(() => []),
      ]);
      setMyProducts(providerProducts);
      setMarketplaceProducts(approvedProducts);
    } catch (err) {
      console.error('[provider-shop] failed to load', err);
    } finally {
      setLoading(false);
    }
  }, [authId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const resetForm = () => {
    setForm({ name: '', description: '', price: '', stock: '', image: '', mainCategory: 'beauty', subcategory: 'hair-care' });
    setEditingProduct(null);
  };

  const openEditModal = (product: Product) => {
    const productCategory = SHOP_CATEGORIES.find((category) => category.name === product.main_category || category.name === product.category);
    const fallbackCategory = productCategory ?? SHOP_CATEGORIES[0];
    const fallbackSubcategory = fallbackCategory.subcategories.find((subcategory) => subcategory.name === product.subcategory) ?? fallbackCategory.subcategories[0];
    setEditingProduct(product);
    setForm({
      name: product.name,
      description: product.description || '',
      price: String(product.price),
      stock: String(product.stock),
      image: product.image_urls?.[0] || '',
      mainCategory: fallbackCategory?.slug || 'beauty',
      subcategory: fallbackSubcategory?.id || 'hair-care',
    });
    setModalVisible(true);
  };

  const selectedCategory = useMemo(() => SHOP_CATEGORIES.find((category) => category.slug === form.mainCategory) ?? SHOP_CATEGORIES[0], [form.mainCategory]);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo library access to add a product photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.5,
      base64: true,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled || !result.assets?.[0]?.base64) return;
    setForm((f) => ({ ...f, image: `data:image/jpeg;base64,${result.assets![0].base64}` }));
  };

  const handleCreate = async () => {
    const price = parseFloat(form.price);
    const stock = parseInt(form.stock, 10);
    if (!form.name.trim() || isNaN(price) || price <= 0 || isNaN(stock) || stock < 0) {
      Alert.alert('Missing info', 'Please enter a valid name, price, and stock quantity.');
      return;
    }
    setSaving(true);
    try {
      const selectedSubcategory = selectedCategory.subcategories.find((subcategory) => subcategory.id === form.subcategory) ?? selectedCategory.subcategories[0];
      const productData = {
        name: form.name.trim(),
        description: form.description.trim(),
        price,
        stock,
        image_urls: form.image ? [form.image] : undefined,
        main_category: selectedCategory.name,
        subcategory: selectedSubcategory?.name,
      };

      if (editingProduct) {
        await shopService.updateProduct(editingProduct.id, productData);
        Alert.alert('Product Updated', 'Your product was updated successfully.');
      } else {
        await shopService.createProduct(productData);
        Alert.alert('Product Added', 'Your product was added and is pending approval.');
      }
      setModalVisible(false);
      resetForm();
      await loadData();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not save this product.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (product: Product) => {
    Alert.alert('Delete Product', `Remove "${product.name}" from your shop?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await shopService.deleteProduct(product.id);
            setMyProducts((prev) => prev.filter((p) => p.id !== product.id));
          } catch (err) {
            Alert.alert('Error', 'Could not delete this product.');
          }
        },
      },
    ]);
  };

  const shownProducts = view === 'my-products' ? myProducts : marketplaceProducts;
  const emptyMessage = view === 'my-products'
    ? (myProducts.length === 0 ? 'You haven’t added any products yet.' : 'No products match your current selection.')
    : (marketplaceProducts.length === 0 ? 'No approved products are available right now.' : 'No products match your current selection.');

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerTextWrap}>
          <Text style={[styles.title, { color: colors.text }]}>Shop</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{view === 'my-products' ? 'Manage your own products' : 'Browse the marketplace'}</Text>
        </View>
        <View style={styles.headerActions}>
          {view === 'my-products' ? (
            <TouchableOpacity style={[styles.addBtn, { backgroundColor: Colors.primary }]} onPress={() => setModalVisible(true)} accessibilityRole="button" accessibilityLabel="Add product">
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={styles.addBtnText}>Add Product</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={[styles.ordersBtn, { borderColor: colors.border, backgroundColor: colors.surface }]} onPress={() => router.push('/(provider)/orders')} accessibilityRole="button" accessibilityLabel="My orders">
            <Text style={[styles.ordersBtnText, { color: colors.text }]}>My Orders</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.segmentedControl}>
        <TouchableOpacity
          style={[styles.segmentButton, { backgroundColor: colors.surface }, view === 'marketplace' && { backgroundColor: Colors.primary }]}
          onPress={() => setView('marketplace')}
          accessibilityRole="button"
          accessibilityLabel="Marketplace"
        >
          <Text style={[styles.segmentButtonText, { color: colors.textSecondary }, view === 'marketplace' && { color: '#fff' }]}>Marketplace</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segmentButton, { backgroundColor: colors.surface }, view === 'my-products' && { backgroundColor: Colors.primary }]}
          onPress={() => setView('my-products')}
          accessibilityRole="button"
          accessibilityLabel="My products"
        >
          <Text style={[styles.segmentButtonText, { color: colors.textSecondary }, view === 'my-products' && { color: '#fff' }]}>My Products</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : shownProducts.length === 0 ? (
        <View style={styles.centerState}>
          <Ionicons name="bag-handle-outline" size={32} color={colors.textSecondary} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{emptyMessage}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {shownProducts.map((product) => (
            <TouchableOpacity
              key={product.id}
              style={[styles.card, { backgroundColor: colors.surface }]}
              onPress={() => {
                if (view === 'my-products') {
                  openEditModal(product);
                } else {
                  router.push(`/shop/${product.id}`);
                }
              }}
              accessibilityRole="button"
              accessibilityLabel={product.name}
            >
              {product.image_urls?.[0] ? (
                <Image source={{ uri: product.image_urls[0] }} style={styles.cardImage} />
              ) : (
                <View style={[styles.cardImage, styles.cardImagePlaceholder, { backgroundColor: colors.surfaceLight }]}>
                  <Ionicons name="image-outline" size={22} color={colors.textSecondary} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardName, { color: colors.text }]} numberOfLines={1}>{product.name}</Text>
                <Text style={[styles.cardPrice, { color: colors.textSecondary }]}>{formatCurrency(product.price)} &middot; {product.stock} in stock</Text>
                {product.main_category || product.category ? (
                  <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>{product.subcategory || product.main_category || product.category}</Text>
                ) : null}
                {view === 'my-products' ? (
                  <View style={[styles.badge, { backgroundColor: product.approved ? `${Colors.success}20` : `${Colors.warning}20` }]}>
                    <Text style={[styles.badgeText, { color: product.approved ? Colors.success : Colors.warning }]}>
                      {product.approved ? 'Live' : 'Pending Approval'}
                    </Text>
                  </View>
                ) : null}
              </View>
              {view === 'my-products' ? (
                <View style={styles.cardActions}>
                  <TouchableOpacity onPress={() => openEditModal(product)} accessibilityLabel="Edit product">
                    <Ionicons name="create-outline" size={20} color={Colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDelete(product)} accessibilityLabel="Delete product">
                    <Ionicons name="trash-outline" size={20} color={Colors.error} />
                  </TouchableOpacity>
                </View>
              ) : (
                <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <Modal visible={modalVisible} animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <View style={styles.header}>
              <TouchableOpacity onPress={() => setModalVisible(false)} accessibilityLabel="Close">
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
              <Text style={[styles.title, { color: colors.text }]}>{editingProduct ? 'Edit Product' : 'Add Product'}</Text>
              <View style={{ width: 24 }} />
            </View>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
              <TouchableOpacity style={[styles.imagePicker, { borderColor: colors.border }]} onPress={pickImage}>
                {form.image ? (
                  <Image source={{ uri: form.image }} style={styles.imagePickerPreview} />
                ) : (
                  <>
                    <Ionicons name="camera-outline" size={28} color={Colors.primary} />
                    <Text style={[styles.imagePickerText, { color: colors.textSecondary }]}>Add Photo</Text>
                  </>
                )}
              </TouchableOpacity>
              <Input label="Product Name" value={form.name} onChangeText={(v) => setForm((f) => ({ ...f, name: v }))} placeholder="e.g. Shea Butter Cream" />
              <Input label="Description" value={form.description} onChangeText={(v) => setForm((f) => ({ ...f, description: v }))} placeholder="Describe your product" multiline numberOfLines={3} style={{ minHeight: 80, textAlignVertical: 'top' }} />
              <Input label="Price (NGN)" value={form.price} onChangeText={(v) => setForm((f) => ({ ...f, price: v }))} placeholder="0.00" keyboardType="decimal-pad" />
              <Input label="Stock Quantity" value={form.stock} onChangeText={(v) => setForm((f) => ({ ...f, stock: v }))} placeholder="0" keyboardType="number-pad" />
              <Text style={[styles.inputLabel, { color: colors.text }]}>Main Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {SHOP_CATEGORIES.map((category) => (
                  <TouchableOpacity
                    key={category.slug}
                    style={[styles.chip, { borderColor: colors.border, backgroundColor: colors.surfaceLight }, form.mainCategory === category.slug && { backgroundColor: Colors.primary, borderColor: Colors.primary }]}
                    onPress={() => setForm((f) => ({ ...f, mainCategory: category.slug, subcategory: category.subcategories[0]?.id || '' }))}
                  >
                    <Text style={[styles.chipText, { color: colors.text }, form.mainCategory === category.slug && { color: '#fff' }]}>{category.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Subcategory</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {selectedCategory.subcategories.map((subcategory) => (
                  <TouchableOpacity
                    key={subcategory.id}
                    style={[styles.chip, { borderColor: colors.border, backgroundColor: colors.surfaceLight }, form.subcategory === subcategory.id && { backgroundColor: Colors.primary, borderColor: Colors.primary }]}
                    onPress={() => setForm((f) => ({ ...f, subcategory: subcategory.id }))}
                  >
                    <Text style={[styles.chipText, { color: colors.text }, form.subcategory === subcategory.id && { color: '#fff' }]}>{subcategory.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <Button title={editingProduct ? 'Save Changes' : 'Add Product'} onPress={handleCreate} loading={saving} fullWidth size="large" />
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  headerTextWrap: { flex: 1, marginRight: Spacing.sm },
  title: { fontSize: FontSizes.lg, fontWeight: 'bold' },
  subtitle: { fontSize: FontSizes.xs, marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.md, paddingVertical: 8, borderRadius: BorderRadius.full },
  addBtnText: { color: '#fff', fontSize: FontSizes.sm, fontWeight: '700' },
  ordersBtn: { borderWidth: 1, paddingHorizontal: Spacing.md, paddingVertical: 8, borderRadius: BorderRadius.full },
  ordersBtnText: { fontSize: FontSizes.sm, fontWeight: '600' },
  segmentedControl: { flexDirection: 'row', paddingHorizontal: Spacing.lg, marginBottom: Spacing.sm, gap: Spacing.sm },
  segmentButton: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: BorderRadius.full },
  segmentButtonActive: {},
  segmentButtonText: { fontSize: FontSizes.sm, fontWeight: '600' },
  segmentButtonTextActive: { color: '#fff' },
  centerState: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.sm },
  emptyText: { fontSize: FontSizes.sm, textAlign: 'center', paddingHorizontal: Spacing.xl },
  content: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl },
  card: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, borderRadius: BorderRadius.md, padding: Spacing.sm, marginBottom: Spacing.sm },
  cardImage: { width: 52, height: 52, borderRadius: BorderRadius.sm },
  cardImagePlaceholder: { justifyContent: 'center', alignItems: 'center' },
  cardName: { fontSize: FontSizes.sm, fontWeight: '700' },
  cardPrice: { fontSize: FontSizes.xs, marginTop: 2 },
  cardMeta: { fontSize: 11, marginTop: 4 },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: BorderRadius.full, marginTop: 4 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  cardActions: { flexDirection: 'row', gap: Spacing.sm },
  imagePicker: { width: 100, height: 100, borderRadius: BorderRadius.md, borderWidth: 1.5, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: Spacing.lg, overflow: 'hidden' },
  imagePickerPreview: { width: '100%', height: '100%' },
  imagePickerText: { fontSize: FontSizes.xs, fontWeight: '600', marginTop: 4 },
  inputLabel: { fontSize: FontSizes.sm, fontWeight: '700', marginTop: Spacing.md, marginBottom: Spacing.xs },
  chipRow: { flexDirection: 'row', gap: Spacing.sm, paddingVertical: 4 },
  chip: { paddingHorizontal: Spacing.md, paddingVertical: 8, borderRadius: BorderRadius.full, borderWidth: 1 },
  chipActive: {},
  chipText: { fontSize: FontSizes.xs, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
});
