import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Linking, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useTheme } from '../../../src/contexts/ThemeContext';
import { useAuth } from '../../../src/contexts/AuthContext';
import { shopService } from '../../../src/services/shop.service';
import { ProfileAvatar } from '../../../src/components/common';
import { formatCurrency } from '../../../src/utils/currency';
import { Colors, FontSizes, Spacing, BorderRadius } from '../../../src/constants/theme';

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending', confirmed: 'Accepted', accepted: 'Accepted', processing: 'Processing',
  shipped: 'Ready', ready: 'Ready', delivered: 'Delivered', canceled: 'Cancelled', cancelled: 'Cancelled', returned: 'Returned', paid: 'Paid',
};

const formatAddress = (address: any): string => {
  if (!address) return '';
  if (typeof address === 'string') return address;
  return [address.address || address.street || address.line1, address.line2, address.city, address.state, address.country, address.postal_code]
    .filter(Boolean)
    .join(', ');
};

export default function OrderDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { user } = useAuth();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setOrder(await shopService.getOrderDetails(Number(id)));
    } catch (err: any) {
      setError(err?.friendlyMessage || 'Could not load this order.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const isSeller = !!order && order.provider_auth_id === user?.auth_id;
  const status = String(order?.status || 'pending').toLowerCase();
  const address = formatAddress(order?.customer?.address);

  const Row = ({ icon, label, value, onPress, testID }: { icon: any; label: string; value?: string | null; onPress?: () => void; testID: string }) =>
    value ? (
      <TouchableOpacity testID={testID} disabled={!onPress} onPress={onPress} style={styles.row} accessibilityRole={onPress ? 'button' : undefined}>
        <Ionicons name={icon} size={18} color={colors.textSecondary} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.rowLabel, { color: colors.textSecondary }]}>{label}</Text>
          <Text style={[styles.rowValue, { color: onPress ? Colors.primary : colors.text }]}>{value}</Text>
        </View>
      </TouchableOpacity>
    ) : null;

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity testID="order-details-back" onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Order #{id}</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>
      ) : error || !order ? (
        <View style={styles.center}>
          <Text testID="order-details-error" style={{ color: colors.textSecondary }}>{error || 'Order not found.'}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: Spacing.lg, paddingBottom: insets.bottom + Spacing.xl }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.primary} />}
        >
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <View style={styles.spaceBetween}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Status</Text>
              <Text testID="order-details-status" style={[styles.status, { color: status.startsWith('cancel') ? Colors.error : Colors.primary }]}>{STATUS_LABEL[status] || status}</Text>
            </View>
            <Text style={[styles.meta, { color: colors.textSecondary }]}>
              Placed {new Date(order.created_at).toLocaleString('en-NG', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </Text>
            {order.payment_reference ? <Text style={[styles.meta, { color: colors.textSecondary }]}>Payment ref: {order.payment_reference}</Text> : null}
            {!isSeller && order.provider_name ? <Text style={[styles.meta, { color: colors.textSecondary }]}>Seller: {order.provider_name}</Text> : null}
          </View>

          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Items</Text>
            {(order.items || []).map((item: any) => {
              const image = item.products?.image_urls?.[0] || item.image_url;
              const price = Number(item.unit_price ?? item.price ?? 0);
              return (
                <View key={item.id} style={styles.item} testID={`order-item-${item.id}`}>
                  {image ? <Image source={{ uri: image }} style={styles.itemImage} contentFit="cover" /> : <View style={[styles.itemImage, { backgroundColor: colors.surfaceLight }]} />}
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.itemName, { color: colors.text }]} numberOfLines={2}>{item.products?.name || item.name || 'Item'}</Text>
                    <Text style={[styles.meta, { color: colors.textSecondary }]}>{item.quantity} × {formatCurrency(price)}</Text>
                  </View>
                  <Text style={[styles.itemTotal, { color: colors.text }]}>{formatCurrency(Number(item.total_price ?? price * Number(item.quantity || 1)))}</Text>
                </View>
              );
            })}
            <View style={[styles.spaceBetween, styles.totalRow, { borderTopColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Total</Text>
              <Text testID="order-details-total" style={[styles.total, { color: colors.text }]}>{formatCurrency(order.total_amount)}</Text>
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Customer</Text>
            <View style={styles.customerHeader}>
              <ProfileAvatar uri={order.customer?.avatar} name={order.customer?.name || 'Customer'} size={48} />
              <Text testID="order-details-customer-name" style={[styles.itemName, { color: colors.text }]}>{order.customer?.name || 'Customer'}</Text>
            </View>
            <Row testID="order-details-customer-phone" icon="call-outline" label="Phone" value={order.customer?.phone} onPress={order.customer?.phone ? () => Linking.openURL(`tel:${order.customer.phone}`) : undefined} />
            <Row testID="order-details-customer-email" icon="mail-outline" label="Email" value={order.customer?.email} onPress={order.customer?.email ? () => Linking.openURL(`mailto:${order.customer.email}`) : undefined} />
            <Row testID="order-details-customer-address" icon="location-outline" label="Delivery address" value={address} />
            {order.customer?.address?.note || order.note ? (
              <Row testID="order-details-note" icon="document-text-outline" label="Note" value={order.customer?.address?.note || order.note} />
            ) : null}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  title: { fontSize: FontSizes.lg, fontWeight: 'bold' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: { borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: Spacing.md },
  spaceBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: FontSizes.md, fontWeight: '700', marginBottom: Spacing.sm },
  status: { fontSize: FontSizes.md, fontWeight: '800' },
  meta: { fontSize: FontSizes.xs, marginTop: 2 },
  item: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm },
  itemImage: { width: 52, height: 52, borderRadius: BorderRadius.sm },
  itemName: { fontSize: FontSizes.sm, fontWeight: '700', flexShrink: 1 },
  itemTotal: { fontSize: FontSizes.sm, fontWeight: '700' },
  totalRow: { borderTopWidth: 1, marginTop: Spacing.sm, paddingTop: Spacing.sm },
  total: { fontSize: FontSizes.lg, fontWeight: '800' },
  customerHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, paddingVertical: Spacing.sm },
  rowLabel: { fontSize: FontSizes.xs },
  rowValue: { fontSize: FontSizes.sm, fontWeight: '600', marginTop: 2 },
});
