import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { Colors, FontSizes, Spacing, BorderRadius } from '../src/constants/theme';
import { BrandLogo } from '../src/components/branding';
import { notificationService } from '../src/services/notification.service';
import { Notification } from '../src/types';
import { useTheme } from '../src/contexts/ThemeContext';
import { formatRelativeTime } from '../src/utils/date';

const TYPE_ICON: Record<string, string> = {
  booking: 'calendar-outline',
  payment: 'wallet-outline',
  message: 'chatbubble-outline',
  review: 'star-outline',
  system: 'notifications-outline',
};

const timeAgo = (iso?: string | null) => formatRelativeTime(iso);

/**
 * Notifications (Phase 3A). Real data via notificationService, which reads
 * directly from Supabase's `notifications` table (RLS-verified: users only
 * see their own rows). No mock data, no placeholder.
 */
export default function Notifications() {
  const router = useRouter();
  const { colors } = useTheme();
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnreadCount = useCallback(async () => {
    try {
      const res = await notificationService.getUnreadCount();
      setUnreadCount(res.count || 0);
    } catch (err) {
      console.error('[notifications] unread count failed', err);
    }
  }, []);

  const loadData = useCallback(async (pageNum = 1, append = false) => {
    try {
      const res = await notificationService.getNotifications(pageNum);
      setItems((prev) => (append ? [...prev, ...res.data] : res.data));
      setTotalPages(res.total_pages);
      setPage(pageNum);
    } catch (err) {
      console.error('[notifications] failed to load', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData(1);
      refreshUnreadCount();
    }, [loadData, refreshUnreadCount])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadData(1);
  };

  const handleLoadMore = () => {
    if (loadingMore || page >= totalPages) return;
    setLoadingMore(true);
    loadData(page + 1, true);
  };

  const navigateToNotification = useCallback(
    (item: Notification) => {
      const data = item?.data || {};
      const explicitRoute = data.route || data.pathname || data.path || data.screen || data.target;
      if (typeof explicitRoute === 'string' && explicitRoute.startsWith('/')) {
        router.push(explicitRoute as any);
        return;
      }
      if (data.booking_id) {
        router.push(`/bookings/${String(data.booking_id)}`);
        return;
      }
      if (data.provider_id) {
        router.push(`/provider/${String(data.provider_id)}`);
        return;
      }
      if (data.order_id) {
        router.push('/shop/orders');
        return;
      }
      if (data.feed_id || data.post_id || data.postId) {
        router.push('/(tabs)/feed');
        return;
      }
      if (item.type === 'message') {
        router.push('/messages');
        return;
      }
      if (item.type === 'booking') {
        router.push('/(tabs)/bookings');
        return;
      }
      router.push('/(tabs)');
    },
    [router]
  );

  const handlePressItem = async (item: Notification) => {
    if (!item.is_read) {
      setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, is_read: true } : n)));
      try {
        await notificationService.markAsRead(item.id);
        await refreshUnreadCount();
      } catch (err) {
        console.error('[notifications] mark-as-read failed', err);
      }
    }
    navigateToNotification(item);
  };

  const handleMarkAllRead = async () => {
    setMarkingAll(true);
    try {
      await notificationService.markAllAsRead();
      setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('[notifications] mark-all-read failed', err);
    } finally {
      setMarkingAll(false);
    }
  };

  const hasUnread = items.some((n) => !n.is_read) || unreadCount > 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.titleWrap}>
          <BrandLogo size={24} />
          <Text style={[styles.title, { color: colors.text }]}>Notifications</Text>
        </View>
        {hasUnread ? (
          <TouchableOpacity onPress={handleMarkAllRead} disabled={markingAll} accessibilityRole="button" accessibilityLabel="Mark all as read">
            {markingAll ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={[styles.markAllText, { color: colors.primary }]}>Mark all read</Text>
            )}
          </TouchableOpacity>
        ) : (
          <View style={{ width: 24 }} />
        )}
      </View>

      {loading ? (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={[styles.iconWrap, { backgroundColor: `${colors.primary}18` }]}>
            <Ionicons name="notifications-outline" size={40} color={colors.primary} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No notifications yet</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            Booking updates, payments, and messages will show up here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
          onEndReachedThreshold={0.4}
          onEndReached={handleLoadMore}
          ListFooterComponent={loadingMore ? <ActivityIndicator style={{ marginVertical: Spacing.md }} color={colors.primary} /> : null}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.item, { backgroundColor: colors.surface }, !item.is_read && { borderWidth: 1, borderColor: `${colors.primary}40` }]}
              onPress={() => handlePressItem(item)}
              accessibilityRole="button"
              accessibilityLabel={item.body}
            >
              <View style={[styles.itemIconWrap, { backgroundColor: `${colors.primary}18` }]}>
                <Ionicons name={(TYPE_ICON[item.type] || 'notifications-outline') as any} size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.itemBody, { color: colors.text }]}>{item.body}</Text>
                <Text style={[styles.itemTime, { color: colors.textMuted }]}>{timeAgo(item.created_at)}</Text>
              </View>
              {!item.is_read && <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />}
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  titleWrap: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  title: { fontSize: FontSizes.lg, fontWeight: 'bold' },
  markAllText: { fontSize: FontSizes.sm, fontWeight: '600' },
  list: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  emptyTitle: { fontSize: FontSizes.lg, fontWeight: '700', marginBottom: Spacing.sm },
  emptySubtitle: { fontSize: FontSizes.sm, textAlign: 'center' },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  itemIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemBody: { fontSize: FontSizes.sm, lineHeight: 19 },
  itemTime: { fontSize: FontSizes.xs, marginTop: 4 },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },
});
