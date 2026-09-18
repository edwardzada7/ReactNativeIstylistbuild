import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSizes, Spacing, BorderRadius } from '../../constants/theme';

interface Props {
  title?: string;
  audience: 'customer' | 'provider';
}

/**
 * Shop placeholder (Phase 5A - navigation/UX only).
 *
 * Intentionally NOT implementing product/catalog features yet. This screen
 * exists so the "Shop" tab has a real, stable route today, while the folder
 * structure below is ready to grow into the full marketplace without a
 * navigation redesign later:
 *
 *   app/(tabs)/shop.tsx              -> customer shop entry (this file's caller)
 *   app/(provider)/shop.tsx          -> provider shop entry (this file's caller)
 *   app/shop/product/[id].tsx        -> (future) product detail page
 *   app/shop/category/[slug].tsx     -> (future) category/subcategory listing
 *   app/shop/cart.tsx                -> (future) cart
 *   app/shop/checkout.tsx            -> (future) checkout
 *   app/shop/orders.tsx               -> (future) order history
 *   app/(provider)/shop/products.tsx -> (future) vendor product management
 *   src/services/shop.service.ts     -> (future) products/categories/cart/orders API layer
 *   src/types/shop.ts                -> (future) Product/Category/Cart/Order types
 *
 * Planned capabilities (per product spec, NOT built in this phase):
 * Admin Products, Brand Stores, Featured Products, Categories/Subcategories,
 * Search & Filters, Wishlist, Recently Viewed, Flash Sales, Coupons,
 * Affiliate/Sponsored/Related Products, Frequently Bought Together, Product
 * Reviews, Inventory, Variants, Shipping/Pickup, Taxes, International
 * Shipping, Multiple Currencies, Vendor Marketplace, AI Recommendations.
 */
export default function ShopPlaceholder({ title = 'Shop', audience }: Props) {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name="bag-handle-outline" size={40} color={Colors.primary} />
          </View>
          <Text style={styles.heading}>Shop is coming soon</Text>
          <Text style={styles.subtext}>
            {audience === 'provider'
              ? 'Sell products alongside your services - brand storefronts, inventory, and orders will live here.'
              : 'Browse and buy beauty & grooming products from your favorite providers - coming soon.'}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl },
  title: { fontSize: FontSizes.xxl, fontWeight: 'bold', color: Colors.text, marginVertical: Spacing.md },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    marginTop: Spacing.xl,
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: `${Colors.primary}18`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  heading: { fontSize: FontSizes.lg, fontWeight: '700', color: Colors.text, marginBottom: Spacing.sm },
  subtext: { fontSize: FontSizes.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
});
