import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, FontSizes, Spacing, BorderRadius } from '../../src/constants/theme';
import { useAuth } from '../../src/contexts/AuthContext';

/**
 * Settings hub (Phase 2). Every item here routes to a real, functioning
 * screen backed by an existing production endpoint or Supabase Auth call -
 * no placeholders, no mock data.
 */
export default function Settings() {
  const router = useRouter();
  const { logout, user } = useAuth();

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
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Settings</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.accountEmail}>{user?.email}</Text>
        {sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.menuItems}>
              {section.items.map((item) => (
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
          </View>
        ))}

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} accessibilityRole="button" accessibilityLabel="Logout">
          <Ionicons name="log-out-outline" size={22} color={Colors.error} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
        <Text style={styles.version}>Version 1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  title: { fontSize: FontSizes.lg, fontWeight: 'bold', color: Colors.text },
  content: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl },
  accountEmail: { fontSize: FontSizes.sm, color: Colors.textSecondary, marginBottom: Spacing.lg },
  section: { marginBottom: Spacing.lg },
  sectionTitle: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
  },
  menuItems: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, overflow: 'hidden' },
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
    marginTop: Spacing.md,
    paddingVertical: Spacing.md,
    backgroundColor: `${Colors.error}20`,
    borderRadius: BorderRadius.md,
  },
  logoutText: { fontSize: FontSizes.md, fontWeight: '600', color: Colors.error },
  version: { fontSize: FontSizes.xs, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.lg },
});
