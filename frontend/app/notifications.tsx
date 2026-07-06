import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, FontSizes, Spacing } from '../src/constants/theme';

/**
 * Notifications (Phase 5A - navigation/UX only).
 *
 * No notifications endpoint exists on the production API yet (confirmed via
 * direct probe: GET /api/notifications -> 404). This is a UI-only screen so
 * the "Notifications" icon in the top bar has a real destination; wiring it
 * to a real feed is a future backend-dependent phase, not part of this
 * navigation refactor.
 */
export default function Notifications() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Notifications</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.emptyState}>
        <View style={styles.iconWrap}>
          <Ionicons name="notifications-outline" size={40} color={Colors.primary} />
        </View>
        <Text style={styles.emptyTitle}>No notifications yet</Text>
        <Text style={styles.emptySubtitle}>
          Booking updates, payments, and messages will show up here.
        </Text>
      </View>
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
    backgroundColor: `${Colors.primary}18`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  emptyTitle: { fontSize: FontSizes.lg, fontWeight: '700', color: Colors.text, marginBottom: Spacing.sm },
  emptySubtitle: { fontSize: FontSizes.sm, color: Colors.textSecondary, textAlign: 'center' },
});
