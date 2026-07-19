import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, FontSizes, Spacing, BorderRadius } from '../../src/constants/theme';
import { Button } from '../../src/components/common';
import { shopService } from '../../src/services/shop.service';
import { useCartStore } from '../../src/store/cartStore';
import { formatCurrency } from '../../src/utils/currency';

export default function Cart() {
  const router = useRouter();
  const { lines, setQuantity, removeItem, clear, total } = useCartStore();
  const [checkingOut, setCheckingOut] = useState(false);

  const handleCheckout = async () => {
    if (lines.length === 0) return;
    setCheckingOut(true);
    try {
      await shopService.createOrder(lines.map((l) => ({ product_id: l.productId, quantity: l.quantity })));
      clear();
      Alert.alert('Order Placed', 'Your order has been placed successfully.', [
        { text: 'View Orders', onPress: () => router.replace('/shop/orders') },
      ]);
    } catch (err: any) {
      Alert.alert('Checkout Failed', err?.response?.data?.detail || err?.message || 'Could not place your order. Please try again.');
    } finally {
      setCheckingOut(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>My Cart</Text>
        <TouchableOpacity onPress={() => router.push('/shop/orders')} accessibilityRole="button" accessibilityLabel="Order history">
          <Ionicons name="receipt-outline" size={22} color={Colors.text} />
        </TouchableOpacity>
      </View>

      {lines.length === 0 ? (
        <View style={styles.centerState}>
          <Ionicons name="cart-outline" size={32} color={Colors.textMuted} />
          <Text style={styles.emptyText}>Your cart is empty.</Text>
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {lines.map((line) => (
              <View key={line.productId} style={styles.line}>
                {line.image ? (
                  <Image source={{ uri: line.image }} style={styles.lineImage} />
                ) : (
                  <View style={[styles.lineImage, styles.lineImagePlaceholder]}>
                    <Ionicons name="image-outline" size={20} color={Colors.textMuted} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.lineName} numberOfLines={1}>{line.name}</Text>
                  <Text style={styles.linePrice}>{formatCurrency(line.price)}</Text>
                </View>
                <View style={styles.qtyRow}>
                  <TouchableOpacity style={styles.qtyBtn} onPress={() => setQuantity(line.productId, line.quantity - 1)} accessibilityLabel="Decrease quantity">
                    <Ionicons name="remove" size={16} color={Colors.text} />
                  </TouchableOpacity>
                  <Text style={styles.qtyText}>{line.quantity}</Text>
                  <TouchableOpacity style={styles.qtyBtn} onPress={() => setQuantity(line.productId, line.quantity + 1)} accessibilityLabel="Increase quantity">
                    <Ionicons name="add" size={16} color={Colors.text} />
                  </TouchableOpacity>
                </View>
                <TouchableOpacity onPress={() => removeItem(line.productId)} accessibilityLabel="Remove item">
                  <Ionicons name="trash-outline" size={18} color={Colors.error} />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
          <View style={styles.footer}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>{formatCurrency(total())}</Text>
            </View>
            <Button title={checkingOut ? 'Placing Order...' : 'Checkout'} onPress={handleCheckout} loading={checkingOut} fullWidth size="large" />
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  title: { fontSize: FontSizes.lg, fontWeight: 'bold', color: Colors.text },
  centerState: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.sm },
  emptyText: { fontSize: FontSizes.sm, color: Colors.textSecondary },
  content: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl },
  line: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.surface, borderRadius: BorderRadius.md, padding: Spacing.sm, marginBottom: Spacing.sm },
  lineImage: { width: 48, height: 48, borderRadius: BorderRadius.sm },
  lineImagePlaceholder: { backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' },
  lineName: { fontSize: FontSizes.sm, fontWeight: '600', color: Colors.text },
  linePrice: { fontSize: FontSizes.xs, color: Colors.primary, fontWeight: '700', marginTop: 2 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  qtyBtn: { width: 26, height: 26, borderRadius: 13, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' },
  qtyText: { fontSize: FontSizes.sm, fontWeight: '600', color: Colors.text, minWidth: 18, textAlign: 'center' },
  footer: { padding: Spacing.lg, borderTopWidth: 1, borderTopColor: Colors.border },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.md },
  totalLabel: { fontSize: FontSizes.md, color: Colors.textSecondary },
  totalValue: { fontSize: FontSizes.lg, fontWeight: '800', color: Colors.text },
});
