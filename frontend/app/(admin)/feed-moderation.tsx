import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, FontSizes, Spacing, BorderRadius } from '../../src/constants/theme';
import { feedService } from '../../src/services/feed.service';
import { Post } from '../../src/types';

export default function FeedModeration() {
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actioningId, setActioningId] = useState<string | null>(null);

  const loadPosts = useCallback(async () => {
    try {
      setLoading(true);
      const response = await feedService.getModerationPosts({ page: 1, per_page: 50 });
      setPosts(response.data || []);
    } catch (err) {
      console.error('[feed-moderation] failed to load', err);
      setPosts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  const handleAction = async (post: Post, action: 'approve' | 'reject') => {
    setActioningId(String(post.id));
    try {
      await feedService.updatePostModeration(String(post.id), action);
      setPosts((prev) => prev.filter((p) => String(p.id) !== String(post.id)));
    } catch (err: any) {
      Alert.alert('Error', err?.friendlyMessage || 'Could not perform this action.');
    } finally {
      setActioningId(null);
    }
  };

  const filteredPosts = posts.filter((post) => {
    return post.is_active !== false;
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Feed Moderation</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : filteredPosts.length === 0 ? (
        <View style={styles.centerState}>
          <Ionicons name="images-outline" size={48} color={Colors.textMuted} />
          <Text style={styles.emptyText}>No posts pending moderation</Text>
        </View>
      ) : (
        <FlatList
          data={filteredPosts}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <View style={styles.card}>
              {item.image_url ? (
                <Image source={{ uri: item.image_url }} style={styles.cardImage} />
              ) : (
                <View style={styles.cardImageContainer}>
                  <Ionicons name="image-outline" size={28} color={Colors.textMuted} />
                </View>
              )}
              <View style={styles.cardContent}>
                <Text style={styles.cardCaption} numberOfLines={2}>
                  {item.caption || 'No caption'}
                </Text>
                <Text style={styles.cardMeta}>
                  Author: {item.provider?.name || item.provider?.display_name || item.provider?.business_name || 'Unknown'}
                </Text>
                <Text style={styles.cardMeta}>
                  Created: {item.created_at ? new Date(item.created_at).toLocaleDateString() : 'Unknown'}
                </Text>
                <View style={styles.statusBadge}>
                  <Text style={styles.statusText}>Pending Review</Text>
                </View>
                <View style={styles.cardActions}>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.approveBtn]}
                    onPress={() => handleAction(item, 'approve')}
                    disabled={actioningId === String(item.id)}
                  >
                    <Ionicons name="checkmark" size={16} color="#fff" />
                    <Text style={styles.actionBtnText}>Approve</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.rejectBtn]}
                    onPress={() => handleAction(item, 'reject')}
                    disabled={actioningId === String(item.id)}
                  >
                    <Ionicons name="close" size={16} color="#fff" />
                    <Text style={styles.actionBtnText}>Reject</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadPosts(); }} tintColor={Colors.primary} />
          }
          contentContainerStyle={styles.list}
        />
      )}
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
  centerState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  emptyText: { fontSize: FontSizes.sm, color: Colors.textSecondary },
  list: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },
  cardImage: { width: '100%', height: 180, resizeMode: 'cover' },
  cardImageContainer: {
    height: 180,
    backgroundColor: Colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: { padding: Spacing.md },
  cardCaption: { fontSize: FontSizes.md, fontWeight: '600', color: Colors.text, marginBottom: Spacing.xs },
  cardMeta: { fontSize: FontSizes.xs, color: Colors.textSecondary, marginBottom: Spacing.xs },
  statusBadge: {
    alignSelf: 'flex-start',
    backgroundColor: `${Colors.warning}20`,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.sm,
  },
  statusText: { fontSize: FontSizes.xs, fontWeight: '700', color: Colors.warning },
  cardActions: { flexDirection: 'row', gap: Spacing.sm },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  actionBtnText: { fontSize: FontSizes.xs, fontWeight: '600', color: '#fff' },
  approveBtn: { backgroundColor: Colors.success },
  rejectBtn: { backgroundColor: Colors.error },
});
