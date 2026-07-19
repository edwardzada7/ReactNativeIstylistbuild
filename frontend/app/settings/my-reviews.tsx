import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { Colors, FontSizes, Spacing, BorderRadius } from '../../src/constants/theme';
import { reviewService } from '../../src/services/review.service';
import { Review } from '../../src/types';

const Stars = ({ rating }: { rating: number }) => (
  <View style={{ flexDirection: 'row', gap: 2 }}>
    {[1, 2, 3, 4, 5].map((n) => (
      <Ionicons key={n} name={n <= rating ? 'star' : 'star-outline'} size={14} color={Colors.warning} />
    ))}
  </View>
);

/**
 * My Reviews (customer, Phase 2). Real data via reviewService.getMyReviews()
 * -> GET /reviews/me?auth_id&role=customer (now sending the required query
 * params that were previously missing).
 */
export default function MyReviews() {
  const router = useRouter();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const list = await reviewService.getMyReviews();
      setReviews(list);
    } catch (err) {
      console.error('[my-reviews] failed to load', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>My Reviews</Text>
        <View style={{ width: 24 }} />
      </View>
      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadData();
              }}
              tintColor={Colors.primary}
            />
          }
        >
          {reviews.length === 0 ? (
            <View style={styles.centerState}>
              <Ionicons name="star-outline" size={32} color={Colors.textMuted} />
              <Text style={styles.emptyText}>You haven&apos;t written any reviews yet.</Text>
            </View>
          ) : (
            reviews.map((review) => (
              <View key={review.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Stars rating={review.rating} />
                  {!!review.created_at && (
                    <Text style={styles.date}>
                      {new Date(review.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </Text>
                  )}
                </View>
                {!!review.comment && <Text style={styles.comment}>{review.comment}</Text>}
              </View>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centerState: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.sm, paddingTop: Spacing.xxl },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  title: { fontSize: FontSizes.lg, fontWeight: 'bold', color: Colors.text },
  content: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl },
  emptyText: { fontSize: FontSizes.sm, color: Colors.textSecondary, textAlign: 'center', paddingHorizontal: Spacing.xl },
  card: { backgroundColor: Colors.surface, borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: Spacing.sm },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  date: { fontSize: FontSizes.xs, color: Colors.textMuted },
  comment: { fontSize: FontSizes.sm, color: Colors.textSecondary, lineHeight: 20 },
});
