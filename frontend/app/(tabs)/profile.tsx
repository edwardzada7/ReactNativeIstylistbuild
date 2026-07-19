import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, FontSizes, Spacing, BorderRadius } from '../../src/constants/theme';
import { useAuth } from '../../src/contexts/AuthContext';
import { bookingService } from '../../src/services/booking.service';
import { Booking } from '../../src/types';

const comingSoon = (feature: string) =>
  Alert.alert('Coming soon', `${feature} is being wired up in a later phase.`);

const menuSections = (router: ReturnType<typeof useRouter>) => [
  {
    section: 'Account',
    items: [
      { icon: 'person-outline', label: 'Edit Profile', onPress: () => router.push('/settings/edit-profile') },
      { icon: 'wallet-outline', label: 'Wallet', onPress: () => router.push('/(tabs)/wallet') },
      { icon: 'star-outline', label: 'My Reviews', onPress: () => router.push('/settings/my-reviews') },
    ],
  },
  {
    section: 'Provider',
    items: [{ icon: 'briefcase-outline', label: 'Become a Provider', onPress: () => comingSoon('Become a Provider') }],
  },
  {
    section: 'Support',
    items: [
      { icon: 'help-circle-outline', label: 'Help Center', onPress: () => router.push('/settings/help') },
      { icon: 'document-text-outline', label: 'Terms & Privacy', onPress: () => router.push('/settings/terms') },
    ],
  },
  {
    section: 'Settings',
    items: [
      { icon: 'notifications-outline', label: 'Notifications', onPress: () => router.push('/notifications') },
      { icon: 'settings-outline', label: 'App Settings', onPress: () => router.push('/settings') },
    ],
  },
];

export default function Profile() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);

  const loadStats = useCallback(async () => {
    try {
      const list = await bookingService.getBookings({ role: 'customer' });
      setBookings(list);
    } catch (err) {
      // Non-fatal: the profile screen should still render without stats.
      console.error('[profile] failed to load booking stats', err);
      setBookings([]);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const { totalBookings, upcomingCount, completedCount } = useMemo(() => {
    const totalBookings = bookings.length;
    const upcomingCount = bookings.filter((b) =>
      ['pending', 'confirmed', 'arrived'].includes(b.status)
    ).length;
    const completedCount = bookings.filter((b) => b.status === 'completed').length;
    return { totalBookings, upcomingCount, completedCount };
  }, [bookings]);

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
            } catch (err) {
              console.error('[profile] logout failed', err);
            } finally {
              router.replace('/(auth)/login');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.backHeader}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.backHeaderTitle}>Profile</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>👤</Text>
          </View>
          <Text style={styles.userName}>{user?.full_name || 'Guest User'}</Text>
          <Text style={styles.userEmail}>{user?.email || 'guest@example.com'}</Text>
        </View>

        {/* Stats - customer-relevant only (booking activity, not provider metrics) */}
        <View style={styles.statsContainer}>
          {loadingStats ? (
            <ActivityIndicator color={Colors.primary} style={{ paddingVertical: Spacing.sm }} />
          ) : (
            <>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{totalBookings}</Text>
                <Text style={styles.statLabel}>Total Bookings</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{upcomingCount}</Text>
                <Text style={styles.statLabel}>Upcoming</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{completedCount}</Text>
                <Text style={styles.statLabel}>Completed</Text>
              </View>
            </>
          )}
        </View>

        {/* Menu Sections */}
        {menuSections(router).map((section, index) => (
          <View key={index} style={styles.menuSection}>
            <Text style={styles.sectionTitle}>{section.section}</Text>
            <View style={styles.menuItems}>
              {section.items.map((item, itemIndex) => (
                <TouchableOpacity
                  key={itemIndex}
                  style={styles.menuItem}
                  onPress={item.onPress}
                  accessibilityRole="button"
                  accessibilityLabel={item.label}
                >
                  <View style={styles.menuItemLeft}>
                    <Ionicons name={item.icon as any} size={22} color={Colors.text} />
                    <Text style={styles.menuItemLabel}>{item.label}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        {/* Logout Button */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          accessibilityRole="button"
          accessibilityLabel="Logout"
        >
          <Ionicons name="log-out-outline" size={22} color={Colors.error} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        <Text style={styles.version}>Version 1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingBottom: Spacing.xl,
  },
  backHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  backHeaderTitle: { fontSize: FontSizes.lg, fontWeight: 'bold', color: Colors.text },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
  },
  avatarContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  avatarText: {
    fontSize: 48,
  },
  userName: {
    fontSize: FontSizes.xl,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 4,
  },
  userEmail: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    backgroundColor: `${Colors.success}20`,
    borderRadius: BorderRadius.full,
  },
  badgeText: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
    color: Colors.success,
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: Colors.border,
  },
  statValue: {
    fontSize: FontSizes.xl,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  menuSection: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
  },
  menuItems: {
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  menuItemLabel: {
    fontSize: FontSizes.md,
    color: Colors.text,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: `${Colors.error}20`,
    borderRadius: BorderRadius.md,
  },
  logoutText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.error,
  },
  version: {
    fontSize: FontSizes.xs,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: Spacing.lg,
  },
});