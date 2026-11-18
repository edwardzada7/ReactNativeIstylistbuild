import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { BorderRadius, FontSizes, Spacing } from '../../src/constants/theme';
import { ProfileAvatar } from '../../src/components/common';
import { useTheme } from '../../src/contexts/ThemeContext';
import { useBlockedUsers } from '../../src/hooks/useBlockedUsers';
import { BlockedProfile, blockService } from '../../src/services/block.service';

/** Settings > Blocked Users: see who you blocked and unblock them. */
export default function BlockedUsers() {
  const router = useRouter();
  const { colors } = useTheme();
  const { blocked, loaded, unblock } = useBlockedUsers();
  const [rows, setRows] = useState<BlockedProfile[]>([]);
  const [loadingNames, setLoadingNames] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!loaded) return undefined;
    setLoadingNames(true);
    blockService
      .describe(Array.from(blocked))
      .then((list) => {
        if (active) setRows(list);
      })
      .finally(() => active && setLoadingNames(false));
    return () => {
      active = false;
    };
  }, [blocked, loaded]);

  const handleUnblock = (row: BlockedProfile) => {
    Alert.alert(`Unblock ${row.name}?`, 'Their posts, comments and messages will show up for you again.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unblock',
        onPress: async () => {
          setBusyId(row.id);
          try {
            await unblock(row.id);
          } catch (err: any) {
            Alert.alert('Could not unblock', err?.friendlyMessage || err?.message || 'Please try again.');
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  const showSpinner = !loaded || (loadingNames && rows.length === 0 && blocked.size > 0);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Blocked Users</Text>
        <View style={{ width: 24 }} />
      </View>

      {showSpinner ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : blocked.size === 0 ? (
        <View style={styles.centerState}>
          <Ionicons name="shield-checkmark-outline" size={48} color={colors.textMuted} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No blocked users</Text>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            People you block won't appear in your feed, comments or messages. You can block someone from their post or from a chat.
          </Text>
        </View>
      ) : (
        <FlatList
          data={rows.filter((row) => blocked.has(row.id))}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={[styles.row, { backgroundColor: colors.surface }]}>
              <ProfileAvatar uri={item.avatar} name={item.name} size={44} />
              <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                {item.name}
              </Text>
              <TouchableOpacity
                style={[styles.unblockButton, { borderColor: colors.border }]}
                onPress={() => handleUnblock(item)}
                disabled={busyId === item.id}
                accessibilityRole="button"
                accessibilityLabel={`Unblock ${item.name}`}
              >
                {busyId === item.id ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Text style={[styles.unblockText, { color: colors.primary }]}>Unblock</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  title: { fontSize: FontSizes.xl, fontWeight: '700' },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xl, gap: Spacing.sm },
  emptyTitle: { fontSize: FontSizes.lg, fontWeight: '700', marginTop: Spacing.sm },
  emptyText: { fontSize: FontSizes.sm, textAlign: 'center' },
  list: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl, gap: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: BorderRadius.lg },
  name: { flex: 1, fontSize: FontSizes.md, fontWeight: '600' },
  unblockButton: { minWidth: 84, alignItems: 'center', borderWidth: 1, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  unblockText: { fontSize: FontSizes.sm, fontWeight: '600' },
});
