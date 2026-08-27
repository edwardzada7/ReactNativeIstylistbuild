import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { Colors, FontSizes, Spacing, BorderRadius } from '../../src/constants/theme';
import { BrandLogo } from '../../src/components/branding';
import { ProfileAvatar } from '../../src/components/common';
import { useAuth } from '../../src/contexts/AuthContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { bookingService } from '../../src/services/booking.service';
import { providerService } from '../../src/services/provider.service';
import { notificationService } from '../../src/services/notification.service';
import { ChatIconWithBadge } from '../../src/components/chat/ChatIconWithBadge';
import { shopService, Order } from '../../src/services/shop.service';
import { formatCurrency } from '../../src/utils/currency';
import { Booking, Provider } from '../../src/types';
import { formatRating } from '../../src/utils/display';

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
  const { colors } = useTheme();
  const providerId = user?.id;

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [shopOrders, setShopOrders] = useState<Order[]>([]);
  const [profile, setProfile] = useState<Provider | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnreadCount = useCallback(async () => {
    try {
      const res = await notificationService.getUnreadCount();
      setUnreadCount(res.count || 0);
    } catch (err) {
      console.error('[provider-dashboard] failed to load unread count', err);
    }
  }, []);

  const loadData = useCallback(async () => {
    if (!providerId) return;
    try {
      setError(null);
      const [bookingList, providerProfile] = await Promise.all([
        bookingService.getBookings({ role: 'provider' }),
        providerService.getProviderFullProfile(providerId).catch(() => null),
      ]);
      let providerOrders: Order[] = [];
      if (user?.auth_id) {
        providerOrders = await shopService.getProviderOrders(user.auth_id).catch(() => []);
      }
      setBookings(bookingList);
      setShopOrders(providerOrders);
      setProfile(providerProfile);
      await refreshUnreadCount();
    } catch (err: any) {
      console.error('[provider-dashboard] failed to load', err);
      setError(err?.friendlyMessage || 'Could not load your dashboard.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [providerId, user?.auth_id, refreshUnreadCount]);

  // Refresh dashboard stats every time it regains focus - covers a
  // just-paid booking, a status change made on the Bookings tab, or an
  // escrow release that happened while this screen wasn't visible. Also
  // covers the initial mount/focus, so no separate mount-only effect is
  // needed.
  useFocusEffect(
    useCallback(() => {
      loadData();
      refreshUnreadCount();
    }, [loadData, refreshUnreadCount])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const cancelledStatuses = ['canceled', 'cancelled', 'declined', 'rejected', 'no_show_pending', 'user_no_show', 'provider_no_show', 'disputed'];
  const { todays, pending, upcoming, completed, cancelled, totalEarnings, pendingPayout } = useMemo(() => {
    const todays = bookings.filter((b) => isSameDay(b.scheduled_at) && !cancelledStatuses.includes((b.status || '').toLowerCase()));
    const pending = bookings.filter((b) => b.status === 'pending');
    const upcoming = bookings.filter((b) => ['confirmed', 'arrived'].includes((b.status || '').toLowerCase()));
    const completed = bookings.filter((b) => b.status === 'completed');
    const cancelled = bookings.filter((b) => cancelledStatuses.includes((b.status || '').toLowerCase()));
    const totalEarnings = completed.reduce((sum, b) => sum + (b.total_amount || 0), 0);
    // Real earnings still tied up in active (unfinished) bookings - a
    // best-effort "pending" figure derived from real booking data since the
    // API has no dedicated earnings/escrow endpoint.
    const pendingPayout = upcoming.reduce((sum, b) => sum + (b.total_amount || 0), 0);
    return { todays, pending, upcoming, completed, cancelled, totalEarnings, pendingPayout };
  }, [bookings]);

  const analytics = useMemo(() => {
    const total = bookings.length;
    const pendingCount = bookings.filter((b) => ['pending', 'pending_payment'].includes((b.status || '').toLowerCase())).length;
    const completedCount = bookings.filter((b) => (b.status || '').toLowerCase() === 'completed').length;
    const cancelledCount = bookings.filter((b) => cancelledStatuses.includes((b.status || '').toLowerCase())).length;
    const noShowCount = bookings.filter((b) => ['no_show_pending', 'user_no_show', 'provider_no_show'].includes((b.status || '').toLowerCase())).length;
    return { total, pendingCount, completedCount, cancelledCount, noShowCount };
  }, [bookings]);

  const servicePreview = useMemo(() => (profile?.services || []).slice(0, 3), [profile?.services]);

  const orderStats = useMemo(() => {
    const total = shopOrders.length;
    const pending = shopOrders.filter((order) => ['pending', 'accepted'].includes((order.status || '').toLowerCase())).length;
    const processing = shopOrders.filter((order) => ['processing', 'ready'].includes((order.status || '').toLowerCase())).length;
    const delivered = shopOrders.filter((order) => (order.status || '').toLowerCase() === 'delivered').length;
    return { total, pending, processing, delivered };
  }, [shopOrders]);

  const quickActions = [
    { icon: 'time-outline', label: 'Availability', onPress: () => router.push('/(provider)/availability') },
    { icon: 'people-outline', label: 'Manage Staff', onPress: () => router.push('/(provider)/staff') },
    { icon: 'cut-outline', label: 'Services', onPress: () => router.push('/(provider)/services') },
    { icon: 'star-outline', label: 'Reviews', onPress: () => router.push('/(provider)/reviews') },
    { icon: 'wallet-outline', label: 'Wallet', onPress: () => router.push('/(provider)/wallet') },
    { icon: 'person-outline', label: 'Profile', onPress: () => router.push('/(provider)/profile') },
    { icon: 'settings-outline', label: 'Settings', onPress: () => router.push('/settings') },
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
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
        }
      >
        <View style={styles.header}>
          <View style={styles.titleWrap}>
            <BrandLogo size={36} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.greeting, { color: colors.text }]}>Welcome back, {user?.full_name?.split(' ')[0] || 'there'} 👋</Text>
              <Text style={[styles.subGreeting, { color: colors.textSecondary }]}>Here is how your business is doing</Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[styles.iconButton, { backgroundColor: colors.surface }]}
              onPress={() => router.push('/messages')}
              accessibilityRole="button"
              accessibilityLabel="Chat"
            >
              <ChatIconWithBadge size={24} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.iconButton, { backgroundColor: colors.surface }]}
              onPress={() => router.push('/notifications')}
              accessibilityRole="button"
              accessibilityLabel="Notifications"
            >
              <Ionicons name="notifications-outline" size={24} color={colors.text} />
              {unreadCount > 0 ? (
                <View style={[styles.badge, { backgroundColor: colors.error }]}>
                  <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.iconButton, { backgroundColor: colors.surface }]}
              onPress={() => router.push('/(provider)/profile')}
              accessibilityRole="button"
              accessibilityLabel="Profile"
            >
              <ProfileAvatar uri={user?.profile_image_url || user?.avatar} size={26} type="provider" />
            </TouchableOpacity>
          </View>
        </View>

        {error && (
          <View style={[styles.errorBanner, { backgroundColor: colors.surface }]}>
            <Ionicons name="alert-circle-outline" size={18} color={colors.error} />
            <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
          </View>
        )}

        {/* Stats */}
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.statValue, { color: colors.text }]}>{formatCurrency(totalEarnings)}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total Earnings</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.statValue, { color: colors.text }]}>{formatCurrency(pendingPayout)}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Pending Payout</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.statValue, { color: colors.text }]}>{completed.length}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Completed Services</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.statValue, { color: colors.text }]}>
              {formatRating(profile?.rating)}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Average Rating</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.statValue, { color: colors.text }]}>{profile?.review_count ?? 0}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total Reviews</Text>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Quick Actions</Text>
          <View style={styles.actionsRow}>
            {quickActions.map((action) => (
              <TouchableOpacity
                key={action.label}
                style={[styles.actionButton, { backgroundColor: colors.surface }]}
                onPress={action.onPress}
                accessibilityRole="button"
                accessibilityLabel={action.label}
              >
                <View style={[styles.actionIcon, { backgroundColor: colors.primary }]}>
                  <Ionicons name={action.icon as any} size={22} color="#fff" />
                </View>
                <Text style={[styles.actionLabel, { color: colors.text }]}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={[styles.analyticsCard, { backgroundColor: colors.surface }]}> 
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Booking Analytics</Text>
            <Text style={[styles.sectionCount, { color: colors.primary, backgroundColor: colors.background }]}>{analytics.total}</Text>
          </View>
          <View style={styles.analyticsGrid}>
            <View style={styles.analyticsMetric}>
              <Text style={[styles.analyticsValue, { color: colors.text }]}>{analytics.total}</Text>
              <Text style={[styles.analyticsLabel, { color: colors.textSecondary }]}>Total</Text>
            </View>
            <View style={styles.analyticsMetric}>
              <Text style={[styles.analyticsValue, { color: colors.text }]}>{analytics.pendingCount}</Text>
              <Text style={[styles.analyticsLabel, { color: colors.textSecondary }]}>Pending</Text>
            </View>
            <View style={styles.analyticsMetric}>
              <Text style={[styles.analyticsValue, { color: colors.text }]}>{analytics.completedCount}</Text>
              <Text style={[styles.analyticsLabel, { color: colors.textSecondary }]}>Completed</Text>
            </View>
            <View style={styles.analyticsMetric}>
              <Text style={[styles.analyticsValue, { color: colors.text }]}>{analytics.cancelledCount}</Text>
              <Text style={[styles.analyticsLabel, { color: colors.textSecondary }]}>Cancelled</Text>
            </View>
            <View style={styles.analyticsMetric}>
              <Text style={[styles.analyticsValue, { color: colors.text }]}>{analytics.noShowCount}</Text>
              <Text style={[styles.analyticsLabel, { color: colors.textSecondary }]}>No-Show</Text>
            </View>
          </View>
        </View>

        <View style={[styles.trayCard, { backgroundColor: colors.surface }]}> 
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Services</Text>
            <Text style={[styles.sectionCount, { color: colors.primary, backgroundColor: colors.background }]}>{profile?.services?.length ?? 0}</Text>
          </View>
          {servicePreview.length === 0 ? (
            <Text style={[styles.emptyInline, { color: colors.textSecondary }]}>No services added yet.</Text>
          ) : (
            servicePreview.map((service, index) => (
              <View
                key={service.id}
                style={[styles.trayItem, index < servicePreview.length - 1 && { borderBottomColor: colors.border }]}
              >
                <View style={styles.trayItemDetails}>
                  <Text style={[styles.bookingService, { color: colors.text }]}>{service.name}</Text>
                  {!!service.description && (
                    <Text style={[styles.bookingMeta, { color: colors.textSecondary }]} numberOfLines={2}>{service.description}</Text>
                  )}
                </View>
                <Text style={[styles.bookingAmount, { color: colors.text }]}>{formatCurrency(service.price)}</Text>
              </View>
            ))
          )}
        </View>

        <TouchableOpacity
          style={[styles.ordersCard, { backgroundColor: colors.surface }]}
          onPress={() => router.push('/(provider)/orders')}
          accessibilityRole="button"
          accessibilityLabel="Orders"
        >
          <View style={styles.ordersCardHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Orders</Text>
            <Ionicons name="chevron-forward-outline" size={18} color={colors.textSecondary} />
          </View>
          <View style={styles.ordersMetrics}>
            <View style={[styles.ordersMetricBlock, { backgroundColor: colors.background }]}>
              <Text style={[styles.ordersMetricValue, { color: colors.primary }]}>{orderStats.total}</Text>
              <Text style={[styles.ordersMetricLabel, { color: colors.textSecondary }]}>Total Orders</Text>
            </View>
            <View style={[styles.ordersMetricBlock, { backgroundColor: colors.background }]}>
              <Text style={[styles.ordersMetricValue, { color: colors.primary }]}>{orderStats.pending}</Text>
              <Text style={[styles.ordersMetricLabel, { color: colors.textSecondary }]}>Pending Orders</Text>
            </View>
            <View style={[styles.ordersMetricBlock, { backgroundColor: colors.background }]}>
              <Text style={[styles.ordersMetricValue, { color: colors.primary }]}>{orderStats.processing}</Text>
              <Text style={[styles.ordersMetricLabel, { color: colors.textSecondary }]}>Processing Orders</Text>
            </View>
            <View style={[styles.ordersMetricBlock, { backgroundColor: colors.background }]}>
              <Text style={[styles.ordersMetricValue, { color: colors.primary }]}>{orderStats.delivered}</Text>
              <Text style={[styles.ordersMetricLabel, { color: colors.textSecondary }]}>Delivered Orders</Text>
            </View>
          </View>
        </TouchableOpacity>

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
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{group.title}</Text>
              <Text style={[styles.sectionCount, { color: colors.primary, backgroundColor: colors.surface }]}>{group.data.length}</Text>
            </View>
            {group.data.length === 0 ? (
              <Text style={[styles.emptyInline, { color: colors.textSecondary }]}>Nothing here yet.</Text>
            ) : (
              group.data.slice(0, 3).map((booking) => (
                <TouchableOpacity
                  key={booking.id}
                  style={[styles.bookingRow, { backgroundColor: colors.surface }]}
                  onPress={() => router.push('/(provider)/bookings')}
                  accessibilityRole="button"
                  accessibilityLabel={`${booking.service_name} booking`}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.bookingService, { color: colors.text }]}>{booking.service_name}</Text>
                    <Text style={[styles.bookingMeta, { color: colors.textSecondary }]}>
                      {booking.date} {booking.time ? `· ${booking.time}` : ''}
                    </Text>
                  </View>
                  <Text style={[styles.bookingAmount, { color: colors.text }]}>{formatCurrency(booking.total_amount)}</Text>
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
  container: { flex: 1 },
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
  titleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  profileAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: { fontSize: 10, fontWeight: '700', color: '#fff' },
  greeting: { fontSize: FontSizes.xl, fontWeight: 'bold' },
  subGreeting: { fontSize: FontSizes.sm, marginTop: 4 },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  errorText: { flex: 1, fontSize: FontSizes.sm },
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
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
  },
  statValue: { fontSize: FontSizes.md, fontWeight: 'bold' },
  statLabel: {
    fontSize: FontSizes.xs,
    textAlign: 'center',
    marginTop: 4,
  },
  section: { marginBottom: Spacing.lg, paddingHorizontal: Spacing.lg },
  analyticsCard: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  analyticsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  analyticsMetric: {
    flexBasis: '30%',
    flexGrow: 1,
    minWidth: 80,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    backgroundColor: 'rgba(0,0,0,0.02)',
    alignItems: 'center',
  },
  analyticsValue: { fontSize: FontSizes.md, fontWeight: '700' },
  analyticsLabel: { fontSize: FontSizes.xs, marginTop: 2 },
  trayCard: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  trayItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  trayItemDetails: {
    flex: 1,
    minWidth: 0,
  },
  ordersCard: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  ordersCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  ordersMetrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  ordersMetricBlock: {
    flexBasis: '47%',
    flexGrow: 1,
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
  },
  ordersMetricValue: {
    fontSize: FontSizes.md,
    fontWeight: '700',
  },
  ordersMetricLabel: {
    fontSize: FontSizes.xs,
    marginTop: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  sectionTitle: { fontSize: FontSizes.md, fontWeight: '700' },
  sectionCount: {
    fontSize: FontSizes.sm,
    fontWeight: '700',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  emptyInline: { fontSize: FontSizes.sm },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  actionButton: { alignItems: 'center', width: 68 },
  actionIcon: {
    width: 52,
    height: 52,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  actionLabel: { fontSize: FontSizes.xs, textAlign: 'center' },
  bookingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  bookingService: { fontSize: FontSizes.sm, fontWeight: '600' },
  bookingMeta: { fontSize: FontSizes.xs, marginTop: 2 },
  bookingAmount: { fontSize: FontSizes.sm, fontWeight: '700', flexShrink: 0 },
});
