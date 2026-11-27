import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { BorderRadius, Colors, FontSizes, Spacing } from '../../src/constants/theme';
import { VerifiedBadge } from '../../src/components/common';
import { useTheme } from '../../src/contexts/ThemeContext';
import { useAuth } from '../../src/contexts/AuthContext';
import { EventItem, eventsService, formatEventDate } from '../../src/services/events.service';
import { formatCurrency } from '../../src/utils/currency';

/** All published events (admin, and later provider events). Works signed-out so guests can browse and join. */
export default function EventsList() {
  const router = useRouter();
  const { colors } = useTheme();
  const { isAuthenticated } = useAuth();
  const [events, setEvents] = useState<EventItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setEvents(await eventsService.list());
      setFailed(false);
    } catch {
      setFailed(true);
      setEvents((prev) => prev ?? []);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const header = (
    <View>
      {!isAuthenticated && (
        <View style={[styles.join, { backgroundColor: Colors.primary }]} testID="events-join-banner">
          <Text style={styles.joinTitle}>Beauty, fashion & style events</Text>
          <Text style={styles.joinText}>Create a free iStylist account to get tickets and book trusted stylists, makeup artists and more.</Text>
          <TouchableOpacity style={styles.joinBtn} onPress={() => router.push('/(auth)/signup')}>
            <Text style={[styles.joinBtnText, { color: Colors.primary }]}>Join iStylist free</Text>
          </TouchableOpacity>
        </View>
      )}
      {failed && <Text style={[styles.err, { color: Colors.error }]}>Could not load events. Pull down to retry.</Text>}
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} accessibilityLabel="Go back" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Events</Text>
        <TouchableOpacity onPress={() => router.push('/events/tickets' as any)} accessibilityLabel="My tickets" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="ticket-outline" size={24} color={Colors.primary} />
        </TouchableOpacity>
      </View>
      {events === null ? (
        <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>
      ) : (
        <FlatList
          data={events}
          keyExtractor={(e) => String(e.id)}
          ListHeaderComponent={header}
          contentContainerStyle={{ padding: Spacing.md, gap: Spacing.md }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="calendar-outline" size={48} color={colors.textMuted} />
              <Text style={[styles.empty, { color: colors.textSecondary }]}>No upcoming events yet. Check back soon.</Text>
            </View>
          }
          renderItem={({ item: e }) => (
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => router.push(`/events/${e.id}` as any)}
              style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
              testID={`event-card-${e.id}`}
            >
              {e.banner_url ? <Image source={{ uri: e.banner_url }} style={styles.banner} /> : <View style={[styles.banner, { backgroundColor: Colors.primary }]} />}
              <View style={styles.body}>
                <View style={styles.metaRow}>
                  {e.is_promoted && <Text style={styles.featured}>Promoted</Text>}
                  {e.is_featured && <Text style={styles.featured}>Featured</Text>}
                  {e.is_official && (
                    <View style={styles.orgRow}>
                      <Text style={[styles.org, { color: colors.textSecondary }]}>{e.organizer_name}</Text>
                      <VerifiedBadge verified size={14} />
                    </View>
                  )}
                  {(e.my_ticket_count || 0) > 0 && <Text style={styles.have}>{e.my_ticket_count} ticket{e.my_ticket_count === 1 ? '' : 's'}</Text>}
                </View>
                <Text style={[styles.eventTitle, { color: colors.text }]}>{e.title}</Text>
                <Text style={[styles.date, { color: Colors.primary }]}>{formatEventDate(e.starts_at)}</Text>
                {e.venue ? <Text style={[styles.venue, { color: colors.textSecondary }]}>{e.venue}</Text> : null}
                <Text style={[styles.price, { color: colors.text }]}>
                  {e.is_free ? 'Free' : `From ${formatCurrency(e.min_price)}`}
                  {e.ticket_types.length > 0 && e.ticket_types.every((t) => t.sold_out) ? '  · Sold out' : ''}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  title: { fontSize: FontSizes.xl, fontWeight: '700' },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: Spacing.sm },
  empty: { fontSize: FontSizes.md, textAlign: 'center' },
  err: { textAlign: 'center', marginBottom: Spacing.sm },
  join: { borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.md, gap: 6 },
  joinTitle: { color: '#fff', fontSize: FontSizes.lg, fontWeight: '800' },
  joinText: { color: 'rgba(255,255,255,0.92)', fontSize: FontSizes.sm },
  joinBtn: { alignSelf: 'flex-start', backgroundColor: '#fff', borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: 10, marginTop: 4 },
  joinBtnText: { fontWeight: '700' },
  card: { borderRadius: BorderRadius.lg, borderWidth: 1, overflow: 'hidden' },
  banner: { width: '100%', height: 160 },
  body: { padding: Spacing.md, gap: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  featured: { backgroundColor: '#FEF3C7', color: '#92400E', fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, overflow: 'hidden' },
  have: { backgroundColor: '#DCFCE7', color: '#166534', fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, overflow: 'hidden' },
  orgRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  org: { fontSize: FontSizes.xs },
  eventTitle: { fontSize: FontSizes.lg, fontWeight: '700' },
  date: { fontSize: FontSizes.sm, fontWeight: '600' },
  venue: { fontSize: FontSizes.sm },
  price: { fontSize: FontSizes.md, fontWeight: '700', marginTop: 2 },
});
