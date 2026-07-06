import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { Colors, FontSizes, Spacing, BorderRadius } from '../../src/constants/theme';
import { useAuth } from '../../src/contexts/AuthContext';
import { bookingService } from '../../src/services/booking.service';
import { providerService } from '../../src/services/provider.service';
import { formatCurrency } from '../../src/utils/currency';
import { Booking, Provider } from '../../src/types';

const isSameDay = (isoDate: string) => {
  if (!isoDate) return false;
  const today = new Date();
  const d = new Date(isoDate);
  return (
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  );
};

export default function ProviderDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const providerId = user?.id;

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [profile, setProfile] = useState<Provider | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!providerId) return;
    try {
      setError(null);
      const [bookingList, providerProfile] = await Promise.all([
        bookingService.getBookings({ role: 'provider' }),
        providerService.getProviderFullProfile(providerId).catch(() => null),
      ]);
      setBookings(bookingList);
      setProfile(providerProfile);
    } catch (err: any) {
      console.error('[provider-dashboard] failed to load', err);
      setError(err?.friendlyMessage || 'Could not load your dashboard.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [providerId]);

  // Refresh dashboard stats every time it regains focus - covers a
  // just-paid booking, a status change made on the Bookings tab, or an
  // escrow release that happened while this screen wasn't visible. Also
  // covers the initial mount/focus, so no separate mount-only effect is
  // needed.
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const { todays, pending, upcoming, completed, cancelled, totalEarnings, pendingPayout } = useMemo(() => {
    const todays = bookings.filter((b) => isSameDay(b.scheduled_at) && b.status !== 'cancelled');
    const pending = bookings.filter((b) => b.status === 'pending');
    const upcoming = bookings.filter((b) =>
      ['confirmed', 'arrived'].includes(b.status)
    );
    const completed = bookings.filter((b) => b.status === 'completed');
    const cancelled = bookings.filter((b) => ['cancelled', 'rejected'].includes(b.status));
    const totalEarnings = completed.reduce((sum, b) => sum + (b.total_amount || 0), 0);
    // Real earnings still tied up in active (unfinished) bookings - a
    // best-effort "pending" figure derived from real booking data since the
    // API has no dedicated earnings/escrow endpoint.
    const pendingPayout = upcoming.reduce((sum, b) => sum + (b.total_amount || 0), 0);
    return { todays, pending, upcoming, completed, cancelled, totalEarnings, pendingPayout };
  }, [bookings]);

  const quickActions = [
    { icon: 'time-outline', label: 'Availability', onPress: () => router.push('/(provider)/availability') },
    { icon: 'cut-outline', label: 'Services', onPress: () => router.push('/(provider)/services') },
    { icon: 'calendar-outline', label: 'Calendar', onPress: () => router.push('/(provider)/availability') },
    { icon: 'wallet-outline', label: 'Wallet', onPress: () => router.push('/(provider)/wallet') },
    { icon: 'person-outline', label: 'Profile', onPress: () => router.push('/(provider)/profile') },
    {
      icon: 'bar-chart-outline',
      label: 'Analytics',
      onPress: () => Alert.alert('Coming soon', 'Analytics is being wired up in a later phase.'),
    },
    { icon: 'cash-outline', label: 'Earnings', onPress: () => router.push('/(provider)/wallet') },
  ];

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.primary} />
        }
      >
        <View style={styles.header}>
          <View style={{ flex: 1, marginRight: Spacing.sm }}>
            <Text style={styles.greeting}>Welcome back, {user?.full_name?.split(' ')[0] || 'there'} 👋</Text>
            <Text style={styles.subGreeting}>Here is how your business is doing</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => router.push('/notifications')}
              accessibilityRole="button"
              accessibilityLabel="Notifications"
            >
              <Ionicons name="notifications-outline" size={24} color={Colors.text} />
              <View style={styles.badge} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => router.push('/(provider)/profile')}
              accessibilityRole="button"
              accessibilityLabel="Profile"
            >
              <Ionicons name="person-circle-outline" size={26} color={Colors.text} />
            </TouchableOpacity>
          </View>
        </View>

        {error && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={18} color={Colors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Stats */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{formatCurrency(totalEarnings)}</Text>
            <Text style={styles.statLabel}>Total Earnings</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{formatCurrency(pendingPayout)}</Text>
            <Text style={styles.statLabel}>Pending Payout</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{completed.length}</Text>
            <Text style={styles.statLabel}>Completed Services</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {profile?.rating ? profile.rating.toFixed(1) : 'New'}
            </Text>
            <Text style={styles.statLabel}>Average Rating</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{profile?.review_count ?? 0}</Text>
            <Text style={styles.statLabel}>Total Reviews</Text>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsRow}>
            {quickActions.map((action) => (
              <TouchableOpacity
                key={action.label}
                style={styles.actionButton}
                onPress={action.onPress}
                accessibilityRole="button"
                accessibilityLabel={action.label}
              >
                <View style={styles.actionIcon}>
                  <Ionicons name={action.icon as any} size={22} color={Colors.primary} />
                </View>
                <Text style={styles.actionLabel}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Booking summary rows */}
        {[
          { title: "Today's Bookings", data: todays },
          { title: 'Pending Bookings', data: pending },
          { title: 'Upcoming Bookings', data: upcoming },
          { title: 'Completed Bookings', data: completed },
          { title: 'Cancelled Bookings', data: cancelled },
        ].map((group) => (
          <View key={group.title} style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{group.title}</Text>
              <Text style={styles.sectionCount}>{group.data.length}</Text>
            </View>
            {group.data.length === 0 ? (
              <Text style={styles.emptyInline}>Nothing here yet.</Text>
            ) : (
              group.data.slice(0, 3).map((booking) => (
                <TouchableOpacity
                  key={booking.id}
                  style={styles.bookingRow}
                  onPress={() => router.push('/(provider)/bookings')}
                  accessibilityRole="button"
                  accessibilityLabel={`${booking.service_name} booking`}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.bookingService}>{booking.service_name}</Text>
                    <Text style={styles.bookingMeta}>
                      {booking.date} {booking.time ? `· ${booking.time}` : ''}
                    </Text>
                  </View>
                  <Text style={styles.bookingAmount}>{formatCurrency(booking.total_amount)}</Text>
                </TouchableOpacity>
              ))
            )}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centerState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingBottom: Spacing.xl },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.error,
  },
  greeting: { fontSize: FontSizes.xl, fontWeight: 'bold', color: Colors.text },
  subGreeting: { fontSize: FontSizes.sm, color: Colors.textSecondary, marginTop: 4 },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  errorText: { flex: 1, fontSize: FontSizes.sm, color: Colors.error },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  statCard: {
    flexBasis: '31%',
    flexGrow: 1,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
  },
  statValue: { fontSize: FontSizes.md, fontWeight: 'bold', color: Colors.primary },
  statLabel: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },
  section: { marginBottom: Spacing.lg, paddingHorizontal: Spacing.lg },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  sectionTitle: { fontSize: FontSizes.md, fontWeight: '700', color: Colors.text },
  sectionCount: {
    fontSize: FontSizes.sm,
    fontWeight: '700',
    color: Colors.primary,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  emptyInline: { fontSize: FontSizes.sm, color: Colors.textMuted },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  actionButton: { alignItems: 'center', width: 68 },
  actionIcon: {
    width: 52,
    height: 52,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  actionLabel: { fontSize: FontSizes.xs, color: Colors.text, textAlign: 'center' },
  bookingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  bookingService: { fontSize: FontSizes.sm, fontWeight: '600', color: Colors.text },
  bookingMeta: { fontSize: FontSizes.xs, color: Colors.textMuted, marginTop: 2 },
  bookingAmount: { fontSize: FontSizes.sm, fontWeight: '700', color: Colors.primary },
});
