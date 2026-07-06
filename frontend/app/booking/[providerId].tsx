import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Colors, FontSizes, Spacing, BorderRadius } from '../../src/constants/theme';
import { Button } from '../../src/components/common';
import { providerService } from '../../src/services/provider.service';
import { bookingService } from '../../src/services/booking.service';
import { walletService } from '../../src/services/wallet.service';
import { useAuth } from '../../src/contexts/AuthContext';
import { formatCurrency } from '../../src/utils/currency';
import { Provider, Service } from '../../src/types';

const NEXT_DAYS = 14;

function buildNextDays(count: number) {
  const days = [];
  for (let i = 0; i < count; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    days.push(d);
  }
  return days;
}

/** Combines a date (YYYY-MM-DD) with a slot value that may already be a full
 * ISO datetime, or just a time string like "10:00" / "10:00 AM". */
function combineDateAndSlot(date: Date, slot: string): string {
  if (/^\d{4}-\d{2}-\d{2}T/.test(slot)) return slot; // already ISO
  const match = slot.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  const result = new Date(date);
  if (match) {
    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const meridian = match[3]?.toUpperCase();
    if (meridian === 'PM' && hours < 12) hours += 12;
    if (meridian === 'AM' && hours === 12) hours = 0;
    result.setHours(hours, minutes, 0, 0);
  }
  return result.toISOString();
}

export default function CreateBooking() {
  const router = useRouter();
  const { user } = useAuth();
  const { providerId, serviceId } = useLocalSearchParams<{
    providerId: string;
    serviceId?: string;
  }>();

  const [provider, setProvider] = useState<Provider | null>(null);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [slots, setSlots] = useState<string[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [paymentOutcome, setPaymentOutcome] = useState<'paid' | 'payment_failed' | null>(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const [walletChecked, setWalletChecked] = useState(false);
  const [autoCompleting, setAutoCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failedBookingId, setFailedBookingId] = useState<string | null>(null);

  // Set right before navigating to Top Up so we know to auto-complete this
  // exact booking attempt (no re-selecting service/date/time) once the
  // customer returns with a sufficient balance - fulfills "without forcing
  // the customer to restart the booking".
  const awaitingTopUpRef = useRef(false);

  const days = useMemo(() => buildNextDays(NEXT_DAYS), []);
  const hasSufficientBalance = selectedService ? walletBalance >= selectedService.price : true;

  useEffect(() => {
    (async () => {
      if (!providerId) return;
      try {
        const profile = await providerService.getProviderFullProfile(providerId);
        setProvider(profile);
        const preselected = profile.services.find((s) => s.id === serviceId);
        setSelectedService(preselected || profile.services[0] || null);
      } catch (err: any) {
        setError(err?.friendlyMessage || 'Could not load this provider.');
      } finally {
        setLoading(false);
      }
    })();
  }, [providerId, serviceId]);

  useEffect(() => {
    (async () => {
      if (!providerId || !selectedService) return;
      setSlotsLoading(true);
      setSelectedSlot(null);
      try {
        const dateStr = selectedDate.toISOString().slice(0, 10);
        const slotList = await providerService.getAvailableSlots(
          providerId,
          dateStr,
          selectedService.duration || 30
        );
        setSlots(slotList);
      } catch {
        setSlots([]);
      } finally {
        setSlotsLoading(false);
      }
    })();
  }, [providerId, selectedDate, selectedService]);

  // Real contract: wallet balance comes from GET /api/wallets (see
  // wallet.service.ts). Fetched up-front so the Booking Summary can show
  // "Wallet Balance" / "Escrow Amount" and gate whether "Confirm Booking"
  // or the insufficient-balance panel is shown - never a locally invented
  // balance.
  const refreshWallet = useCallback(async () => {
    if (!user?.auth_id) return 0;
    try {
      const wallet = await walletService.getWallet(user.auth_id);
      const balance = wallet?.balance ?? 0;
      setWalletBalance(balance);
      return balance;
    } catch {
      return walletBalance;
    } finally {
      setWalletChecked(true);
    }
  }, [user?.auth_id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleConfirm = async () => {
    if (!provider || !selectedService || !selectedSlot) {
      Alert.alert('Incomplete', 'Please select a service and time slot.');
      return;
    }
    setSubmitting(true);
    setAutoCompleting(false);
    try {
      const booking = await bookingService.createBooking({
        provider_id: provider.id,
        service_id: selectedService.id,
        scheduled_at: combineDateAndSlot(selectedDate, selectedSlot),
        notes: notes.trim() || undefined,
      });

      // Booking Payment Flow: pay from the wallet immediately, moving the
      // funds into escrow (see POST /api/bookings/{id}/pay-with-wallet -
      // there is no separate per-booking Flutterwave checkout endpoint on
      // the production API; Top Up Wallet is the only place Flutterwave is
      // used, per product spec).
      try {
        await bookingService.payWithWallet(booking.id);
        setPaymentOutcome('paid');
      } catch (payErr: any) {
        console.error('[booking] pay-with-wallet failed', payErr);
        setPaymentOutcome('payment_failed');
        setFailedBookingId(booking.id);
      }
      setConfirmed(true);
    } catch (err: any) {
      Alert.alert('Booking Failed', err?.friendlyMessage || 'Could not create this booking.');
    } finally {
      setSubmitting(false);
      awaitingTopUpRef.current = false;
    }
  };

  // Refresh the wallet balance every time this screen regains focus -
  // covers the customer returning from Top Up Wallet. If they had tapped
  // "Top Up Wallet" from here (awaitingTopUpRef) and the balance is now
  // sufficient, automatically complete the exact same booking attempt.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const balance = await refreshWallet();
        if (!active) return;
        if (
          awaitingTopUpRef.current &&
          !confirmed &&
          selectedService &&
          balance >= selectedService.price
        ) {
          awaitingTopUpRef.current = false;
          setAutoCompleting(true);
          await handleConfirm();
          if (active) setAutoCompleting(false);
        }
      })();
      return () => {
        active = false;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [refreshWallet, selectedService, confirmed])
  );

  const handlePrimaryPress = () => {
    if (!selectedService || !selectedSlot) {
      Alert.alert('Incomplete', 'Please select a service and time slot.');
      return;
    }
    if (walletBalance >= selectedService.price) {
      handleConfirm();
    } else {
      awaitingTopUpRef.current = true;
      router.push('/wallet/topup');
    }
  };

  const handleRetryPayment = async () => {
    if (!failedBookingId) return;
    setSubmitting(true);
    try {
      await bookingService.payWithWallet(failedBookingId);
      setPaymentOutcome('paid');
    } catch (err: any) {
      Alert.alert('Payment Failed', err?.friendlyMessage || 'Could not process payment.');
    } finally {
      setSubmitting(false);
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

  if (confirmed) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centerState}>
          <View
            style={[
              styles.successIcon,
              paymentOutcome === 'payment_failed' && { backgroundColor: Colors.error },
            ]}
          >
            <Ionicons
              name={paymentOutcome === 'paid' ? 'checkmark' : 'alert'}
              size={48}
              color={Colors.text}
            />
          </View>
          <Text style={styles.successTitle}>
            {paymentOutcome === 'paid' ? 'Booking Confirmed - Paid (Escrow)' : 'Payment Could Not Be Completed'}
          </Text>
          <Text style={styles.successSubtitle}>
            {paymentOutcome === 'paid' &&
              `Your booking with ${provider?.business_name} is paid and securely held in escrow until the service is completed. ${provider?.business_name} has been notified.`}
            {paymentOutcome === 'payment_failed' &&
              `Your booking with ${provider?.business_name} was created, but payment from your wallet failed. Please retry or top up your wallet.`}
          </Text>
          {paymentOutcome === 'payment_failed' && (
            <>
              <Button
                title="Retry Payment"
                onPress={handleRetryPayment}
                loading={submitting}
                fullWidth
                size="large"
              />
              <View style={{ height: Spacing.sm }} />
              <Button
                title="Top Up Wallet"
                variant="outline"
                onPress={() => router.push('/wallet/topup')}
                fullWidth
                size="large"
              />
            </>
          )}
          <TouchableOpacity
            style={{ marginTop: Spacing.md }}
            onPress={() => router.replace('/(tabs)/bookings')}
            accessibilityRole="button"
            accessibilityLabel="View my bookings"
          >
            <Text style={styles.linkText}>View My Bookings</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !provider) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centerState}>
          <Text style={styles.emptyText}>{error || 'Provider not found.'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Book Appointment</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.providerName}>{provider.business_name}</Text>

        {/* Service selection */}
        <Text style={styles.sectionTitle}>Select Service</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.lg }}>
          {provider.services.map((service) => (
            <TouchableOpacity
              key={service.id}
              style={[
                styles.serviceChip,
                selectedService?.id === service.id && styles.serviceChipActive,
              ]}
              onPress={() => setSelectedService(service)}
              accessibilityRole="button"
              accessibilityLabel={service.name}
            >
              <Text
                style={[
                  styles.serviceChipText,
                  selectedService?.id === service.id && styles.serviceChipTextActive,
                ]}
              >
                {service.name}
              </Text>
              <Text
                style={[
                  styles.serviceChipPrice,
                  selectedService?.id === service.id && styles.serviceChipTextActive,
                ]}
              >
                {formatCurrency(service.price)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Date selection */}
        <Text style={styles.sectionTitle}>Select Date</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.lg }}>
          {days.map((d) => {
            const isSelected = d.toDateString() === selectedDate.toDateString();
            return (
              <TouchableOpacity
                key={d.toISOString()}
                style={[styles.dateChip, isSelected && styles.dateChipActive]}
                onPress={() => setSelectedDate(d)}
                accessibilityRole="button"
                accessibilityLabel={d.toDateString()}
              >
                <Text style={[styles.dateChipDay, isSelected && styles.serviceChipTextActive]}>
                  {d.toLocaleDateString('en-US', { weekday: 'short' })}
                </Text>
                <Text style={[styles.dateChipDate, isSelected && styles.serviceChipTextActive]}>
                  {d.getDate()}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Time slots */}
        <Text style={styles.sectionTitle}>Select Time</Text>
        {slotsLoading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginBottom: Spacing.lg }} />
        ) : slots.length === 0 ? (
          <Text style={styles.emptyInline}>No available slots on this date. Try another day.</Text>
        ) : (
          <View style={styles.slotsWrap}>
            {slots.map((slot) => (
              <TouchableOpacity
                key={slot}
                style={[styles.slotChip, selectedSlot === slot && styles.slotChipActive]}
                onPress={() => setSelectedSlot(slot)}
                accessibilityRole="button"
                accessibilityLabel={slot}
              >
                <Text
                  style={[styles.slotChipText, selectedSlot === slot && styles.serviceChipTextActive]}
                >
                  {slot}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Notes */}
        <Text style={[styles.sectionTitle, { marginTop: Spacing.lg }]}>Notes (optional)</Text>
        <TextInput
          style={styles.notesInput}
          placeholder="Any special requests..."
          placeholderTextColor={Colors.textMuted}
          value={notes}
          onChangeText={setNotes}
          multiline
        />

        {/* Summary */}
        {selectedService && (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Booking Summary</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Service</Text>
              <Text style={styles.summaryValue}>{selectedService.name}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Provider</Text>
              <Text style={styles.summaryValue}>{provider.business_name}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Date</Text>
              <Text style={styles.summaryValue}>{selectedDate.toDateString()}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Time</Text>
              <Text style={styles.summaryValue}>{selectedSlot || '-'}</Text>
            </View>
            <View style={[styles.summaryRow, { marginTop: Spacing.sm }]}>
              <Text style={styles.summaryTotalLabel}>Price</Text>
              <Text style={styles.summaryTotalValue}>{formatCurrency(selectedService.price)}</Text>
            </View>

            <View style={styles.summaryDivider} />

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Wallet Balance</Text>
              <Text style={[styles.summaryValue, !hasSufficientBalance && { color: Colors.error }]}>
                {walletChecked ? formatCurrency(walletBalance) : '...'}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Escrow Amount</Text>
              <Text style={styles.summaryValue}>{formatCurrency(selectedService.price)}</Text>
            </View>

            <View style={styles.protectionNote}>
              <Ionicons name="shield-checkmark" size={16} color={Colors.success} />
              <Text style={styles.protectionNoteText}>
                Your payment is securely held in escrow until the service has been completed.
              </Text>
            </View>
          </View>
        )}

        <View style={{ height: Spacing.xl }} />

        {autoCompleting && (
          <View style={styles.autoCompletingBanner}>
            <ActivityIndicator size="small" color={Colors.primary} />
            <Text style={styles.autoCompletingText}>Wallet topped up - completing your booking...</Text>
          </View>
        )}

        {hasSufficientBalance ? (
          <Button
            title="Confirm Booking"
            onPress={handlePrimaryPress}
            loading={submitting || autoCompleting}
            disabled={!selectedSlot}
            fullWidth
            size="large"
          />
        ) : (
          <View style={styles.insufficientPanel}>
            <View style={styles.insufficientHeader}>
              <Ionicons name="alert-circle" size={20} color={Colors.warning} />
              <Text style={styles.insufficientTitle}>Your wallet balance is insufficient.</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Current Wallet Balance</Text>
              <Text style={styles.summaryValue}>{formatCurrency(walletBalance)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Required Amount</Text>
              <Text style={styles.summaryValue}>{formatCurrency(selectedService?.price || 0)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Shortfall</Text>
              <Text style={[styles.summaryValue, { color: Colors.error }]}>
                {formatCurrency(Math.max(0, (selectedService?.price || 0) - walletBalance))}
              </Text>
            </View>
            <Button
              title="Top Up Wallet"
              onPress={handlePrimaryPress}
              disabled={!selectedSlot}
              fullWidth
              size="large"
              style={styles.topUpFromSummaryButton}
            />
          </View>
        )}
        <Text style={styles.paymentNote}>
          Booking payment is made from your iStylist wallet only - Top Up Wallet uses Flutterwave.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centerState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  emptyText: { fontSize: FontSizes.sm, color: Colors.textSecondary, textAlign: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  title: { fontSize: FontSizes.lg, fontWeight: 'bold', color: Colors.text },
  content: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl },
  providerName: { fontSize: FontSizes.md, color: Colors.textSecondary, marginBottom: Spacing.lg },
  sectionTitle: { fontSize: FontSizes.md, fontWeight: '700', color: Colors.text, marginBottom: Spacing.sm },
  serviceChip: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginRight: Spacing.sm,
    minWidth: 130,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  serviceChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  serviceChipText: { fontSize: FontSizes.sm, fontWeight: '600', color: Colors.text },
  serviceChipPrice: { fontSize: FontSizes.xs, color: Colors.textSecondary, marginTop: 4 },
  serviceChipTextActive: { color: Colors.text },
  dateChip: {
    width: 56,
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    marginRight: Spacing.sm,
  },
  dateChipActive: { backgroundColor: Colors.primary },
  dateChipDay: { fontSize: FontSizes.xs, color: Colors.textSecondary },
  dateChipDate: { fontSize: FontSizes.md, fontWeight: '700', color: Colors.text, marginTop: 2 },
  emptyInline: { fontSize: FontSizes.sm, color: Colors.textMuted, marginBottom: Spacing.lg },
  slotsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.lg },
  slotChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  slotChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  slotChipText: { fontSize: FontSizes.sm, color: Colors.text, fontWeight: '600' },
  notesInput: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    color: Colors.text,
    fontSize: FontSizes.sm,
    minHeight: 70,
    textAlignVertical: 'top',
    marginBottom: Spacing.lg,
  },
  summaryCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
  },
  summaryTitle: { fontSize: FontSizes.md, fontWeight: '700', color: Colors.text, marginBottom: Spacing.sm },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  summaryLabel: { fontSize: FontSizes.sm, color: Colors.textSecondary },
  summaryValue: { fontSize: FontSizes.sm, color: Colors.text, fontWeight: '600' },
  summaryTotalLabel: { fontSize: FontSizes.md, fontWeight: '700', color: Colors.text },
  summaryTotalValue: { fontSize: FontSizes.md, fontWeight: '700', color: Colors.primary },
  summaryDivider: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.sm },
  protectionNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    backgroundColor: `${Colors.success}15`,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    marginTop: Spacing.sm,
  },
  protectionNoteText: { flex: 1, fontSize: FontSizes.xs, color: Colors.textSecondary, lineHeight: 16 },
  autoCompletingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: `${Colors.primary}15`,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  autoCompletingText: { fontSize: FontSizes.sm, color: Colors.text, fontWeight: '600' },
  insufficientPanel: {
    backgroundColor: `${Colors.warning}12`,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: `${Colors.warning}40`,
  },
  insufficientHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  insufficientTitle: { flex: 1, fontSize: FontSizes.sm, fontWeight: '700', color: Colors.text },
  topUpFromSummaryButton: { marginTop: Spacing.md },
  paymentNote: {
    fontSize: FontSizes.xs,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  successIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.success,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  successTitle: { fontSize: FontSizes.xl, fontWeight: 'bold', color: Colors.text, marginBottom: Spacing.sm },
  successSubtitle: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  linkText: { fontSize: FontSizes.sm, color: Colors.primary, fontWeight: '600' },
});
