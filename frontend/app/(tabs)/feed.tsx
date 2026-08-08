import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
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
import { Post } from '../../src/types';

export default function Feed() {
  const router = useRouter();
  const { user, isProvider } = useAuth();
  const [feedData, setFeedData] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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
    <View style={styles.postCard}>
      <View style={styles.postHeader}>
        <TouchableOpacity 
          style={styles.userInfo}
          onPress={() => item.provider?.id && router.push(`/provider/${item.provider.id}`)}
          accessibilityRole="button"
        >
          <View style={styles.avatar}>
            {item.provider?.photo_url || item.provider?.profile_image_url || item.provider?.avatar ? (
              <Image
                source={{ uri: item.provider?.photo_url || item.provider?.profile_image_url || item.provider?.avatar }}
                style={styles.avatarImage}
              />
            ) : (
              <Text style={styles.avatarText}>
                {(item.provider?.display_name || item.provider?.name || 'P').charAt(0).toUpperCase()}
              </Text>
            )}
          </View>
          <View>
            <Text style={styles.userName}>
              {item.provider?.display_name || 
               item.provider?.business_name || 
               item.provider?.name || 
               'Provider'}
            </Text>
            <Text style={styles.timestamp}>{item.created_at ? new Date(item.created_at).toLocaleDateString() : ''}</Text>
          </View>
        </TouchableOpacity>
        {(item.provider_auth_id === user?.auth_id || item.user_id === user?.auth_id || item.provider?.auth_id === user?.auth_id) && (
          <TouchableOpacity
            style={styles.menuButton}
            onPress={() => handlePostMenu(item)}
            accessibilityRole="button"
            accessibilityLabel="Manage post"
          >
            <Ionicons name="ellipsis-horizontal" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {item.image_url && (
        <Image source={{ uri: item.image_url }} style={styles.postImage} />
      )}

      {item.caption && (
        <Text style={styles.postContent}>{item.caption}</Text>
      )}

      <View style={styles.postActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => toggleLike(String(item.id))}
        >
          <Ionicons
            name={item.liked_by_me ? 'heart' : 'heart-outline'}
            size={22}
            color={item.liked_by_me ? Colors.error : Colors.textSecondary}
          />
          <Text style={styles.actionText}>{item.likes_count || 0}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={handleComment}>
          <Ionicons name="chatbubble-outline" size={20} color={Colors.textSecondary} />
          <Text style={styles.actionText}>{item.comments_count || 0}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={() => handleShare(item)}>
          <Ionicons name="share-social-outline" size={20} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {!isProvider && (
        <View style={styles.header}>
          <Text style={styles.title}>Feed</Text>
        </View>
      )}

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : feedData.length === 0 ? (
        <View style={styles.centerState}>
          <Ionicons name="images-outline" size={48} color={Colors.textMuted} />
          <Text style={styles.emptyText}>
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
              tintColor={Colors.primary}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  title: {
    fontSize: FontSizes.xxl,
    fontWeight: 'bold',
    color: Colors.text,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
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
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: Spacing.xl,
  },
  feedList: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  postCard: {
    backgroundColor: Colors.surface,
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
    backgroundColor: Colors.surfaceLight,
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
    color: Colors.text,
  },
  timestamp: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
  },
  postImage: {
    width: '100%',
    height: 300,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  postContent: {
    fontSize: FontSizes.md,
    color: Colors.text,
    lineHeight: 22,
    marginBottom: Spacing.md,
  },
  postActions: {
    flexDirection: 'row',
    gap: Spacing.lg,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
});