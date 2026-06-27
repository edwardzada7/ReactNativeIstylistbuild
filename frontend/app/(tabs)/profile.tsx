import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, FontSizes, Spacing, BorderRadius } from '../../src/constants/theme';
import { useAuth } from '../../src/contexts/AuthContext';

const menuItems = [
  {
    section: 'Account',
    items: [
      { icon: 'person-outline', label: 'Edit Profile', route: '/profile/edit' },
      { icon: 'wallet-outline', label: 'Wallet', route: '/wallet' },
      { icon: 'heart-outline', label: 'Saved Providers', route: '/saved' },
      { icon: 'star-outline', label: 'My Reviews', route: '/reviews' },
    ],
  },
  {
    section: 'Provider',
    items: [
      { icon: 'briefcase-outline', label: 'Become a Provider', route: '/become-provider' },
    ],
  },
  {
    section: 'Support',
    items: [
      { icon: 'help-circle-outline', label: 'Help Center', route: '/support' },
      { icon: 'shield-outline', label: 'Safety Center', route: '/safety' },
      { icon: 'document-text-outline', label: 'Terms & Privacy', route: '/legal' },
    ],
  },
  {
    section: 'Settings',
    items: [
      { icon: 'notifications-outline', label: 'Notifications', route: '/settings/notifications' },
      { icon: 'settings-outline', label: 'App Settings', route: '/settings' },
    ],
  },
];

export default function Profile() {
  const router = useRouter();
  const { user, logout } = useAuth();

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
            await logout();
            router.replace('/(auth)/login');
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
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
          {user?.role === 'provider' && (
            <View style={styles.badge}>
              <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
              <Text style={styles.badgeText}>Verified Provider</Text>
            </View>
          )}
        </View>

        {/* Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>12</Text>
            <Text style={styles.statLabel}>Bookings</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>8</Text>
            <Text style={styles.statLabel}>Reviews</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>4.8</Text>
            <Text style={styles.statLabel}>Rating</Text>
          </View>
        </View>

        {/* Menu Sections */}
        {menuItems.map((section, index) => (
          <View key={index} style={styles.menuSection}>
            <Text style={styles.sectionTitle}>{section.section}</Text>
            <View style={styles.menuItems}>
              {section.items.map((item, itemIndex) => (
                <TouchableOpacity
                  key={itemIndex}
                  style={styles.menuItem}
                  onPress={() => {
                    // Navigation will be implemented when these screens are created
                    console.log('Navigate to:', item.route);
                  }}
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
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
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