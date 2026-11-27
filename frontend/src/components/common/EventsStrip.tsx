import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, FontSizes, Spacing, BorderRadius } from '../../constants/theme';
import { useTheme } from '../../contexts/ThemeContext';
import { eventsService, EventItem, formatEventDate } from '../../services/events.service';
import { formatCurrency } from '../../utils/currency';

/** Upcoming events on the home and provider dashboards, plus a My Tickets shortcut (shown even with no events). */
export function EventsStrip() {
  const router = useRouter();
  const { colors } = useTheme();
  const [events, setEvents] = useState<EventItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    eventsService.list().then((list) => !cancelled && setEvents(list.slice(0, 6))).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <View style={styles.wrap} testID="events-strip">
      <View style={styles.titleRow}>
        <Text style={[styles.title, { color: colors.text }]}>Events</Text>
        <View style={styles.links}>
          <TouchableOpacity onPress={() => router.push('/events/tickets' as any)} testID="events-my-tickets" style={styles.link}>
            <Ionicons name="ticket-outline" size={16} color={Colors.primary} />
            <Text style={[styles.linkText, { color: Colors.primary }]}>My Tickets</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/events' as any)} testID="events-view-all">
            <Text style={[styles.linkText, { color: colors.textSecondary }]}>View all</Text>
          </TouchableOpacity>
        </View>
      </View>
      {events.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: Spacing.lg, gap: Spacing.sm }}>
          {events.map((e) => (
            <TouchableOpacity
              key={e.id}
              onPress={() => router.push(`/events/${e.id}` as any)}
              style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
              activeOpacity={0.85}
            >
              {e.banner_url ? (
                <Image source={{ uri: e.banner_url }} style={styles.banner} />
              ) : (
                <View style={[styles.banner, { backgroundColor: Colors.primary }]} />
              )}
              <View style={styles.cardBody}>
                {e.is_promoted ? <Text style={{ color: '#5b21b6', fontSize: 10, fontWeight: '800' }}>PROMOTED</Text> : null}
                <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={2}>{e.title}</Text>
                <Text style={[styles.cardDate, { color: Colors.primary }]}>{formatEventDate(e.starts_at)}</Text>
                <Text style={[styles.cardPrice, { color: colors.text }]}>{e.is_free ? 'Free' : `From ${formatCurrency(e.min_price)}`}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: Spacing.lg },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, marginBottom: Spacing.sm },
  title: { fontSize: FontSizes.lg, fontWeight: '700' },
  links: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  link: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  linkText: { fontSize: FontSizes.sm, fontWeight: '600' },
  card: { width: 220, borderRadius: BorderRadius.lg, borderWidth: 1, overflow: 'hidden' },
  banner: { width: '100%', height: 100 },
  cardBody: { padding: Spacing.sm, gap: 2 },
  cardTitle: { fontSize: FontSizes.md, fontWeight: '600' },
  cardDate: { fontSize: FontSizes.xs, fontWeight: '600' },
  cardPrice: { fontSize: FontSizes.sm, fontWeight: '700', marginTop: 2 },
});
