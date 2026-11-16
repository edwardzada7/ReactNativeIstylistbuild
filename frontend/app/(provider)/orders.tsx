import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { Colors, FontSizes, Spacing, BorderRadius } from '../../src/constants/theme';
import { useAuth } from '../../src/contexts/AuthContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { shopService, Order } from '../../src/services/shop.service';
import { formatCurrency } from '../../src/utils/currency';

// UI label -> backend status (backend allows: pending, confirmed, processing,
// shipped, delivered, canceled, returned).
const STATUS_OPTIONS = ['Pending', 'Accepted', 'Processing', 'Ready', 'Delivered', 'Cancelled'] as const;
const STATUS_TO_API: Record<string, string> = {
  Pending: 'pending',
  Accepted: 'confirmed',
  Processing: 'processing',
  Ready: 'shipped',
  Delivered: 'delivered',
  Cancelled: 'canceled',
};
const API_TO_LABEL: Record<string, string> = {
  pending: 'Pending',
  confirmed: 'Accepted',
  accepted: 'Accepted',
  processing: 'Processing',
  shipped: 'Ready',
  ready: 'Ready',
  delivered: 'Delivered',
  canceled: 'Cancelled',
  cancelled: 'Cancelled',
  returned: 'Returned',
  paid: 'Paid',
};
const STATUS_COLOR: Record<string, string> = {
  pending: Colors.warning,
  accepted: Colors.primary,
  confirmed: Colors.primary,
  processing: Colors.warning,
  ready: Colors.success,
  shipped: Colors.success,
  delivered: Colors.success,
  cancelled: Colors.error,
  canceled: Colors.error,
};
const statusLabel = (status?: string) => {
  const key = String(status || '').toLowerCase();
  return API_TO_LABEL[key] || (key ? key.charAt(0).toUpperCase() + key.slice(1) : 'Pending');
};

export default function ProviderShopOrders() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    if (!user?.auth_id) return;
    try {
      setOrders(await shopService.getProviderOrders(user.auth_id));
    } catch (err) {
      console.error('[provider-orders] failed to load', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.auth_id]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleStatusChange = async (order: Order, status: string) => {
    try {
      setUpdatingId(order.id);
      const apiStatus = STATUS_TO_API[status] || status.toLowerCase();
      await shopService.updateOrderStatus(order.id, apiStatus);
      setOrders((prev) => prev.map((item) => (item.id === order.id ? { ...item, status: apiStatus } : item)));
    } catch (err: any) {
      Alert.alert('Update failed', err?.friendlyMessage || err?.message || 'Could not update this order status.');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Shop Orders</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.centerState}><ActivityIndicator size="large" color={Colors.primary} /></View>
      ) : orders.length === 0 ? (
        <View style={styles.centerState}>
          <Ionicons name="receipt-outline" size={32} color={colors.textSecondary} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No paid shop orders yet.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={Colors.primary} />}>
          {orders.map((order) => (
            <View key={order.id} style={[styles.card, { backgroundColor: colors.surface }]}>
              <View style={styles.cardHeader}>
                <Text style={[styles.orderId, { color: colors.text }]}>Order #{order.id}</Text>
                <View style={[styles.statusBadge, { backgroundColor: `${STATUS_COLOR[order.status.toLowerCase()] || colors.textSecondary}20` }]}>
                  <Text style={[styles.statusText, { color: STATUS_COLOR[order.status.toLowerCase()] || colors.textSecondary }]}>
                    {statusLabel(order.status)}
                  </Text>
                </View>
              </View>
              <Text style={[styles.orderMeta, { color: colors.textSecondary }]}>Customer: {order.customer_name || 'Customer'}</Text>
              {order.items?.length ? (
                <Text style={[styles.orderMeta, { color: colors.textSecondary }]}>Items: {order.items.map((item) => `${item.products?.name || 'Item'} ×${item.quantity}`).join(', ')}</Text>
              ) : null}
              <Text style={[styles.orderMeta, { color: colors.textSecondary }]}>Amount: {formatCurrency(order.total_amount)}</Text>
              <Text style={[styles.orderMeta, { color: colors.textSecondary }]}>Date: {new Date(order.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
              <View style={styles.actionsRow}>
                {STATUS_OPTIONS.map((status) => {
                  const active = statusLabel(order.status) === status;
                  return (
                  <TouchableOpacity key={status} testID={`order-${order.id}-status-${status.toLowerCase()}`} style={[styles.actionChip, { backgroundColor: colors.surfaceLight, borderColor: colors.border }, active && { backgroundColor: Colors.primary, borderColor: Colors.primary }]} onPress={() => handleStatusChange(order, status)} disabled={updatingId === order.id || active}>
                    <Text style={[styles.actionText, { color: colors.textSecondary }, active && { color: '#fff' }]}>{status}</Text>
                  </TouchableOpacity>
                  );
                })}
              </View>
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
  orderMeta: { fontSize: FontSizes.xs, marginTop: 2 },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: Spacing.sm },
  actionChip: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: BorderRadius.full, borderWidth: 1 },
  actionChipActive: {},
  actionText: { fontSize: 11, fontWeight: '600' },
  actionTextActive: {},
});
