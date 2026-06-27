import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSizes, Spacing, BorderRadius } from '../../src/constants/theme';

const posts = [
  {
    id: '1',
    user: {
      name: 'Sarah Johnson',
      avatar: '👩',
    },
    content: 'Amazing transformation at Glamour Studio! Highly recommend their hair color service 💇‍♀️',
    likes: 124,
    comments: 18,
    timestamp: '2 hours ago',
    isLiked: false,
  },
  {
    id: '2',
    user: {
      name: 'Beauty Expert',
      avatar: '💄',
    },
    content: 'Pro tip: Always moisturize before applying makeup for that flawless finish! ✨',
    likes: 89,
    comments: 12,
    timestamp: '5 hours ago',
    isLiked: true,
  },
];

export default function Feed() {
  const [feedData, setFeedData] = useState(posts);

  const toggleLike = (postId: string) => {
    setFeedData((prevData) =>
      prevData.map((post) =>
        post.id === postId
          ? {
              ...post,
              isLiked: !post.isLiked,
              likes: post.isLiked ? post.likes - 1 : post.likes + 1,
            }
          : post
      )
    );
  };

  const renderPost = ({ item }: { item: typeof posts[0] }) => (
    <View style={styles.postCard}>
      <View style={styles.postHeader}>
        <View style={styles.userInfo}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{item.user.avatar}</Text>
          </View>
          <View>
            <Text style={styles.userName}>{item.user.name}</Text>
            <Text style={styles.timestamp}>{item.timestamp}</Text>
          </View>
        </View>
        <TouchableOpacity>
          <Ionicons name="ellipsis-horizontal" size={20} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <Text style={styles.postContent}>{item.content}</Text>

      <View style={styles.postActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => toggleLike(item.id)}
        >
          <Ionicons
            name={item.isLiked ? 'heart' : 'heart-outline'}
            size={22}
            color={item.isLiked ? Colors.error : Colors.textSecondary}
          />
          <Text style={styles.actionText}>{item.likes}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="chatbubble-outline" size={20} color={Colors.textSecondary} />
          <Text style={styles.actionText}>{item.comments}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="share-social-outline" size={20} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Feed</Text>
        <TouchableOpacity style={styles.addButton}>
          <Ionicons name="add" size={24} color={Colors.text} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={feedData}
        renderItem={renderPost}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.feedList}
        showsVerticalScrollIndicator={false}
      />
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
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
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