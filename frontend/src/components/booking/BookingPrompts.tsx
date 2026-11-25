import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, KeyboardAvoidingView, Modal, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, FontSizes, Spacing, BorderRadius } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import { bookingService } from '../../services/booking.service';
import { reviewService } from '../../services/review.service';

const POLL_MS = 60000;

type Item = { type: string; booking_id: number; title: string; message: string; reason?: string; provider_id?: string };

/**
 * Global popup for the booking lifecycle: "Was your service completed?", provider "completed / no-show",
 * "file a no-show" and "review this service". Polls quietly and on app resume.
 */
export function BookingPrompts() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const authId = String(user?.auth_id ?? '');
  const role: 'customer' | 'provider' = user?.role === 'provider' ? 'provider' : 'customer';

  const [item, setItem] = useState<Item | null>(null);
  const [mode, setMode] = useState<'main' | 'reason'>('main');
  const [answer, setAnswer] = useState<'no' | 'noshow' | null>(null);
  const [reason, setReason] = useState('');
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const dismissed = useRef<Set<string>>(new Set());
  const busyRef = useRef(false);
  const itemRef = useRef<Item | null>(null);
  itemRef.current = item;

  const load = useCallback(async () => {
    if (!authId || busyRef.current || itemRef.current) return;
    try {
      const items = await bookingService.pendingActions(authId, role);
      const next = items.find((i) => !dismissed.current.has(`${i.type}_${i.booking_id}`)) || null;
      if (next && !itemRef.current) setItem(next);
    } catch {
      /* best-effort */
    }
  }, [authId, role]);

  useEffect(() => {
    if (!isAuthenticated || !authId) { setItem(null); return undefined; }
    void load();
    const t = setInterval(() => void load(), POLL_MS);
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') void load(); });
    return () => { clearInterval(t); sub.remove(); };
  }, [isAuthenticated, authId, load]);

  const close = (dismiss = true) => {
    if (item && dismiss) dismissed.current.add(`${item.type}_${item.booking_id}`);
    setItem(null); setMode('main'); setAnswer(null); setReason(''); setComment(''); setRating(5);
    setTimeout(() => void load(), 500);
  };

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); busyRef.current = true;
    try { await fn(); }
    catch (e: any) { Alert.alert('Error', e?.friendlyMessage || e?.message || 'Something went wrong. Please try again.'); }
    finally { setBusy(false); busyRef.current = false; }
  };

  if (!item) return null;
  const id = item.booking_id;

  const yes = () => run(async () => {
    const r = await bookingService.customerConfirm(id, authId, true);
    close(false);
    Alert.alert('Thank you', r?.message || 'Payment released to your provider.');
  });
  const submitNo = () => run(async () => {
    const r = await bookingService.customerConfirm(id, authId, false, reason.trim());
    close(false);
    Alert.alert('Payment on hold', r?.message || 'File a no-show to resolve it.');
  });
  const providerCompleted = () => run(async () => {
    await bookingService.updateBookingStatus(String(id), 'completed', 'provider', authId);
    close(false);
    Alert.alert('Marked completed', 'Payment is released once the customer confirms, or automatically 24 hours after the session ends.');
  });
  const reportNoShow = () => run(async () => {
    await bookingService.reportNoShow(id, authId, reason.trim());
    close(false);
    Alert.alert('No-show reported', 'The other side has a short time to respond or dispute.');
  });
  const submitReview = () => run(async () => {
    await reviewService.createReview({ booking_id: String(id), rating, comment: comment.trim() || undefined, provider_id: item.provider_id } as any);
    close(false);
    Alert.alert('Thank you', 'Your review was submitted.');
  });

  const Btn = ({ label, onPress, kind = 'primary' }: { label: string; onPress: () => void; kind?: 'primary' | 'outline' | 'ghost' }) => (
    <TouchableOpacity
      style={[styles.btn, kind === 'outline' && styles.btnOutline, kind === 'ghost' && styles.btnGhost]}
      onPress={onPress}
      disabled={busy}
      activeOpacity={0.8}
    >
      {busy && kind === 'primary' ? <ActivityIndicator color="#fff" /> : (
        <Text style={[styles.btnText, kind !== 'primary' && { color: Colors.primary }]}>{label}</Text>
      )}
    </TouchableOpacity>
  );

  const reasonBox = (placeholder: string) => (
    <TextInput style={styles.input} value={reason} onChangeText={setReason} placeholder={placeholder} multiline maxLength={300} />
  );

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => !busy && close(true)}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.message}>{item.message}</Text>
          {!!item.reason && <Text style={styles.reason}>{item.reason}</Text>}

          {item.type === 'customer_confirm' && mode === 'main' && (
            <View style={styles.col}>
              <Btn label="Yes, completed. Release payment" onPress={yes} />
              <Btn label="No, it did not happen" kind="outline" onPress={() => { setMode('reason'); setAnswer('no'); }} />
              <Btn label="Answer later" kind="ghost" onPress={() => close(true)} />
            </View>
          )}
          {item.type === 'customer_confirm' && mode === 'reason' && answer === 'no' && (
            <View style={styles.col}>
              {reasonBox('What happened? (optional)')}
              <Text style={styles.warn}>Your payment stays on hold and will not be auto-released until a no-show is resolved.</Text>
              <Btn label="Confirm: service did not happen" onPress={submitNo} />
              <Btn label="Back" kind="ghost" onPress={() => setMode('main')} />
            </View>
          )}

          {item.type === 'provider_mark' && mode === 'main' && (
            <View style={styles.col}>
              <Btn label="Completed" onPress={providerCompleted} />
              <Btn label="Customer did not show (No-show)" kind="outline" onPress={() => { setMode('reason'); setAnswer('noshow'); }} />
              <Btn label="Later" kind="ghost" onPress={() => close(true)} />
            </View>
          )}

          {item.type === 'file_no_show' && mode === 'main' && (
            <View style={styles.col}>
              <Btn label="File a no-show" onPress={() => { setMode('reason'); setAnswer('noshow'); }} />
              <Btn label="Open booking" kind="outline" onPress={() => { close(true); router.push(`/bookings/${id}` as any); }} />
              <Btn label="Later" kind="ghost" onPress={() => close(true)} />
            </View>
          )}

          {mode === 'reason' && answer === 'noshow' && (
            <View style={styles.col}>
              {reasonBox('Short reason (optional)')}
              <Text style={styles.warn}>The other side can confirm or dispute. False reports can lead to account penalties.</Text>
              <Btn label="Submit no-show" onPress={reportNoShow} />
              <Btn label="Back" kind="ghost" onPress={() => setMode('main')} />
            </View>
          )}

          {item.type === 'review' && (
            <View style={styles.col}>
              <View style={styles.stars}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <TouchableOpacity key={n} onPress={() => setRating(n)} accessibilityLabel={`${n} stars`}>
                    <Ionicons name={n <= rating ? 'star' : 'star-outline'} size={34} color={n <= rating ? '#FACC15' : '#D1D5DB'} />
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput style={styles.input} value={comment} onChangeText={setComment} placeholder="Tell others about your experience (optional)" multiline />
              <Btn label="Submit review" onPress={submitReview} />
              <Btn label="Not now" kind="ghost" onPress={() => close(true)} />
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: Spacing.lg },
  card: { backgroundColor: '#fff', borderRadius: BorderRadius.lg, padding: Spacing.lg },
  title: { fontSize: FontSizes.lg, fontWeight: '700', color: '#111' },
  message: { fontSize: FontSizes.md, color: '#374151', marginTop: 8 },
  reason: { fontSize: FontSizes.sm, color: '#6B7280', backgroundColor: '#F3F4F6', borderRadius: BorderRadius.sm, padding: 10, marginTop: 10 },
  warn: { fontSize: FontSizes.sm, color: '#B45309' },
  col: { marginTop: Spacing.md, gap: 8 },
  btn: { backgroundColor: Colors.primary, borderRadius: BorderRadius.md, paddingVertical: 12, alignItems: 'center' },
  btnOutline: { backgroundColor: '#fff', borderWidth: 1, borderColor: Colors.primary },
  btnGhost: { backgroundColor: 'transparent' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: FontSizes.md },
  input: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: BorderRadius.md, padding: 10, minHeight: 70, textAlignVertical: 'top' },
  stars: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
});
