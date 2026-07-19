import React, { useCallback, useState } from 'react';
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
import { useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Colors, FontSizes, Spacing, BorderRadius } from '../../src/constants/theme';
import { Button, Input } from '../../src/components/common';
import { useAuth } from '../../src/contexts/AuthContext';
import { shopService, Product } from '../../src/services/shop.service';
import { formatCurrency } from '../../src/utils/currency';

/**
 * Shop management (provider, Phase 3A). Real CRUD via shopService against
 * the existing `products` table (RLS-verified: providers can insert/update/
 * delete their own rows directly). New products start `approved: false`
 * (moderation flow already present in the schema) - a badge reflects this.
 */
export default function ProviderShop() {
  const { user } = useAuth();
  const authId = user?.auth_id;

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', price: '', stock: '', image: '' as string });

  const loadData = useCallback(async () => {
    if (!authId) return;
    try {
      setProducts(await shopService.getProviderProducts(authId));
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

  const resetForm = () => setForm({ name: '', description: '', price: '', stock: '', image: '' });

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo library access to add a product photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
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
      await shopService.createProduct({
        name: form.name.trim(),
        description: form.description.trim(),
        price,
        stock,
        image_urls: form.image ? [form.image] : undefined,
      });
      setModalVisible(false);
      resetForm();
      await loadData();
      Alert.alert('Product Added', 'Your product was added and is pending approval.');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not add this product.');
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
            setProducts((prev) => prev.filter((p) => p.id !== product.id));
          } catch (err) {
            Alert.alert('Error', 'Could not delete this product.');
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>My Shop</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)} accessibilityRole="button" accessibilityLabel="Add product">
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.addBtnText}>Add Product</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : products.length === 0 ? (
        <View style={styles.centerState}>
          <Ionicons name="bag-handle-outline" size={32} color={Colors.textMuted} />
          <Text style={styles.emptyText}>You haven&apos;t added any products yet.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {products.map((product) => (
            <View key={product.id} style={styles.card}>
              {product.image_urls?.[0] ? (
                <Image source={{ uri: product.image_urls[0] }} style={styles.cardImage} />
              ) : (
                <View style={[styles.cardImage, styles.cardImagePlaceholder]}>
                  <Ionicons name="image-outline" size={22} color={Colors.textMuted} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.cardName} numberOfLines={1}>{product.name}</Text>
                <Text style={styles.cardPrice}>{formatCurrency(product.price)} &middot; {product.stock} in stock</Text>
                <View style={[styles.badge, { backgroundColor: product.approved ? `${Colors.success}20` : `${Colors.warning}20` }]}>
                  <Text style={[styles.badgeText, { color: product.approved ? Colors.success : Colors.warning }]}>
                    {product.approved ? 'Live' : 'Pending Approval'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => handleDelete(product)} accessibilityLabel="Delete product">
                <Ionicons name="trash-outline" size={20} color={Colors.error} />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}

      <Modal visible={modalVisible} animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <SafeAreaView style={styles.container} edges={['top']}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <View style={styles.header}>
              <TouchableOpacity onPress={() => setModalVisible(false)} accessibilityLabel="Close">
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
              <Text style={styles.title}>Add Product</Text>
              <View style={{ width: 24 }} />
            </View>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
              <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
                {form.image ? (
                  <Image source={{ uri: form.image }} style={styles.imagePickerPreview} />
                ) : (
                  <>
                    <Ionicons name="camera-outline" size={28} color={Colors.primary} />
                    <Text style={styles.imagePickerText}>Add Photo</Text>
                  </>
                )}
              </TouchableOpacity>
              <Input label="Product Name" value={form.name} onChangeText={(v) => setForm((f) => ({ ...f, name: v }))} placeholder="e.g. Shea Butter Cream" />
              <Input label="Description" value={form.description} onChangeText={(v) => setForm((f) => ({ ...f, description: v }))} placeholder="Describe your product" multiline numberOfLines={3} style={{ minHeight: 80, textAlignVertical: 'top' }} />
              <Input label="Price (NGN)" value={form.price} onChangeText={(v) => setForm((f) => ({ ...f, price: v }))} placeholder="0.00" keyboardType="decimal-pad" />
              <Input label="Stock Quantity" value={form.stock} onChangeText={(v) => setForm((f) => ({ ...f, stock: v }))} placeholder="0" keyboardType="number-pad" />
              <Button title="Add Product" onPress={handleCreate} loading={saving} fullWidth size="large" />
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  title: { fontSize: FontSizes.lg, fontWeight: 'bold', color: Colors.text },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primary, paddingHorizontal: Spacing.md, paddingVertical: 8, borderRadius: BorderRadius.full },
  addBtnText: { color: '#fff', fontSize: FontSizes.sm, fontWeight: '700' },
  centerState: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.sm },
  emptyText: { fontSize: FontSizes.sm, color: Colors.textSecondary },
  content: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl },
  card: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.surface, borderRadius: BorderRadius.md, padding: Spacing.sm, marginBottom: Spacing.sm },
  cardImage: { width: 52, height: 52, borderRadius: BorderRadius.sm },
  cardImagePlaceholder: { backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' },
  cardName: { fontSize: FontSizes.sm, fontWeight: '700', color: Colors.text },
  cardPrice: { fontSize: FontSizes.xs, color: Colors.textSecondary, marginTop: 2 },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: BorderRadius.full, marginTop: 4 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  imagePicker: { width: 100, height: 100, borderRadius: BorderRadius.md, borderWidth: 1.5, borderColor: Colors.border, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: Spacing.lg, overflow: 'hidden' },
  imagePickerPreview: { width: '100%', height: '100%' },
  imagePickerText: { fontSize: FontSizes.xs, color: Colors.primary, fontWeight: '600', marginTop: 4 },
});
