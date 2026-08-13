// Booking Details screen. GROUND TRUTH (Phase 6.3 - verified against
// production web app source, frontend/src/screens/BookingDetailsScreen.jsx):
// mirrors the web's exact sections (Status, Person Info, Date & Time,
// Services, Notes, Actions) and exact action-visibility flags. The web
// screen has NO "escrow" or "wallet transaction reference" section/field
// anywhere - it was verified absent in the source, so none is invented
// here either.
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Colors, FontSizes, Spacing, BorderRadius } from '../../src/constants/theme';
import { Button } from '../../src/components/common';
import { bookingService } from '../../src/services/booking.service';
import { walletService } from '../../src/services/wallet.service';
import { useAuth } from '../../src/contexts/AuthContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { formatCurrency } from '../../src/utils/currency';
import { formatStatusLabel } from '../../src/utils/walletHelpers';
import { Booking } from '../../src/types';

// Matches web's formatDate exactly (booking_date is "YYYY-MM-DD").
function formatDate(dateStr?: string) {
  if (!dateStr) return 'Date TBD';
  const date = new Date(`${dateStr}T00:00:00`);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

// Matches web's formatTime exactly (booking_time is a raw "HH:MM" string).
function formatTime(timeStr?: string) {
  if (!timeStr) return 'Time TBD';
  const parts = timeStr.split(':');
  const hours = parseInt(parts[0], 10);
  const minutes = parts[1];
  if (isNaN(hours)) return timeStr;
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes} ${ampm}`;
}

const STATUS_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  pending_payment: 'time-outline',
  pending: 'time-outline',
  confirmed: 'checkmark-circle-outline',
  completed: 'checkmark-done-circle-outline',
  canceled: 'close-circle-outline',
  declined: 'close-circle-outline',
  no_show_pending: 'alert-circle-outline',
  user_no_show: 'alert-circle-outline',
  provider_no_show: 'alert-circle-outline',
  disputed: 'warning-outline',
};

export default function BookingDetails() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { colors } = useTheme();
  const isProvider = user?.role === 'provider';
  const role: 'customer' | 'provider' = isProvider ? 'provider' : 'customer';

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBooking = useCallback(async () => {
    if (!id) return;
    try {
      setError(null);
      const data = await bookingService.getBooking(String(id), role);
      setBooking(data);
    } catch (err: any) {
      setError(err?.friendlyMessage || 'This booking does not exist or you do not have access to it.');
    } finally {
      setLoading(false);
    }
  }, [id, role]);

  useFocusEffect(
    useCallback(() => {
      fetchBooking();
    }, [fetchBooking])
  );

  const handleBack = () => {
    router.replace(isProvider ? '/(provider)/bookings' : '/(tabs)/bookings');
  };

  const handleStatusUpdate = async (newStatus: string) => {
    if (!booking) return;
    setUpdating(true);
    try {
      await bookingService.updateBookingStatus(booking.id, newStatus, role, user?.auth_id || '');
      await fetchBooking();
    } catch (err: any) {
      Alert.alert('Error', err?.friendlyMessage || 'Failed to update booking');
    } finally {
      setUpdating(false);
    }
  };

  const handlePayNow = async () => {
    if (!booking || !user?.auth_id) {
      Alert.alert('Error', 'Unable to process payment. Please try again.');
      return;
    }
    setProcessingPayment(true);
    try {
      const wallet = await walletService.getWallet(user.auth_id).catch(() => null);
      if ((wallet?.balance ?? 0) < booking.total_amount) {
        Alert.alert(
          'Insufficient balance',
          `Need ${formatCurrency(booking.total_amount)}, have ${formatCurrency(wallet?.balance ?? 0)}.`,
          [
            { text: 'Not now', style: 'cancel' },
            { text: 'Top Up', onPress: () => router.push('/wallet/topup') },
          ]
        );
        return;
      }
      await bookingService.payWithWallet(booking.id, user.auth_id);
      Alert.alert('Payment Successful', 'Your booking has been confirmed.');
      await fetchBooking();
    } catch (err: any) {
      Alert.alert('Payment Failed', err?.friendlyMessage || 'Payment failed. Please try again.');
    } finally {
      setProcessingPayment(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!booking) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.centerState}>
          <Ionicons name="alert-circle-outline" size={48} color={Colors.warning} />
          <Text style={[styles.notFoundTitle, { color: colors.text }]}>Booking Not Found</Text>
          <Text style={[styles.notFoundText, { color: colors.textSecondary }]}>{error || 'This booking does not exist or you do not have access to it.'}</Text>
          <Button title="Go Back" onPress={handleBack} />
        </View>
      </SafeAreaView>
    );
  }

  // GROUND TRUTH (web BookingDetailsScreen.jsx) - exact action-visibility flags.
  const canCustomerCancel = !isProvider && ['pending', 'confirmed', 'pending_payment'].includes(booking.status);
  const canCustomerPay = !isProvider && booking.status === 'pending_payment';
  const canProviderConfirm = isProvider && booking.status === 'pending';
  const canProviderDecline = isProvider && booking.status === 'pending';
  const canProviderComplete = isProvider && booking.status === 'confirmed';
  const canProviderCancel = isProvider && ['pending', 'confirmed'].includes(booking.status) && booking.status !== 'pending';
  const canRebook = !isProvider && ['completed', 'canceled', 'declined'].includes(booking.status);

  const services = booking.services && booking.services.length > 0 ? booking.services : null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Booking Details</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Status Card */}
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <View style={styles.statusRow}>
            <View style={styles.statusLeft}>
              <Ionicons name={STATUS_ICON[booking.status] || 'help-circle-outline'} size={32} color={Colors.primary} />
              <View>
                <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>Status</Text>
                <Text style={[styles.statusBadgeText, { color: colors.text }]}>{formatStatusLabel(booking.status)}</Text>
              </View>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>Booking ID</Text>
              <Text style={[styles.bookingIdText, { color: colors.text }]}>#{booking.id}</Text>
            </View>
          </View>
        </View>

        {/* Person Info Card */}
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={[styles.cardTitle, { color: colors.text }]}>{isProvider ? 'Customer' : 'Provider'}</Text>
              <Text style={[styles.personName, { color: colors.text }]}>{isProvider ? booking.customer_name || 'Customer' : booking.provider_name}</Text>
            </View>
            {!!(isProvider ? booking.customer_auth_id : booking.provider_auth_id) && (
              <TouchableOpacity
                style={styles.messageBtn}
                onPress={() =>
                  router.push({
                    pathname: '/chat/[counterpartAuthId]',
                    params: {
                      counterpartAuthId: (isProvider ? booking.customer_auth_id : booking.provider_auth_id) as string,
                      counterpartName: isProvider ? booking.customer_name || 'Customer' : booking.provider_name,
                      bookingId: booking.id,
                    },
                  })
                }
                accessibilityRole="button"
                accessibilityLabel="Message"
              >
                <Ionicons name="chatbubble-outline" size={18} color={Colors.primary} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Date & Time Card */}
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Appointment</Text>
          <View style={styles.rowGap}>
            <Ionicons name="calendar-outline" size={18} color={Colors.primary} />
            <Text style={[styles.rowText, { color: colors.text }]}>{formatDate(booking.date)}</Text>
          </View>
          <View style={styles.rowGap}>
            <Ionicons name="time-outline" size={18} color={Colors.primary} />
            <Text style={[styles.rowText, { color: colors.text }]}>{formatTime(booking.time)}</Text>
          </View>
        </View>

        {/* Services Card */}
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Services</Text>
          {services ? (
            <>
              {services.map((s, idx) => (
                <View key={s.service_id ?? idx} style={styles.serviceLine}>
                  <View>
                    <Text style={[styles.serviceName, { color: colors.text }]}>{s.service_name}</Text>
                    {!!s.duration_minutes && <Text style={[styles.serviceMeta, { color: colors.textSecondary }]}>{s.duration_minutes} minutes</Text>}
                  </View>
                  {s.price != null && <Text style={[styles.servicePrice, { color: colors.text }]}>{formatCurrency(s.price)}</Text>}
                </View>
              ))}
              <View style={styles.totalLine}>
                <View>
                  <Text style={[styles.totalLabel, { color: colors.text }]}>Total</Text>
                  {!!booking.total_duration && (
                    <Text style={[styles.serviceMeta, { color: colors.textSecondary }]}>{booking.total_duration} minutes total</Text>
                  )}
                </View>
                <Text style={[styles.totalValue, { color: colors.text }]}>{formatCurrency(booking.total_amount)}</Text>
              </View>
            </>
          ) : (
            <View style={styles.serviceLine}>
              <Text style={[styles.serviceName, { color: colors.text }]}>{booking.service_name}</Text>
              <Text style={[styles.servicePrice, { color: colors.text }]}>{formatCurrency(booking.total_amount)}</Text>
            </View>
          )}
        </View>

        {/* Notes Card */}
        {!!booking.notes && (
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Notes</Text>
            <Text style={[styles.rowText, { color: colors.text }]}>{booking.notes}</Text>
          </View>
        )}

        {/* Actions Card */}
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>Actions</Text>
          <View style={{ height: Spacing.sm }} />

          {canCustomerPay && (
            <Button
              title={`Pay from Wallet - ${formatCurrency(booking.total_amount)}`}
              onPress={handlePayNow}
              loading={processingPayment}
              fullWidth
              style={styles.actionSpacing}
            />
          )}

          {canCustomerCancel && (
            <Button
              title="Cancel Booking"
              variant="outline"
              onPress={() => handleStatusUpdate('canceled')}
              loading={updating}
              fullWidth
              style={styles.actionSpacing}
            />
          )}

          {canRebook && !isProvider && (
            <Button
              title="Book Again"
              variant="outline"
              onPress={() => router.push(`/booking/${booking.provider_id}`)}
              fullWidth
              style={styles.actionSpacing}
            />
          )}

          {canProviderConfirm && (
            <Button
              title="Confirm Booking"
              onPress={() => handleStatusUpdate('confirmed')}
              loading={updating}
              fullWidth
              style={styles.actionSpacing}
            />
          )}

          {canProviderDecline && (
            <Button
              title="Decline Booking"
              variant="outline"
              onPress={() => handleStatusUpdate('declined')}
              loading={updating}
              fullWidth
              style={styles.actionSpacing}
            />
          )}

          {canProviderComplete && (
            <Button
              title="Mark as Completed"
              onPress={() => handleStatusUpdate('completed')}
              loading={updating}
              fullWidth
              style={styles.actionSpacing}
            />
          )}

          {canProviderCancel && (
            <Button
              title="Cancel Booking"
              variant="outline"
              onPress={() => handleStatusUpdate('canceled')}
              loading={updating}
              fullWidth
              style={styles.actionSpacing}
            />
          )}

          {!canCustomerPay &&
            !canCustomerCancel &&
            !canRebook &&
            !canProviderConfirm &&
            !canProviderDecline &&
            !canProviderComplete &&
            !canProviderCancel && <Text style={[styles.rowText, { color: colors.text }]}>No actions available for this booking.</Text>}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  messageBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: { flex: 1 },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl, gap: Spacing.md },
  notFoundTitle: { fontSize: FontSizes.lg, fontWeight: '700', marginTop: Spacing.sm },
  notFoundText: { fontSize: FontSizes.sm, textAlign: 'center', marginBottom: Spacing.md },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  headerTitle: { fontSize: FontSizes.lg, fontWeight: '700' },
  content: { padding: Spacing.lg, gap: Spacing.md },
  card: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  cardTitle: { fontSize: FontSizes.sm, fontWeight: '700' },
  cardLabel: { fontSize: FontSizes.xs },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  statusBadgeText: { fontSize: FontSizes.md, fontWeight: '700' },
  bookingIdText: { fontSize: FontSizes.md, fontWeight: '700' },
  personName: { fontSize: FontSizes.lg, fontWeight: '700' },
  rowGap: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  rowText: { fontSize: FontSizes.sm, fontWeight: '500' },
  serviceLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
  },
  serviceName: { fontSize: FontSizes.sm, fontWeight: '600' },
  serviceMeta: { fontSize: FontSizes.xs },
  servicePrice: { fontSize: FontSizes.sm, fontWeight: '700' },
  totalLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    marginTop: Spacing.xs,
  },
  totalLabel: { fontSize: FontSizes.sm, fontWeight: '700' },
  totalValue: { fontSize: FontSizes.lg, fontWeight: '800' },
  actionSpacing: { marginBottom: Spacing.sm },
});
