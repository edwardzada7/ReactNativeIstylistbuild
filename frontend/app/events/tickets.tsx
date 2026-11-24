import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SvgXml } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { BorderRadius, Colors, FontSizes, Spacing } from '../../src/constants/theme';
import { withAuthGate } from '../../src/components/common';
import { useTheme } from '../../src/contexts/ThemeContext';
import { MyTicket, eventsService, formatEventDate } from '../../src/services/events.service';

const STATUS: Record<string, { label: string; bg: string; fg: string }> = {
  valid: { label: 'Valid', bg: '#DCFCE7', fg: '#166534' },
  used: { label: 'Used', bg: '#E5E7EB', fg: '#374151' },
  refund_due: { label: 'Refund due', bg: '#FEF3C7', fg: '#92400E' },
  canceled: { label: 'Canceled', bg: '#FEE2E2', fg: '#B91C1C' },
};

function TicketCard({ t }: { t: MyTicket }) {
  const { colors } = useTheme();
  const st = STATUS[t.status] || STATUS.valid;
  const usable = t.status === 'valid';
  return (
    <View style={[styles.ticket, { backgroundColor: colors.surface, borderColor: colors.border }]} testID={`ticket-${t.id}`}>
      <View style={styles.ticketHead}>
        <Text style={[styles.type, { color: colors.text }]}>{t.ticket_type || 'Ticket'}</Text>
        <Text style={[styles.badge, { backgroundColor: st.bg, color: st.fg }]}>{st.label}</Text>
      </View>
      <View style={styles.qrWrap}>
        {usable && t.qr_svg ? (
          <View style={styles.qrBox}><SvgXml xml={t.qr_svg} width={220} height={220} /></View>
        ) : (
          <View style={[styles.qrBox, styles.qrEmpty]}>
            <Text style={{ color: '#6B7280', textAlign: 'center' }}>
              {t.status === 'used' ? `Used${t.used_at ? `\n${new Date(t.used_at).toLocaleString()}` : ''}` : usable ? 'QR unavailable.\nUse the PIN below.' : "This ticket can't be used"}
            </Text>
          </View>
        )}
        {usable && (
          <>
            <Text style={[styles.pinLabel, { color: colors.textSecondary }]}>Or show this PIN at the door</Text>
            <Text style={[styles.pin, { color: colors.text }]} testID="ticket-pin">{t.pin}</Text>
          </>
        )}
        <Text style={[styles.note, { color: colors.textSecondary }]}>One person per ticket. It works once, so don't share the QR code or PIN.</Text>
      </View>
    </View>
  );
}

function MyTickets() {
  const router = useRouter();
  const { colors } = useTheme();
  const [tickets, setTickets] = useState<MyTicket[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setTickets(await eventsService.myTickets());
    } catch {
      setTickets((prev) => prev ?? []);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const groups: { event_id: number; info: MyTicket; items: MyTicket[] }[] = [];
  (tickets || []).forEach((t) => {
    let g = groups.find((x) => x.event_id === t.event_id);
    if (!g) {
      g = { event_id: t.event_id, info: t, items: [] };
      groups.push(g);
    }
    g.items.push(t);
  });

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/events' as any))} accessibilityLabel="Go back" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>My Tickets</Text>
        <View style={{ width: 24 }} />
      </View>
      {tickets === null ? (
        <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: Spacing.md, gap: Spacing.lg }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={Colors.primary} />}
        >
          {!tickets.length && (
            <View style={styles.center}>
              <Ionicons name="ticket-outline" size={48} color={colors.textMuted} />
              <Text style={{ color: colors.textSecondary }}>You have no tickets yet.</Text>
              <TouchableOpacity style={[styles.btn, { backgroundColor: Colors.primary }]} onPress={() => router.push('/events' as any)}><Text style={styles.btnText}>Browse events</Text></TouchableOpacity>
            </View>
          )}
          {groups.map((g) => (
            <View key={g.event_id} style={{ gap: Spacing.sm }}>
              <TouchableOpacity onPress={() => router.push(`/events/${g.event_id}` as any)}>
                <Text style={[styles.eventTitle, { color: colors.text }]}>{g.info.event_title}</Text>
                <Text style={{ color: Colors.primary, fontWeight: '600' }}>{formatEventDate(g.info.event_starts_at)}</Text>
                {g.info.event_venue ? <Text style={{ color: colors.textSecondary }}>{g.info.event_venue}</Text> : null}
              </TouchableOpacity>
              {g.items.map((t) => <TicketCard key={t.id} t={t} />)}
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

export default withAuthGate(MyTickets, { title: 'Your tickets', message: 'Sign in to see the tickets you have bought.', icon: 'ticket-outline' });

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  title: { fontSize: FontSizes.xl, fontWeight: '700' },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: Spacing.sm },
  btn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: BorderRadius.md, marginTop: 8 },
  btnText: { color: '#fff', fontWeight: '700' },
  eventTitle: { fontSize: FontSizes.lg, fontWeight: '800' },
  ticket: { borderWidth: 1, borderRadius: BorderRadius.lg, overflow: 'hidden' },
  ticketHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.md },
  type: { fontSize: FontSizes.md, fontWeight: '700' },
  badge: { fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, overflow: 'hidden' },
  qrWrap: { alignItems: 'center', gap: 6, paddingHorizontal: Spacing.md, paddingBottom: Spacing.md },
  qrBox: { width: 236, height: 236, backgroundColor: '#fff', borderRadius: 12, padding: 8, alignItems: 'center', justifyContent: 'center' },
  qrEmpty: { backgroundColor: '#F3F4F6' },
  pinLabel: { fontSize: FontSizes.xs },
  pin: { fontSize: 32, fontWeight: '800', letterSpacing: 8 },
  note: { fontSize: FontSizes.xs, textAlign: 'center' },
});
