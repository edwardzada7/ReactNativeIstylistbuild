import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { Colors, FontSizes, Spacing, BorderRadius } from '../../src/constants/theme';
import { shopService, Order } from '../../src/services/shop.service';
import { formatCurrency } from '../../src/utils/currency';
import { useTheme } from '../../src/contexts/ThemeContext';

const STATUS_COLOR: Record<string, string> = {
  pending: Colors.warning,
  accepted: Colors.primary,
  processing: Colors.warning,
  ready: Colors.success,
  delivered: Colors.success,
  cancelled: Colors.error,
};
const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  processing: 'Processing',
  ready: 'Ready',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export default function OrderHistory() {
  const router = useRouter();
  const { colors } = useTheme();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setOrders(await shopService.getMyOrders());
    } catch (err) {
      console.error('[orders] failed to load', err);
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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>My Orders</Text>
        <View style={{ width: 24 }} />
      </View>
      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : orders.length === 0 ? (
        <View style={styles.centerState}>
          <Ionicons name="receipt-outline" size={32} color={colors.textMuted} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>You haven&apos;t placed any orders yet.</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={colors.primary} />}
        >
          {orders.map((order) => (
            <View key={order.id} style={[styles.card, { backgroundColor: colors.surface }]}>
              <View style={styles.cardHeader}>
                <Text style={[styles.orderId, { color: colors.text }]}>Order #{order.id}</Text>
                <View style={[styles.statusBadge, { backgroundColor: `${STATUS_COLOR[order.status] || colors.textMuted}20` }]}>
                  <Text style={[styles.statusText, { color: STATUS_COLOR[order.status] || colors.textMuted }]}>
                    {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                  </Text>
                </View>
              </View>
              <Text style={[styles.orderDate, { color: colors.textMuted }]}>
                {new Date(order.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
              </Text>
              <Text style={[styles.orderTotal, { color: colors.text }]}>{formatCurrency(order.total_amount)}</Text>
              {order.provider_name ? <Text style={[styles.orderMeta, { color: colors.textSecondary }]}>Provider: {order.provider_name}</Text> : null}
              {order.items?.length ? (
                <Text style={[styles.orderMeta, { color: colors.textSecondary }]}>
                  Items: {order.items.map((item) => `${item.products?.name || 'Item'} ×${item.quantity}`).join(', ')}
                </Text>
              ) : null}
              {order.payment_reference ? <Text style={[styles.orderMeta, { color: colors.textSecondary }]}>Ref: {order.payment_reference}</Text> : null}
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  title: { fontSize: FontSizes.lg, fontWeight: 'bold' },
  centerState: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.sm },
  emptyText: { fontSize: FontSizes.sm },
  content: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl },
  card: { borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: Spacing.sm },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  orderId: { fontSize: FontSizes.sm, fontWeight: '700' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: BorderRadius.full },
  statusText: { fontSize: FontSizes.xs, fontWeight: '700' },
  orderDate: { fontSize: FontSizes.xs, marginBottom: 4 },
  orderTotal: { fontSize: FontSizes.md, fontWeight: '800' },
  orderMeta: { fontSize: FontSizes.xs, marginTop: 2 },
});
