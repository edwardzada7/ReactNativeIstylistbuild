import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { BorderRadius, Colors, FontSizes, Spacing } from '../../src/constants/theme';
import { TicketCard } from '../../src/components/events';
import { useTheme } from '../../src/contexts/ThemeContext';
import { MyTicket, eventsService, formatEventDate, guestOrders } from '../../src/services/events.service';

type Group = { reference: string; tickets: MyTicket[] };

/**
 * Tickets for people without an account. With ?reference&t (Paystack return or the email link) it confirms the
 * payment and shows that order; otherwise it lists the guest orders saved on this phone.
 */
export default function GuestTickets() {
  const router = useRouter();
  const { colors } = useTheme();
  const { reference, t: token } = useLocalSearchParams<{ reference?: string; t?: string }>();
  const [state, setState] = useState<'loading' | 'ready' | 'saved' | 'failed'>(reference && token ? 'loading' : 'saved');
  const [message, setMessage] = useState('');
  const [groups, setGroups] = useState<Group[]>([]);

  const load = useCallback(async () => {
    if (reference && token) {
      try {
        const res = await eventsService.guestVerify(String(reference), String(token));
        if (res.status !== 'success') {
          setState('failed');
          setMessage(res.message || 'Payment was not completed. No ticket was issued.');
          return;
        }
        const tickets = res.tickets || [];
        if (tickets[0]) await guestOrders.save({ reference: String(reference), token: String(token), title: tickets[0].event_title });
        setGroups([{ reference: String(reference), tickets }]);
        setState('ready');
      } catch (e: any) {
        setState('failed');
        setMessage(e?.friendlyMessage || e?.response?.data?.detail || "We couldn't open these tickets. Use the link in your email.");
      }
      return;
    }
    const saved = await guestOrders.list();
    const loaded: Group[] = [];
    for (const o of saved) {
      try {
        loaded.push({ reference: o.reference, tickets: await eventsService.guestTickets(o.reference, o.token) });
      } catch {
        /* skip orders that can't be opened */
      }
    }
    setGroups(loaded);
    setState('saved');
  }, [reference, token]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/events' as any))} accessibilityLabel="Go back" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>My Tickets</Text>
        <View style={{ width: 24 }} />
      </View>
      {state === 'loading' ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} />
          <Text style={{ color: colors.textSecondary }}>Confirming your payment...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: Spacing.md, gap: Spacing.lg }}>
          {state === 'failed' && (
            <View style={styles.center}>
              <Ionicons name="close-circle" size={48} color={Colors.error} />
              <Text style={{ color: colors.text, textAlign: 'center' }}>{message}</Text>
              <TouchableOpacity style={[styles.btn, { backgroundColor: Colors.primary }]} onPress={() => router.replace('/events' as any)}><Text style={styles.btnText}>Back to events</Text></TouchableOpacity>
            </View>
          )}
          {state === 'ready' && (
            <View style={styles.success}>
              <Ionicons name="checkmark-circle" size={22} color="#16A34A" />
              <Text style={styles.successText}>You're going! Your tickets are below and we've emailed you a link to them. Keep this screen handy for the door.</Text>
            </View>
          )}
          {(state === 'ready' || state === 'saved') && groups.map((g) => (
            <View key={g.reference} style={{ gap: Spacing.sm }}>
              {g.tickets[0] ? (
                <View>
                  <Text style={[styles.eventTitle, { color: colors.text }]}>{g.tickets[0].event_title}</Text>
                  <Text style={{ color: Colors.primary, fontWeight: '600' }}>{formatEventDate(g.tickets[0].event_starts_at)}</Text>
                  {g.tickets[0].event_venue ? <Text style={{ color: colors.textSecondary }}>{g.tickets[0].event_venue}</Text> : null}
                </View>
              ) : null}
              {g.tickets.map((tk) => <TicketCard key={tk.id} t={tk} />)}
            </View>
          ))}
          {state === 'saved' && !groups.length && (
            <View style={styles.center}>
              <Ionicons name="ticket-outline" size={48} color={colors.textMuted} />
              <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>No tickets saved on this phone. Bought as a guest? Open the link we emailed you.</Text>
              <TouchableOpacity style={[styles.btn, { backgroundColor: Colors.primary }]} onPress={() => router.push('/events' as any)}><Text style={styles.btnText}>Browse events</Text></TouchableOpacity>
            </View>
          )}
          {state !== 'failed' && (
            <View style={[styles.join, { backgroundColor: Colors.primary }]}>
              <Text style={styles.joinTitle}>Sign up or sign in for more</Text>
              <Text style={styles.joinText}>Create a free account with the same email to keep your tickets in the app, and to book trusted stylists and more.</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity style={styles.joinBtn} onPress={() => router.push('/(auth)/signup')}><Text style={[styles.joinBtnText, { color: Colors.primary }]}>Sign up</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.joinBtn, styles.joinOutline]} onPress={() => router.push('/(auth)/login')}><Text style={[styles.joinBtnText, { color: '#fff' }]}>Sign in</Text></TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  title: { fontSize: FontSizes.xl, fontWeight: '700' },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: Spacing.sm },
  btn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: BorderRadius.md, marginTop: 8 },
  btnText: { color: '#fff', fontWeight: '700' },
  eventTitle: { fontSize: FontSizes.lg, fontWeight: '800' },
  success: { flexDirection: 'row', gap: 8, backgroundColor: '#F0FDF4', borderColor: '#BBF7D0', borderWidth: 1, borderRadius: BorderRadius.md, padding: Spacing.md, alignItems: 'flex-start' },
  successText: { flex: 1, color: '#14532D', fontSize: FontSizes.sm },
  join: { borderRadius: BorderRadius.lg, padding: Spacing.md, gap: 6 },
  joinTitle: { color: '#fff', fontSize: FontSizes.md, fontWeight: '800' },
  joinText: { color: 'rgba(255,255,255,0.92)', fontSize: FontSizes.sm },
  joinBtn: { backgroundColor: '#fff', borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: 10 },
  joinOutline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: 'rgba(255,255,255,0.7)' },
  joinBtnText: { fontWeight: '700' },
});
