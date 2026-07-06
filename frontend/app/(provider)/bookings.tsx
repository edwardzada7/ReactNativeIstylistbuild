import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSizes, Spacing, BorderRadius } from '../../src/constants/theme';
import { bookingService } from '../../src/services/booking.service';
import { walletService } from '../../src/services/wallet.service';
import { useAuth } from '../../src/contexts/AuthContext';
import { formatCurrency } from '../../src/utils/currency';
import { derivePaymentStatus, getPaymentStatusMeta } from '../../src/utils/walletHelpers';
import { Booking, Transaction } from '../../src/types';

const FILTERS = ['Pending', 'Upcoming', 'Completed', 'Cancelled'] as const;

const STATUS_COLOR: Record<string, string> = {
  pending: Colors.warning,
  confirmed: Colors.info,
  arrived: Colors.info,
  completed: Colors.success,
  cancelled: Colors.error,
  rejected: Colors.error,
};

const PAYMENT_TONE_COLOR: Record<string, string> = {
  success: Colors.success,
  error: Colors.error,
  warning: Colors.warning,
  info: Colors.info,
  neutral: Colors.textMuted,
};

// Buttons available per current status. Actions map to a target status sent
// via the documented `PUT /api/bookings/{id}` endpoint.
const ACTIONS_FOR_STATUS: Record<string, { label: string; next: string; destructive?: boolean }[]> = {
  pending: [
    { label: 'Accept', next: 'confirmed' },
    { label: 'Reject', next: 'rejected', destructive: true },
  ],
  confirmed: [
    { label: 'Mark Arrived', next: 'arrived' },
    { label: 'Cancel', next: 'cancelled', destructive: true },
  ],
  arrived: [{ label: 'Mark Completed', next: 'completed' }],
};

export default function ProviderBookings() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filter, setFilter] = useState<typeof FILTERS[number]>('Pending');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const [list, txnData] = await Promise.all([
        bookingService.getBookings({ role: 'provider' }),
        user?.auth_id ? walletService.getTransactions(user.auth_id).catch(() => []) : Promise.resolve([]),
      ]);
      setBookings(list);
      setTransactions(txnData);
    } catch (err: any) {
      console.error('[provider-bookings] failed to load', err);
      setError(err?.friendlyMessage || 'Could not load bookings.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.auth_id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const filtered = useMemo(() => {
    switch (filter) {
      case 'Pending':
        return bookings.filter((b) => b.status === 'pending');
      case 'Upcoming':
        return bookings.filter((b) => ['confirmed', 'arrived'].includes(b.status));
      case 'Completed':
        return bookings.filter((b) => b.status === 'completed');
      case 'Cancelled':
        return bookings.filter((b) => ['cancelled', 'rejected'].includes(b.status));
      default:
        return bookings;
    }
  }, [bookings, filter]);

  const handleAction = async (booking: Booking, next: string, destructive?: boolean) => {
    const proceed = async () => {
      setUpdatingId(booking.id);
      try {
        const updated = await bookingService.updateBookingStatus(booking.id, next);
        setBookings((prev) => prev.map((b) => (b.id === booking.id ? updated : b)));
      } catch (err: any) {
        Alert.alert('Error', err?.friendlyMessage || 'Could not update this booking.');
      } finally {
        setUpdatingId(null);
      }
    };

    if (destructive) {
      Alert.alert('Are you sure?', `This will mark the booking as "${next}".`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', style: 'destructive', onPress: proceed },
      ]);
    } else {
      proceed();
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Bookings</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filtersRow}
      >
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
            onPress={() => setFilter(f)}
            accessibilityRole="button"
            accessibilityLabel={f}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.centerState}>
          <Text style={styles.emptyText}>{error}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.primary} />
          }
        >
          {filtered.length === 0 ? (
            <View style={styles.centerState}>
              <Ionicons name="calendar-outline" size={32} color={Colors.textMuted} />
              <Text style={styles.emptyText}>No {filter.toLowerCase()} bookings.</Text>
            </View>
          ) : (
            filtered.map((booking) => {
              const actions = ACTIONS_FOR_STATUS[booking.status] || [];
              return (
                <View key={booking.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.serviceName}>{booking.service_name}</Text>
                    <View
                      style={[
                        styles.statusPill,
                        { backgroundColor: (STATUS_COLOR[booking.status] || Colors.textMuted) + '22' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          { color: STATUS_COLOR[booking.status] || Colors.textMuted },
                        ]}
                      >
                        {booking.status}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.meta}>
                    {booking.date} {booking.time ? `· ${booking.time}` : ''}
                  </Text>
                  {!!booking.notes && <Text style={styles.notes}>{`"${booking.notes}"`}</Text>}
                  <Text style={styles.amount}>{formatCurrency(booking.total_amount)}</Text>

                  {(() => {
                    const paymentMeta = getPaymentStatusMeta(derivePaymentStatus(booking, transactions));
                    return (
                      <View
                        style={[
                          styles.paymentPill,
                          { backgroundColor: `${PAYMENT_TONE_COLOR[paymentMeta.tone]}18` },
                        ]}
                      >
                        <Ionicons
                          name="shield-checkmark-outline"
                          size={12}
                          color={PAYMENT_TONE_COLOR[paymentMeta.tone]}
                        />
                        <Text style={[styles.paymentPillText, { color: PAYMENT_TONE_COLOR[paymentMeta.tone] }]}>
                          {paymentMeta.label}
                        </Text>
                      </View>
                    );
                  })()}

                  {actions.length > 0 && (
                    <View style={styles.actionsRow}>
                      {actions.map((action) => (
                        <TouchableOpacity
                          key={action.label}
                          style={[
                            styles.actionBtn,
                            action.destructive && styles.actionBtnDestructive,
                          ]}
                          onPress={() => handleAction(booking, action.next, action.destructive)}
                          disabled={updatingId === booking.id}
                          accessibilityRole="button"
                          accessibilityLabel={action.label}
                        >
                          {updatingId === booking.id ? (
                            <ActivityIndicator size="small" color={Colors.text} />
                          ) : (
                            <Text
                              style={[
                                styles.actionBtnText,
                                action.destructive && styles.actionBtnTextDestructive,
                              ]}
                            >
                              {action.label}
                            </Text>
                          )}
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  title: { fontSize: FontSizes.xxl, fontWeight: 'bold', color: Colors.text },
  filtersRow: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md, gap: Spacing.sm },
  filterChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterText: { fontSize: FontSizes.sm, color: Colors.text, fontWeight: '600' },
  filterTextActive: { color: Colors.text },
  centerState: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.sm, paddingTop: Spacing.xxl },
  emptyText: { fontSize: FontSizes.sm, color: Colors.textSecondary },
  list: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  serviceName: { fontSize: FontSizes.md, fontWeight: '700', color: Colors.text },
  statusPill: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.full },
  statusText: { fontSize: FontSizes.xs, fontWeight: '700', textTransform: 'capitalize' },
  meta: { fontSize: FontSizes.sm, color: Colors.textSecondary, marginBottom: 4 },
  notes: { fontSize: FontSizes.xs, color: Colors.textMuted, marginBottom: 4, fontStyle: 'italic' },
  amount: { fontSize: FontSizes.md, fontWeight: '700', color: Colors.primary, marginBottom: Spacing.sm },
  paymentPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.sm,
  },
  paymentPillText: { fontSize: FontSizes.xs, fontWeight: '600' },
  actionsRow: { flexDirection: 'row', gap: Spacing.sm },
  actionBtn: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.sm,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  actionBtnDestructive: { backgroundColor: Colors.surfaceLight, borderWidth: 1, borderColor: Colors.error },
  actionBtnText: { fontSize: FontSizes.sm, fontWeight: '700', color: Colors.text },
  actionBtnTextDestructive: { color: Colors.error },
});
