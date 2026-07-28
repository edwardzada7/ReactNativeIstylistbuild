import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, FontSizes, Spacing, BorderRadius } from '../../src/constants/theme';
import { shopService } from '../../src/services/shop.service';
import { Product } from '../../src/types';
import { formatCurrency } from '../../src/utils/currency';

type Filter = 'all' | 'pending' | 'approved' | 'rejected';

export default function ShopModeration() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('pending');
  const [actioningId, setActioningId] = useState<number | null>(null);

  const loadProducts = useCallback(async () => {
    try {
      setLoading(true);
      // Get all products (including non-approved for moderation)
      const response = await shopService.getProducts();
      setProducts(response || []);
    } catch (err) {
      console.error('[shop-moderation] failed to load', err);
      setProducts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const handleAction = async (product: Product, action: 'approve' | 'reject' | 'delete') => {
    setActioningId(product.id);
    try {
      if (action === 'delete') {
        await shopService.deleteProduct(product.id);
        setProducts((prev) => prev.filter((p) => p.id !== product.id));
      } else if (action === 'approve') {
        await shopService.updateProduct(product.id, { approved: true });
        setProducts((prev) => prev.map((p) => (p.id === product.id ? { ...p, approved: true } : p)));
      } else if (action === 'reject') {
        await shopService.updateProduct(product.id, { approved: false });
        setProducts((prev) => prev.map((p) => (p.id === product.id ? { ...p, approved: false } : p)));
      }
    } catch (err: any) {
      Alert.alert('Error', err?.friendlyMessage || 'Could not perform this action.');
    } finally {
      setActioningId(null);
    }
  };

  const filteredProducts = products.filter((product) => {
    if (filter === 'all') return true;
    if (filter === 'pending') return !product.approved;
    if (filter === 'approved') return product.approved;
    if (filter === 'rejected') return !product.approved;
    return true;
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Shop Moderation</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.filterRow}>
        {(['all', 'pending', 'approved', 'rejected'] as Filter[]).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
            onPress={() => setFilter(f)}
            accessibilityRole="button"
          >
            <Text style={[styles.filterChipText, filter === f && styles.filterChipTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : filteredProducts.length === 0 ? (
        <View style={styles.centerState}>
          <Ionicons name="bag-handle-outline" size={48} color={Colors.textMuted} />
          <Text style={styles.emptyText}>No products found</Text>
        </View>
      ) : (
        <FlatList
          data={filteredProducts}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardContent}>
                <Text style={styles.cardName}>{item.name}</Text>
                <Text style={styles.cardDescription} numberOfLines={2}>
                  {item.description || 'No description'}
                </Text>
                <View style={styles.cardMeta}>
                  <Text style={styles.cardPrice}>{formatCurrency(item.price)}</Text>
                  <Text style={styles.cardStock}>{item.stock} in stock</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: item.approved ? `${Colors.success}20` : `${Colors.warning}20` }]}>
                  <Text style={[styles.statusText, { color: item.approved ? Colors.success : Colors.warning }]}>
                    {item.approved ? 'Approved' : 'Pending'}
                  </Text>
                </View>
                <View style={styles.cardActions}>
                  {!item.approved && (
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.approveBtn]}
                      onPress={() => handleAction(item, 'approve')}
                      disabled={actioningId === item.id}
                    >
                      <Ionicons name="checkmark" size={16} color="#fff" />
                      <Text style={styles.actionBtnText}>Approve</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.rejectBtn]}
                    onPress={() => handleAction(item, 'reject')}
                    disabled={actioningId === item.id}
                  >
                    <Ionicons name="close" size={16} color="#fff" />
                    <Text style={styles.actionBtnText}>Reject</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.deleteBtn]}
                    onPress={() => handleAction(item, 'delete')}
                    disabled={actioningId === item.id}
                  >
                    <Ionicons name="trash" size={16} color="#fff" />
                    <Text style={styles.actionBtnText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadProducts(); }} tintColor={Colors.primary} />
          }
          contentContainerStyle={styles.list}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  title: { fontSize: FontSizes.lg, fontWeight: 'bold', color: Colors.text },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  filterChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterChipText: { fontSize: FontSizes.xs, fontWeight: '600', color: Colors.textSecondary },
  filterChipTextActive: { color: Colors.text },
  centerState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  emptyText: { fontSize: FontSizes.sm, color: Colors.textSecondary },
  list: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },
  cardContent: { padding: Spacing.md },
  cardName: { fontSize: FontSizes.md, fontWeight: '600', color: Colors.text, marginBottom: 4 },
  cardDescription: { fontSize: FontSizes.sm, color: Colors.textSecondary, marginBottom: Spacing.sm },
  cardMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  cardPrice: { fontSize: FontSizes.sm, fontWeight: '700', color: Colors.primary },
  cardStock: { fontSize: FontSizes.sm, color: Colors.textSecondary },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.sm,
  },
  statusText: { fontSize: FontSizes.xs, fontWeight: '700' },
  cardActions: { flexDirection: 'row', gap: Spacing.sm },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  actionBtnText: { fontSize: FontSizes.xs, fontWeight: '600', color: '#fff' },
  approveBtn: { backgroundColor: Colors.success },
  rejectBtn: { backgroundColor: Colors.warning },
  deleteBtn: { backgroundColor: Colors.error },
});
