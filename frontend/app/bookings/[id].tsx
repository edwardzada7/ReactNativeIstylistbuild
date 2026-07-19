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
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!booking) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centerState}>
          <Ionicons name="alert-circle-outline" size={48} color={Colors.warning} />
          <Text style={styles.notFoundTitle}>Booking Not Found</Text>
          <Text style={styles.notFoundText}>{error || 'This booking does not exist or you do not have access to it.'}</Text>
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
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Booking Details</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Status Card */}
        <View style={styles.card}>
          <View style={styles.statusRow}>
            <View style={styles.statusLeft}>
              <Ionicons name={STATUS_ICON[booking.status] || 'help-circle-outline'} size={32} color={Colors.primary} />
              <View>
                <Text style={styles.cardLabel}>Status</Text>
                <Text style={styles.statusBadgeText}>{formatStatusLabel(booking.status)}</Text>
              </View>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.cardLabel}>Booking ID</Text>
              <Text style={styles.bookingIdText}>#{booking.id}</Text>
            </View>
          </View>
        </View>

        {/* Person Info Card */}
        <View style={styles.card}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={styles.cardTitle}>{isProvider ? 'Customer' : 'Provider'}</Text>
              <Text style={styles.personName}>{isProvider ? booking.customer_name || 'Customer' : booking.provider_name}</Text>
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
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Appointment</Text>
          <View style={styles.rowGap}>
            <Ionicons name="calendar-outline" size={18} color={Colors.primary} />
            <Text style={styles.rowText}>{formatDate(booking.date)}</Text>
          </View>
          <View style={styles.rowGap}>
            <Ionicons name="time-outline" size={18} color={Colors.primary} />
            <Text style={styles.rowText}>{formatTime(booking.time)}</Text>
          </View>
        </View>

        {/* Services Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Services</Text>
          {services ? (
            <>
              {services.map((s, idx) => (
                <View key={s.service_id ?? idx} style={styles.serviceLine}>
                  <View>
                    <Text style={styles.serviceName}>{s.service_name}</Text>
                    {!!s.duration_minutes && <Text style={styles.serviceMeta}>{s.duration_minutes} minutes</Text>}
                  </View>
                  {s.price != null && <Text style={styles.servicePrice}>{formatCurrency(s.price)}</Text>}
                </View>
              ))}
              <View style={styles.totalLine}>
                <View>
                  <Text style={styles.totalLabel}>Total</Text>
                  {!!booking.total_duration && (
                    <Text style={styles.serviceMeta}>{booking.total_duration} minutes total</Text>
                  )}
                </View>
                <Text style={styles.totalValue}>{formatCurrency(booking.total_amount)}</Text>
              </View>
            </>
          ) : (
            <View style={styles.serviceLine}>
              <Text style={styles.serviceName}>{booking.service_name}</Text>
              <Text style={styles.servicePrice}>{formatCurrency(booking.total_amount)}</Text>
            </View>
          )}
        </View>

        {/* Notes Card */}
        {!!booking.notes && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Notes</Text>
            <Text style={styles.rowText}>{booking.notes}</Text>
          </View>
        )}

        {/* Actions Card */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Actions</Text>
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
            !canProviderCancel && <Text style={styles.rowText}>No actions available for this booking.</Text>}
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
    backgroundColor: `${Colors.primary}18`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: { flex: 1, backgroundColor: Colors.background },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl, gap: Spacing.md },
  notFoundTitle: { fontSize: FontSizes.lg, fontWeight: '700', color: Colors.text, marginTop: Spacing.sm },
  notFoundText: { fontSize: FontSizes.sm, color: Colors.textSecondary, textAlign: 'center', marginBottom: Spacing.md },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.primary,
  },
  headerTitle: { fontSize: FontSizes.lg, fontWeight: '700', color: Colors.text },
  content: { padding: Spacing.lg, gap: Spacing.md },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  cardTitle: { fontSize: FontSizes.sm, fontWeight: '700', color: Colors.text },
  cardLabel: { fontSize: FontSizes.xs, color: Colors.textSecondary },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  statusBadgeText: { fontSize: FontSizes.md, fontWeight: '700', color: Colors.text },
  bookingIdText: { fontSize: FontSizes.md, fontWeight: '700', color: Colors.text },
  personName: { fontSize: FontSizes.lg, fontWeight: '700', color: Colors.text },
  rowGap: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  rowText: { fontSize: FontSizes.sm, color: Colors.text, fontWeight: '500' },
  serviceLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
  },
  serviceName: { fontSize: FontSizes.sm, fontWeight: '600', color: Colors.text },
  serviceMeta: { fontSize: FontSizes.xs, color: Colors.textMuted },
  servicePrice: { fontSize: FontSizes.sm, fontWeight: '700', color: Colors.primary },
  totalLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: `${Colors.primary}10`,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    marginTop: Spacing.xs,
  },
  totalLabel: { fontSize: FontSizes.sm, fontWeight: '700', color: Colors.text },
  totalValue: { fontSize: FontSizes.lg, fontWeight: '800', color: Colors.primary },
  actionSpacing: { marginBottom: Spacing.sm },
});
