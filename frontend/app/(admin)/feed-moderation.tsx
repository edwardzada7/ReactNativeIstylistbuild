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
      const response = await feedService.getFeed({ page: 1, per_page: 50 });
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

  const handleAction = async (post: Post, action: 'delete') => {
    setActioningId(String(post.id));
    try {
      if (action === 'delete') {
        await feedService.deletePost(String(post.id));
        setPosts((prev) => prev.filter((p) => p.id !== post.id));
      }
    } catch (err: any) {
      Alert.alert('Error', err?.friendlyMessage || 'Could not perform this action.');
    } finally {
      setActioningId(null);
    }
  };

  const filteredPosts = posts.filter((post) => {
    // Only show active posts since backend has no approve/reject workflow
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
          <Text style={styles.emptyText}>No posts found</Text>
        </View>
      ) : (
        <FlatList
          data={filteredPosts}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <View style={styles.card}>
              {item.image_url && (
                <View style={styles.cardImageContainer}>
                  <Text style={styles.cardImagePlaceholder}>Image</Text>
                </View>
              )}
              <View style={styles.cardContent}>
                <Text style={styles.cardCaption} numberOfLines={2}>
                  {item.caption || 'No caption'}
                </Text>
                <Text style={styles.cardMeta}>
                  By: {item.provider?.name || 'Unknown'} • {item.likes_count || 0} likes
                </Text>
                <View style={styles.cardActions}>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.deleteBtn]}
                    onPress={() => handleAction(item, 'delete')}
                    disabled={actioningId === String(item.id)}
                  >
                    <Ionicons name="trash" size={16} color="#fff" />
                    <Text style={styles.actionBtnText}>Delete</Text>
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
  cardImageContainer: {
    height: 150,
    backgroundColor: Colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardImagePlaceholder: { fontSize: FontSizes.sm, color: Colors.textMuted },
  cardContent: { padding: Spacing.md },
  cardCaption: { fontSize: FontSizes.md, fontWeight: '600', color: Colors.text, marginBottom: Spacing.xs },
  cardMeta: { fontSize: FontSizes.xs, color: Colors.textSecondary, marginBottom: Spacing.sm },
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
  deleteBtn: { backgroundColor: Colors.error },
});
