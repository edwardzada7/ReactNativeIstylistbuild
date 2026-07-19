import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { Colors, FontSizes, Spacing, BorderRadius } from '../../src/constants/theme';
import { useAuth } from '../../src/contexts/AuthContext';
import { providerService } from '../../src/services/provider.service';
import { Review } from '../../src/types';

const Stars = ({ rating, size = 14 }: { rating: number; size?: number }) => (
  <View style={{ flexDirection: 'row', gap: 2 }}>
    {[1, 2, 3, 4, 5].map((n) => (
      <Ionicons
        key={n}
        name={n <= Math.round(rating) ? 'star' : 'star-outline'}
        size={size}
        color={Colors.warning}
      />
    ))}
  </View>
);

/**
 * Provider Reviews (Phase 2). Real data only: providerService.getProviderReviews()
 * calls GET /providers/{auth_id}/reviews (resolving the provider's Supabase
 * auth UUID first, per the confirmed production contract) and
 * getProviderFullProfile() supplies the real rating/review_count summary.
 * No mock data, no new endpoints.
 */
export default function ProviderReviews() {
  const router = useRouter();
  const { user } = useAuth();
  const providerId = user?.id;

  const [reviews, setReviews] = useState<Review[]>([]);
  const [summary, setSummary] = useState<{ rating: number; review_count: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!providerId) return;
    try {
      setError(null);
      const [reviewList, profile] = await Promise.all([
        providerService.getProviderReviews(providerId),
        providerService.getProviderFullProfile(providerId).catch(() => null),
      ]);
      setReviews(reviewList);
      if (profile) setSummary({ rating: profile.rating, review_count: profile.review_count });
    } catch (err: any) {
      console.error('[provider-reviews] failed to load', err);
      setError(err?.friendlyMessage || 'Could not load your reviews.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [providerId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

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
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.primary} />
          }
        >
          {error && <Text style={styles.errorText}>{error}</Text>}

          <View style={styles.summaryCard}>
            <Text style={styles.summaryRating}>
              {summary?.rating ? summary.rating.toFixed(1) : 'New'}
            </Text>
            <Stars rating={summary?.rating || 0} size={18} />
            <Text style={styles.summaryCount}>
              {summary?.review_count ?? reviews.length} review{(summary?.review_count ?? reviews.length) === 1 ? '' : 's'}
            </Text>
          </View>

          {reviews.length === 0 ? (
            <View style={styles.centerState}>
              <Ionicons name="star-outline" size={32} color={Colors.textMuted} />
              <Text style={styles.emptyText}>
                No reviews yet. They will show up here once customers rate your service.
              </Text>
            </View>
          ) : (
            reviews.map((review) => (
              <View key={review.id} style={styles.reviewCard}>
                <View style={styles.reviewHeader}>
                  <View style={styles.avatarCircle}>
                    <Ionicons name="person" size={18} color={Colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.customerName}>{review.customer_name}</Text>
                    {!!review.created_at && (
                      <Text style={styles.reviewDate}>
                        {new Date(review.created_at).toLocaleDateString('en-NG', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </Text>
                    )}
                  </View>
                  <Stars rating={review.rating} />
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
  errorText: { fontSize: FontSizes.sm, color: Colors.error, marginBottom: Spacing.md },
  emptyText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: Spacing.xl,
  },
  summaryCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    alignItems: 'center',
    marginBottom: Spacing.lg,
    gap: 6,
  },
  summaryRating: { fontSize: 36, fontWeight: 'bold', color: Colors.text },
  summaryCount: { fontSize: FontSizes.sm, color: Colors.textSecondary },
  reviewCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: `${Colors.primary}18`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  customerName: { fontSize: FontSizes.sm, fontWeight: '700', color: Colors.text },
  reviewDate: { fontSize: FontSizes.xs, color: Colors.textMuted, marginTop: 2 },
  comment: { fontSize: FontSizes.sm, color: Colors.textSecondary, lineHeight: 20 },
});
