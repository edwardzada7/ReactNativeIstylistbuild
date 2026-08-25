import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image as RNImage,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, FontSizes, Spacing, BorderRadius } from '../../src/constants/theme';
import { feedService } from '../../src/services/feed.service';
import { useAuth } from '../../src/contexts/AuthContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { Post } from '../../src/types';
import { ProfileAvatar, ReportModal } from '../../src/components/common';

export default function Feed() {
  const router = useRouter();
  const { user, isProvider } = useAuth();
  const { colors } = useTheme();
  const [feedData, setFeedData] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reportTargetId, setReportTargetId] = useState<string | null>(null);

  const loadFeed = useCallback(async () => {
    try {
      setLoading(true);
      const response = await feedService.getFeed({ page: 1, per_page: 20 });
      setFeedData(response.data || []);
    } catch (err) {
      console.error('[feed] failed to load', err);
      // If API fails (503 - migration not applied), show empty state
      setFeedData([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  const toggleLike = async (postId: string) => {
    if (!user?.auth_id) {
      return; // Require auth to like
    }

    const post = feedData.find(p => String(p.id) === String(postId));
    if (!post) return;

    const newLikedState = !post.liked_by_me;

    // Optimistic update
    setFeedData((prevData) =>
      prevData.map((p) =>
        String(p.id) === String(postId)
          ? {
              ...p,
              liked_by_me: newLikedState,
              likes_count: newLikedState ? (p.likes_count || 0) + 1 : (p.likes_count || 0) - 1,
            }
          : p
      )
    );

    try {
      if (newLikedState) {
        await feedService.likePost(String(postId));
      } else {
        await feedService.unlikePost(String(postId));
      }
    } catch (err) {
      // Revert on error
      setFeedData((prevData) =>
        prevData.map((p) =>
          String(p.id) === String(postId)
            ? {
                ...p,
                liked_by_me: post.liked_by_me,
                likes_count: post.likes_count,
              }
            : p
        )
      );
    }
  };

  const handleShare = async (post: Post) => {
    try {
      const message = post.caption || '';
      await Share.share({
        message: message,
        url: post.image_url,
      });
    } catch (error) {
      console.error('[feed] share failed', error);
    }
  };

  const handleComment = () => {
    Alert.alert('Comments coming soon', 'This feature will be available in a future update.');
  };

  const handleReportPost = (postId: string) => {
    setReportTargetId(postId);
  };

  const handlePostMenu = (post: Post) => {
    const isOwnPost = post.provider_auth_id === user?.auth_id || post.user_id === user?.auth_id || post.provider?.auth_id === user?.auth_id;
    console.log('[feed] handlePostMenu - isOwnPost:', isOwnPost, 'post.provider_auth_id:', post.provider_auth_id, 'user.auth_id:', user?.auth_id);
    if (!isOwnPost) return;

    Alert.alert(
      'Manage Post',
      'What would you like to do?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Edit',
          onPress: () => router.push(`/(provider)/edit-post?id=${post.id}`),
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => handleDeletePost(post.id),
        },
      ]
    );
  };

  const handleDeletePost = async (postId: string) => {
    Alert.alert(
      'Delete Post',
      'Are you sure you want to delete this post? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await feedService.deletePost(postId);
              setFeedData((prevData) => prevData.filter((p) => String(p.id) !== String(postId)));
            } catch (err) {
              console.error('[feed] delete failed', err);
              Alert.alert('Error', 'Could not delete post.');
            }
          },
        },
      ]
    );
  };

  const renderPost = ({ item }: { item: Post }) => (
    <View style={[styles.postCard, { backgroundColor: colors.surface }]}>
      <View style={styles.postHeader}>
        <TouchableOpacity 
          style={styles.userInfo}
          onPress={() => item.provider?.id && router.push(`/provider/${item.provider.id}`)}
          accessibilityRole="button"
        >
          <ProfileAvatar 
            uri={item.provider?.avatarUrl || item.provider?.profileImage || item.provider?.photo_url || item.provider?.profile_image_url || item.provider?.avatar}
            name={item.provider?.display_name || item.provider?.business_name || item.provider?.name || item.provider?.full_name || item.user?.full_name || item.user?.name || 'Provider'} 
            size={44}
            type="provider"
          />
          <View>
            <Text style={[styles.userName, { color: colors.text }]}>
              {item.provider?.businessName || item.user?.displayName || 'Stylist'}
            </Text>
            <Text style={[styles.timestamp, { color: colors.textSecondary }]}>{item.created_at ? new Date(item.created_at).toLocaleDateString() : ''}</Text>
          </View>
        </TouchableOpacity>
        {(item.provider_auth_id === user?.auth_id || item.user_id === user?.auth_id || item.provider?.auth_id === user?.auth_id) && (
          <TouchableOpacity
            style={styles.menuButton}
            onPress={() => handlePostMenu(item)}
            accessibilityRole="button"
            accessibilityLabel="Manage post"
          >
            <Ionicons name="ellipsis-horizontal" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {item.image_url && (
        <RNImage source={{ uri: item.image_url }} style={styles.postImage} />
      )}

      {item.caption && (
        <Text style={[styles.postContent, { color: colors.text }]}>{item.caption}</Text>
      )}

      <View style={[styles.postActions, { borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => toggleLike(String(item.id))}
        >
          <Ionicons
            name={item.liked_by_me ? 'heart' : 'heart-outline'}
            size={22}
            color={item.liked_by_me ? colors.error : colors.textSecondary}
          />
          <Text style={[styles.actionText, { color: colors.textSecondary }]}>{item.likes_count || 0}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={handleComment}>
          <Ionicons name="chatbubble-outline" size={20} color={colors.textSecondary} />
          <Text style={[styles.actionText, { color: colors.textSecondary }]}>{item.comments_count || 0}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={() => handleShare(item)}>
          <Ionicons name="share-social-outline" size={20} color={colors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleReportPost(String(item.id))}
          accessibilityRole="button"
          accessibilityLabel="Report post"
        >
          <Ionicons name="flag-outline" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {!isProvider && (
        <View style={styles.header}>
          <View style={styles.titleWrap}>
            <Text style={[styles.title, { color: colors.text }]}>Feed</Text>
          </View>
        </View>
      )}

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : feedData.length === 0 ? (
        <View style={styles.centerState}>
          <Ionicons name="images-outline" size={48} color={colors.textMuted} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            {isProvider ? 'No posts yet. Tap + to create your first post!' : 'No posts yet. Check back soon!'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={feedData}
          renderItem={renderPost}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.feedList}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadFeed();
              }}
              tintColor={colors.primary}
            />
          }
        />
      )}
      <ReportModal
        visible={reportTargetId !== null}
        targetId={reportTargetId}
        targetType="FEED_POST"
        onClose={() => setReportTargetId(null)}
        onSubmitted={() => Alert.alert('Report submitted', 'Thank you. We will review this post.')}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  titleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  title: {
    fontSize: FontSizes.xxl,
    fontWeight: 'bold',
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingTop: Spacing.xxl,
  },
  emptyText: {
    fontSize: FontSizes.sm,
    textAlign: 'center',
    paddingHorizontal: Spacing.xl,
  },
  feedList: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  postCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  menuButton: {
    padding: Spacing.sm,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    fontSize: 24,
  },
  userName: {
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  timestamp: {
    fontSize: FontSizes.xs,
  },
  postImage: {
    width: '100%',
    height: 300,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  postContent: {
    fontSize: FontSizes.md,
    lineHeight: 22,
    marginBottom: Spacing.md,
  },
  postActions: {
    flexDirection: 'row',
    gap: Spacing.lg,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
});