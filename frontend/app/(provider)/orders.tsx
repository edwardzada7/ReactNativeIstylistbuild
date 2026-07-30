import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { Colors, FontSizes, Spacing, BorderRadius } from '../../src/constants/theme';
import { useAuth } from '../../src/contexts/AuthContext';
import { shopService, Order } from '../../src/services/shop.service';
import { formatCurrency } from '../../src/utils/currency';

const STATUS_OPTIONS = ['Pending', 'Accepted', 'Processing', 'Ready', 'Delivered', 'Cancelled'] as const;
const STATUS_COLOR: Record<string, string> = {
  pending: Colors.warning,
  accepted: Colors.primary,
  processing: Colors.warning,
  ready: Colors.success,
  delivered: Colors.success,
  cancelled: Colors.error,
};

export default function ProviderShopOrders() {
  const router = useRouter();
  const { user } = useAuth();
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
      await shopService.updateOrderStatus(order.id, status);
      setOrders((prev) => prev.map((item) => (item.id === order.id ? { ...item, status: status.toLowerCase() } : item)));
    } catch (err: any) {
      Alert.alert('Update failed', err?.friendlyMessage || err?.message || 'Could not update this order status.');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Shop Orders</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.centerState}><ActivityIndicator size="large" color={Colors.primary} /></View>
      ) : orders.length === 0 ? (
        <View style={styles.centerState}>
          <Ionicons name="receipt-outline" size={32} color={Colors.textMuted} />
          <Text style={styles.emptyText}>No paid shop orders yet.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={Colors.primary} />}>
          {orders.map((order) => (
            <View key={order.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.orderId}>Order #{order.id}</Text>
                <View style={[styles.statusBadge, { backgroundColor: `${STATUS_COLOR[order.status.toLowerCase()] || Colors.textMuted}20` }]}> 
                  <Text style={[styles.statusText, { color: STATUS_COLOR[order.status.toLowerCase()] || Colors.textMuted }]}> 
                    {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                  </Text>
                </View>
              </View>
              <Text style={styles.orderMeta}>Customer: {order.customer_name || 'Customer'}</Text>
              {order.items?.length ? (
                <Text style={styles.orderMeta}>Items: {order.items.map((item) => `${item.products?.name || 'Item'} ×${item.quantity}`).join(', ')}</Text>
              ) : null}
              <Text style={styles.orderMeta}>Amount: {formatCurrency(order.total_amount)}</Text>
              <Text style={styles.orderMeta}>Date: {new Date(order.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
              <View style={styles.actionsRow}>
                {STATUS_OPTIONS.map((status) => (
                  <TouchableOpacity key={status} style={[styles.actionChip, order.status.toLowerCase() === status.toLowerCase() && styles.actionChipActive]} onPress={() => handleStatusChange(order, status)} disabled={updatingId === order.id}>
                    <Text style={[styles.actionText, order.status.toLowerCase() === status.toLowerCase() && styles.actionTextActive]}>{status}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
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
  card: { backgroundColor: Colors.surface, borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: Spacing.sm },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  orderId: { fontSize: FontSizes.sm, fontWeight: '700', color: Colors.text },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: BorderRadius.full },
  statusText: { fontSize: FontSizes.xs, fontWeight: '700' },
  orderMeta: { fontSize: FontSizes.xs, color: Colors.textSecondary, marginTop: 2 },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: Spacing.sm },
  actionChip: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: BorderRadius.full, backgroundColor: Colors.background },
  actionChipActive: { backgroundColor: Colors.primary },
  actionText: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary },
  actionTextActive: { color: '#fff' },
});
