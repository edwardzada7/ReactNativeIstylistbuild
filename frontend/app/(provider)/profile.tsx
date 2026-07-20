import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, FontSizes, Spacing, BorderRadius } from '../../src/constants/theme';
import { useAuth } from '../../src/contexts/AuthContext';
import { providerService } from '../../src/services/provider.service';
import { Provider } from '../../src/types';

export default function ProviderProfile() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState<Provider | null>(null);

  const loadProfile = useCallback(async () => {
    if (!user?.id) return;
    try {
      const data = await providerService.getProviderFullProfile(user.id);
      setProfile(data);
    } catch (err) {
      console.error('[provider-profile-tab] failed to load', err);
    }
  }, [user?.id]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const menuItems = [
    { icon: 'cut-outline', label: 'My Services', onPress: () => router.push('/(provider)/services') },
    { icon: 'time-outline', label: 'Availability', onPress: () => router.push('/(provider)/availability') },
    { icon: 'calendar-outline', label: 'Bookings', onPress: () => router.push('/(provider)/bookings') },
    { icon: 'star-outline', label: 'Reviews', onPress: () => router.push('/(provider)/reviews') },
    {
      icon: 'wallet-outline',
      label: 'Wallet',
      onPress: () => router.push('/(provider)/wallet'),
    },
    { icon: 'settings-outline', label: 'Settings', onPress: () => router.push('/settings') },
    { icon: 'help-circle-outline', label: 'Help Center', onPress: () => router.push('/settings/help') },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.backHeader}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.backHeaderTitle}>Profile</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            <Ionicons name="storefront" size={40} color={Colors.primary} />
          </View>
          <Text style={styles.userName}>{user?.full_name || profile?.business_name || 'Provider'}</Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
          <View style={styles.badge}>
            <Ionicons name="briefcase" size={14} color={Colors.primary} />
            <Text style={styles.badgeText}>Service Provider</Text>
          </View>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{profile?.rating ? profile.rating.toFixed(1) : 'New'}</Text>
            <Text style={styles.statLabel}>Rating</Text>
          </View>
          <View style={styles.statDivider} />
          <TouchableOpacity
            style={styles.statItem}
            onPress={() => router.push('/(provider)/reviews')}
            accessibilityRole="button"
            accessibilityLabel="View reviews"
          >
            <Text style={styles.statValue}>{profile?.review_count ?? 0}</Text>
            <Text style={styles.statLabel}>Reviews</Text>
          </TouchableOpacity>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{profile?.services.length ?? 0}</Text>
            <Text style={styles.statLabel}>Services</Text>
          </View>
        </View>

        <View style={styles.menuItems}>
          {menuItems.map((item) => (
            <TouchableOpacity
              key={item.label}
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

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          accessibilityRole="button"
          accessibilityLabel="Logout"
        >
          <Ionicons name="log-out-outline" size={22} color={Colors.error} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { paddingBottom: Spacing.xl },
  backHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  backHeaderTitle: { fontSize: FontSizes.lg, fontWeight: 'bold', color: Colors.text },
  profileHeader: { alignItems: 'center', paddingVertical: Spacing.xl, paddingHorizontal: Spacing.lg },
  avatarContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  userName: { fontSize: FontSizes.xl, fontWeight: 'bold', color: Colors.text, marginBottom: 4 },
  userEmail: { fontSize: FontSizes.md, color: Colors.textSecondary },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    backgroundColor: `${Colors.primary}20`,
    borderRadius: BorderRadius.full,
  },
  badgeText: { fontSize: FontSizes.xs, fontWeight: '600', color: Colors.primary },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, backgroundColor: Colors.border },
  statValue: { fontSize: FontSizes.xl, fontWeight: 'bold', color: Colors.text, marginBottom: 4 },
  statLabel: { fontSize: FontSizes.sm, color: Colors.textSecondary },
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
  menuItemLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  menuItemLabel: { fontSize: FontSizes.md, color: Colors.text },
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
  logoutText: { fontSize: FontSizes.md, fontWeight: '600', color: Colors.error },
});
