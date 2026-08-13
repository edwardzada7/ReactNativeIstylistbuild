import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, FontSizes, Spacing, BorderRadius } from '../../src/constants/theme';
import { BrandLogo } from '../../src/components/branding';
import { useAuth } from '../../src/contexts/AuthContext';
import { useTheme } from '../../src/contexts/ThemeContext';

/**
 * Settings hub (Phase 2). Every item here routes to a real, functioning
 * screen backed by an existing production endpoint or Supabase Auth call -
 * no placeholders, no mock data.
 */
export default function Settings() {
  const router = useRouter();
  const { logout, user } = useAuth();
  const { colors } = useTheme();

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

  const sections = [
    {
      title: 'Account',
      items: [
        { icon: 'person-outline', label: 'Edit Profile', onPress: () => router.push('/settings/edit-profile') },
        { icon: 'lock-closed-outline', label: 'Change Password', onPress: () => router.push('/settings/change-password') },
        { icon: 'notifications-outline', label: 'Notifications', onPress: () => router.push('/notifications') },
      ],
    },
    {
      title: 'Support',
      items: [
        { icon: 'help-circle-outline', label: 'Help & Support', onPress: () => router.push('/settings/help') },
        { icon: 'document-text-outline', label: 'Terms of Service', onPress: () => router.push('/settings/terms') },
        { icon: 'shield-checkmark-outline', label: 'Privacy Policy', onPress: () => router.push('/settings/privacy') },
      ],
    },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.titleWrap}>
          <BrandLogo size={24} />
          <Text style={[styles.title, { color: colors.text }]}>Settings</Text>
        </View>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.accountEmail, { color: colors.textSecondary }]}>{user?.email}</Text>
        {sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{section.title}</Text>
            <View style={[styles.menuItems, { backgroundColor: colors.surface }]}>
              {section.items.map((item) => (
                <TouchableOpacity
                  key={item.label}
                  style={[styles.menuItem, { borderBottomColor: colors.border }]}
                  onPress={item.onPress}
                  accessibilityRole="button"
                  accessibilityLabel={item.label}
                >
                  <View style={styles.menuItemLeft}>
                    <Ionicons name={item.icon as any} size={22} color={colors.text} />
                    <Text style={[styles.menuItemLabel, { color: colors.text }]}>{item.label}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        <TouchableOpacity style={[styles.logoutButton, { backgroundColor: `${colors.error}20` }]} onPress={handleLogout} accessibilityRole="button" accessibilityLabel="Logout">
          <Ionicons name="log-out-outline" size={22} color={colors.error} />
          <Text style={[styles.logoutText, { color: colors.error }]}>Logout</Text>
        </TouchableOpacity>
        <Text style={[styles.version, { color: colors.textMuted }]}>Version 1.0.0</Text>
      </ScrollView>
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
  content: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl },
  accountEmail: { fontSize: FontSizes.sm, marginBottom: Spacing.lg },
  section: { marginBottom: Spacing.lg },
  sectionTitle: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
  },
  menuItems: { borderRadius: BorderRadius.lg, overflow: 'hidden' },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
  },
  menuItemLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  menuItemLabel: { fontSize: FontSizes.md },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  logoutText: { fontSize: FontSizes.md, fontWeight: '600' },
  version: { fontSize: FontSizes.xs, textAlign: 'center', marginTop: Spacing.lg },
});
