import React, { useEffect, useMemo, useState } from 'react';
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
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors, FontSizes, Spacing, BorderRadius } from '../../src/constants/theme';
import { Button } from '../../src/components/common';
import { providerService } from '../../src/services/provider.service';
import { bookingService } from '../../src/services/booking.service';
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
  const [error, setError] = useState<string | null>(null);

  const days = useMemo(() => buildNextDays(NEXT_DAYS), []);

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
      if (!providerId) return;
      setSlotsLoading(true);
      setSelectedSlot(null);
      try {
        const dateStr = selectedDate.toISOString().slice(0, 10);
        const slotList = await providerService.getAvailableSlots(providerId, dateStr);
        setSlots(slotList);
      } catch {
        setSlots([]);
      } finally {
        setSlotsLoading(false);
      }
    })();
  }, [providerId, selectedDate]);

  const handleConfirm = async () => {
    if (!provider || !selectedService || !selectedSlot) {
      Alert.alert('Incomplete', 'Please select a service and time slot.');
      return;
    }
    setSubmitting(true);
    try {
      await bookingService.createBooking({
        provider_id: provider.id,
        service_id: selectedService.id,
        scheduled_at: combineDateAndSlot(selectedDate, selectedSlot),
        notes: notes.trim() || undefined,
      });
      setConfirmed(true);
    } catch (err: any) {
      Alert.alert('Booking Failed', err?.friendlyMessage || 'Could not create this booking.');
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
          <View style={styles.successIcon}>
            <Ionicons name="checkmark" size={48} color={Colors.text} />
          </View>
          <Text style={styles.successTitle}>Booking Confirmed!</Text>
          <Text style={styles.successSubtitle}>
            Your booking with {provider?.business_name} has been sent. You will be notified once it
            is confirmed.
          </Text>
          <Button
            title="View My Bookings"
            onPress={() => router.replace('/(tabs)/bookings')}
            fullWidth
            size="large"
          />
          <TouchableOpacity
            style={{ marginTop: Spacing.md }}
            onPress={() => router.replace('/(tabs)')}
            accessibilityRole="button"
            accessibilityLabel="Back to Home"
          >
            <Text style={styles.linkText}>Back to Home</Text>
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
              <Text style={styles.summaryLabel}>Date</Text>
              <Text style={styles.summaryValue}>{selectedDate.toDateString()}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Time</Text>
              <Text style={styles.summaryValue}>{selectedSlot || '-'}</Text>
            </View>
            <View style={[styles.summaryRow, { marginTop: Spacing.sm }]}>
              <Text style={styles.summaryTotalLabel}>Total</Text>
              <Text style={styles.summaryTotalValue}>{formatCurrency(selectedService.price)}</Text>
            </View>
          </View>
        )}

        <View style={{ height: Spacing.xl }} />
        <Button
          title="Proceed to Payment"
          onPress={handleConfirm}
          loading={submitting}
          disabled={!selectedSlot}
          fullWidth
          size="large"
        />
        <Text style={styles.paymentNote}>
          Payment via Flutterwave will be enabled in the next phase. Confirming now reserves your slot.
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
