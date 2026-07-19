import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Image, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors, FontSizes, Spacing, BorderRadius } from '../../src/constants/theme';
import { Button } from '../../src/components/common';
import { shopService, Product } from '../../src/services/shop.service';
import { useCartStore } from '../../src/store/cartStore';
import { formatCurrency } from '../../src/utils/currency';

export default function ProductDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const addItem = useCartStore((s) => s.addItem);

  useEffect(() => {
    if (!id) return;
    shopService
      .getProduct(Number(id))
      .then(setProduct)
      .catch((err) => console.error('[product-detail] failed to load', err))
      .finally(() => setLoading(false));
  }, [id]);

  const handleAddToCart = () => {
    if (!product) return;
    addItem({
      productId: product.id,
      name: product.name,
      price: product.price,
      image: product.image_urls?.[0] || null,
      stylistAuthId: product.stylist_auth_id,
    });
    Alert.alert('Added to Cart', `${product.name} was added to your cart.`, [
      { text: 'Keep Shopping', style: 'cancel' },
      { text: 'View Cart', onPress: () => router.push('/shop/cart') },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!product) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back">
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.centerState}>
          <Text style={styles.emptyText}>Product not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('/shop/cart')} accessibilityRole="button" accessibilityLabel="Cart">
          <Ionicons name="cart-outline" size={24} color={Colors.text} />
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {product.image_urls?.[0] ? (
          <Image source={{ uri: product.image_urls[0] }} style={styles.image} />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder]}>
            <Ionicons name="image-outline" size={48} color={Colors.textMuted} />
          </View>
        )}
        <Text style={styles.name}>{product.name}</Text>
        <Text style={styles.price}>{formatCurrency(product.price)}</Text>
        <Text style={styles.stock}>{product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}</Text>
        {!!product.description && <Text style={styles.description}>{product.description}</Text>}
      </ScrollView>
      <View style={styles.footer}>
        <Button
          title={product.stock > 0 ? 'Add to Cart' : 'Out of Stock'}
          onPress={handleAddToCart}
          disabled={product.stock <= 0}
          fullWidth
          size="large"
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centerState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: FontSizes.sm, color: Colors.textSecondary },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  content: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl },
  image: { width: '100%', height: 260, borderRadius: BorderRadius.lg, marginBottom: Spacing.lg },
  imagePlaceholder: { backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center' },
  name: { fontSize: FontSizes.xl, fontWeight: '800', color: Colors.text },
  price: { fontSize: FontSizes.lg, fontWeight: '700', color: Colors.primary, marginTop: Spacing.xs },
  stock: { fontSize: FontSizes.sm, color: Colors.textSecondary, marginTop: Spacing.xs, marginBottom: Spacing.md },
  description: { fontSize: FontSizes.sm, color: Colors.textSecondary, lineHeight: 21 },
  footer: { padding: Spacing.lg, borderTopWidth: 1, borderTopColor: Colors.border },
});
