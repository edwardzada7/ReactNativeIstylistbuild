import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, ActivityIndicator, Alert, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSizes, Spacing, BorderRadius } from '../../constants/theme';
import { useTheme } from '../../contexts/ThemeContext';
import { bookingService } from '../../services/booking.service';
import { toLocalDateString } from '../../utils/time';

interface Props {
  bookingId: string | number;
  autoOpen?: boolean;
  onChanged?: () => void;
}

/** Ask for a new time, or answer the other side's request. The server enforces every rule. */
export function RescheduleCard({ bookingId, autoOpen = false, onChanged }: Props) {
  const { colors } = useTheme();
  const [state, setState] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(new Date());
  const [slots, setSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [time, setTime] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const days = useMemo(() => Array.from({ length: 21 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return d; }), []);

  const load = useCallback(async () => {
    try {
      const s = await bookingService.rescheduleState(bookingId);
      setState(s);
      return s;
    } catch {
      setState(null);
      return null;
    }
  }, [bookingId]);

  useEffect(() => {
    load().then((s) => {
      if (autoOpen && s?.can_propose) setOpen(true);
    });
  }, [load, autoOpen]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setSlotsLoading(true);
    setTime('');
    bookingService
      .rescheduleSlots(bookingId, toLocalDateString(date))
      .then((list) => !cancelled && setSlots(list))
      .catch(() => !cancelled && setSlots([]))
      .finally(() => !cancelled && setSlotsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [open, date, bookingId]);

  if (!state) return null;
  const pending = state.pending;
  if (!pending && !state.can_propose && !state.reschedules_used) return null;

  const send = async () => {
    if (!time) return;
    setBusy(true);
    try {
      const next = await bookingService.reschedulePropose(bookingId, { new_date: toLocalDateString(date), new_time: time, reason: reason.trim() || undefined });
      setState(next);
      setOpen(false);
      setReason('');
      Alert.alert('Request sent', 'Your booking stays as it is until the other side accepts.');
    } catch (err: any) {
      Alert.alert('Could not send', err?.friendlyMessage || err?.message || 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const respond = async (action: 'accept' | 'decline' | 'cancel') => {
    setBusy(true);
    try {
      const next = await bookingService.rescheduleRespond(bookingId, action);
      setState(next);
      if (action === 'accept') onChanged?.();
    } catch (err: any) {
      Alert.alert('Could not update', err?.friendlyMessage || err?.message || 'Please try again.');
      load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.surface }]}>
      <View style={styles.titleRow}>
        <Ionicons name="calendar-outline" size={18} color={Colors.primary} />
        <Text style={[styles.title, { color: colors.text }]}>Reschedule</Text>
      </View>

      {pending ? (
        <View style={[styles.pending, { borderColor: `${Colors.primary}40`, backgroundColor: `${Colors.primary}10` }]}>
          <Text style={{ color: colors.text }}>
            {pending.awaiting_you ? `${pending.proposed_by_role === 'customer' ? 'The customer' : 'The provider'} asks to move this booking` : 'You asked to move this booking'} from {pending.old_date} {pending.old_time} to {pending.new_date} {pending.new_time}.
          </Text>
          {!!pending.reason && <Text style={{ color: colors.textSecondary, marginTop: 4 }}>"{pending.reason}"</Text>}
          {pending.awaiting_you ? (
            <View style={styles.row}>
              <TouchableOpacity style={[styles.btn, { backgroundColor: Colors.success }]} disabled={busy} onPress={() => respond('accept')} accessibilityRole="button">
                <Text style={styles.btnText}>Accept</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, { borderWidth: 1, borderColor: colors.border }]} disabled={busy} onPress={() => respond('decline')} accessibilityRole="button">
                <Text style={[styles.btnText, { color: colors.text }]}>Decline</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={[styles.btn, { borderWidth: 1, borderColor: colors.border, marginTop: Spacing.sm }]} disabled={busy} onPress={() => respond('cancel')} accessibilityRole="button">
              <Text style={[styles.btnText, { color: colors.text }]}>Withdraw request</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : state.can_propose ? (
        <TouchableOpacity style={[styles.btn, { borderWidth: 1, borderColor: Colors.primary }]} onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel="Reschedule this booking">
          <Text style={[styles.btnText, { color: Colors.primary }]}>Reschedule this booking</Text>
        </TouchableOpacity>
      ) : (
        <Text style={{ color: colors.textSecondary }}>{state.blocked_reason}</Text>
      )}
      <Text style={[styles.note, { color: colors.textSecondary }]}>
        Free up to {state.cutoff_minutes} minutes before the appointment. {state.reschedules_left} of 2 changes left. Your payment stays safely in escrow.
      </Text>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <View style={[styles.sheet, { backgroundColor: colors.background }]}>
            <Text style={[styles.title, { color: colors.text, marginBottom: Spacing.sm }]}>Pick a new time</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.md }}>
              {days.map((d) => {
                const active = toLocalDateString(d) === toLocalDateString(date);
                return (
                  <TouchableOpacity key={d.toISOString()} onPress={() => setDate(d)} style={[styles.dateChip, { backgroundColor: active ? Colors.primary : colors.surface }]} accessibilityRole="button">
                    <Text style={{ color: active ? '#fff' : colors.textSecondary, fontSize: FontSizes.xs }}>{d.toLocaleDateString('en-US', { weekday: 'short' })}</Text>
                    <Text style={{ color: active ? '#fff' : colors.text, fontWeight: '700' }}>{d.getDate()}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            {slotsLoading ? (
              <ActivityIndicator color={Colors.primary} />
            ) : slots.length === 0 ? (
              <Text style={{ color: colors.textSecondary }}>No open times on this day. Try another date.</Text>
            ) : (
              <View style={styles.slots}>
                {slots.map((t) => (
                  <TouchableOpacity key={t} onPress={() => setTime(t)} style={[styles.slot, { borderColor: colors.border, backgroundColor: time === t ? Colors.primary : colors.surface }]} accessibilityRole="button">
                    <Text style={{ color: time === t ? '#fff' : colors.text }}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text }]}
              placeholder="Reason (optional)"
              placeholderTextColor={colors.textSecondary}
              value={reason}
              onChangeText={setReason}
              maxLength={300}
            />
            <View style={styles.row}>
              <TouchableOpacity style={[styles.btn, { borderWidth: 1, borderColor: colors.border }]} onPress={() => setOpen(false)} accessibilityRole="button">
                <Text style={[styles.btnText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, { backgroundColor: Colors.primary, opacity: !time || busy ? 0.5 : 1 }]} disabled={!time || busy} onPress={send} accessibilityRole="button">
                <Text style={styles.btnText}>{busy ? 'Sending...' : 'Send request'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.sm },
  title: { fontSize: FontSizes.md, fontWeight: '700' },
  pending: { borderWidth: 1, borderRadius: BorderRadius.md, padding: Spacing.sm },
  row: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  btn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: BorderRadius.md },
  btnText: { color: '#fff', fontWeight: '600' },
  note: { fontSize: FontSizes.xs, marginTop: Spacing.sm },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { padding: Spacing.lg, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '85%' },
  dateChip: { width: 52, alignItems: 'center', paddingVertical: 8, borderRadius: BorderRadius.md, marginRight: 8 },
  slots: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: Spacing.md },
  slot: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  input: { borderRadius: BorderRadius.md, padding: Spacing.sm, minHeight: 44 },
});
