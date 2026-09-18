import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { Colors, FontSizes, Spacing, BorderRadius } from '../../src/constants/theme';
import { reviewService } from '../../src/services/review.service';
import { Review } from '../../src/types';
import { useTheme } from '../../src/contexts/ThemeContext';

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
  const { colors } = useTheme();
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

  const averageRating = reviews.length
    ? (reviews.reduce((total, review) => total + Number(review.rating || 0), 0) / reviews.length).toFixed(1)
    : 'New';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>My Reviews</Text>
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
              <Ionicons name="star-outline" size={32} color={colors.textSecondary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>You haven&apos;t written any reviews yet.</Text>
            </View>
          ) : (
            <>
              <View style={[styles.summary, { backgroundColor: colors.surface }]}> 
                <View style={styles.summaryRatingRow}>
                  <Stars rating={Number(averageRating)} />
                  <Text style={[styles.summaryRating, { color: colors.text }]}>{averageRating}</Text>
                </View>
                <Text style={[styles.summaryCount, { color: colors.textSecondary }]}>
                  {reviews.length} review{reviews.length === 1 ? '' : 's'}
                </Text>
              </View>
              {reviews.map((review) => (
              <View key={review.id} style={[styles.card, { backgroundColor: colors.surface }]}>
                <View style={styles.cardHeader}>
                  <View style={styles.ratingRow}>
                    <Stars rating={review.rating} />
                    <Text style={[styles.ratingFigure, { color: colors.text }]}>{Number(review.rating).toFixed(1)}</Text>
                  </View>
                  {!!review.created_at && (
                    <Text style={[styles.date, { color: colors.textSecondary }]}>
                      {new Date(review.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </Text>
                  )}
                </View>
                {!!review.comment && <Text style={[styles.comment, { color: colors.textSecondary }]}>{review.comment}</Text>}
              </View>
              ))}
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerState: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.sm, paddingTop: Spacing.xxl },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  title: { fontSize: FontSizes.lg, fontWeight: 'bold' },
  content: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl },
  emptyText: { fontSize: FontSizes.sm, textAlign: 'center', paddingHorizontal: Spacing.xl },
  card: { borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: Spacing.sm },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  summary: { borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: Spacing.lg, alignItems: 'center', gap: Spacing.xs },
  summaryRatingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  summaryRating: { fontSize: FontSizes.xl, fontWeight: '700' },
  summaryCount: { fontSize: FontSizes.sm },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  ratingFigure: { fontSize: FontSizes.sm, fontWeight: '700' },
  date: { fontSize: FontSizes.xs },
  comment: { fontSize: FontSizes.sm, lineHeight: 20 },
});
