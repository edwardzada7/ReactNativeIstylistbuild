import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import { BorderRadius, Colors, FontSizes, Spacing } from '../../src/constants/theme';
import { TicketCard } from '../../src/components/events';
import { useAuth } from '../../src/contexts/AuthContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { MyTicket, eventsService, formatEventDate } from '../../src/services/events.service';

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

// Signed-in users see their account tickets; guests see the tickets saved on this phone.
export default function TicketsEntry() {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Redirect href={'/events/guest-tickets' as any} />;
  return <MyTickets />;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  title: { fontSize: FontSizes.xl, fontWeight: '700' },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: Spacing.sm },
  btn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: BorderRadius.md, marginTop: 8 },
  btnText: { color: '#fff', fontWeight: '700' },
  eventTitle: { fontSize: FontSizes.lg, fontWeight: '800' },
});
