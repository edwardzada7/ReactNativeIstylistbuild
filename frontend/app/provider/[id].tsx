import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors, FontSizes, Spacing, BorderRadius } from '../../src/constants/theme';
import { Button } from '../../src/components/common';
import { providerService } from '../../src/services/provider.service';
import { Provider, Review } from '../../src/types';

export default function ProviderProfile() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [provider, setProvider] = useState<Provider | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [slots, setSlots] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!id) return;
    try {
      setError(null);
      const [profile, reviewList, slotList] = await Promise.all([
        providerService.getProviderFullProfile(id),
        providerService.getProviderReviews(id).catch(() => []),
        providerService.getAvailableSlots(id).catch(() => []),
      ]);
      setProvider(profile);
      setReviews(reviewList);
      setSlots(slotList);
    } catch (err: any) {
      console.error('[provider-profile] failed to load', err);
      setError(err?.friendlyMessage || 'Could not load this provider. Pull down to retry.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleBookNow = () => {
    Alert.alert(
      'Booking coming soon',
      'Booking, scheduling and payment are being wired up in the next phase. You will be able to book this provider directly from here shortly.'
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !provider) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <TouchableOpacity
          style={styles.backButtonFloating}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.centerState}>
          <Ionicons name="alert-circle-outline" size={40} color={Colors.error} />
          <Text style={styles.emptyText}>{error || 'Provider not found.'}</Text>
          <Button title="Retry" onPress={loadData} variant="outline" />
        </View>
      </SafeAreaView>
    );
  }

  const categoryLabel = typeof provider.category === 'string' ? provider.category : '';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.primary} />
        }
      >
        {/* Header / Cover */}
        <View style={styles.coverContainer}>
          {provider.avatar ? (
            <Image source={{ uri: provider.avatar }} style={styles.coverImage} contentFit="cover" />
          ) : (
            <View style={styles.coverFallback}>
              <Ionicons name="person" size={64} color={Colors.primary} />
            </View>
          )}
          <TouchableOpacity
            style={styles.backButtonFloating}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={22} color={Colors.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.body}>
          <View style={styles.titleRow}>
            <View style={{ flex: 1 }}>
              <View style={styles.nameRow}>
                <Text style={styles.name}>{provider.business_name}</Text>
                {provider.is_verified && (
                  <Ionicons name="checkmark-circle" size={18} color={Colors.info} />
                )}
              </View>
              {!!categoryLabel && <Text style={styles.category}>{categoryLabel}</Text>}
            </View>
            <Text style={styles.priceRange}>{provider.price_range}</Text>
          </View>

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Ionicons name="star" size={16} color={Colors.warning} />
              <Text style={styles.metaText}>
                {provider.rating ? provider.rating.toFixed(1) : 'New'} ({provider.review_count})
              </Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="location-outline" size={16} color={Colors.textSecondary} />
              <Text style={styles.metaText} numberOfLines={1}>
                {provider.location}
              </Text>
            </View>
          </View>

          {!!provider.bio && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>About</Text>
              <Text style={styles.bio}>{provider.bio}</Text>
            </View>
          )}

          {/* Services */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Services</Text>
            {provider.services.length === 0 ? (
              <Text style={styles.emptyInline}>No services listed yet.</Text>
            ) : (
              provider.services.map((service) => (
                <View key={service.id} style={styles.serviceRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.serviceName}>{service.name}</Text>
                    <Text style={styles.serviceMeta}>
                      {service.duration} min
                      {service.in_store ? ' · In-store' : ''}
                      {service.home_service ? ' · Home service' : ''}
                    </Text>
                  </View>
                  <Text style={styles.servicePrice}>${service.price}</Text>
                </View>
              ))
            )}
          </View>

          {/* Portfolio */}
          {provider.images.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Portfolio</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {provider.images.map((img, idx) => (
                  <Image
                    key={`${img}-${idx}`}
                    source={{ uri: img }}
                    style={styles.portfolioImage}
                    contentFit="cover"
                  />
                ))}
              </ScrollView>
            </View>
          )}

          {/* Availability */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Availability</Text>
            {slots.length === 0 ? (
              <Text style={styles.emptyInline}>No open slots right now.</Text>
            ) : (
              <View style={styles.slotsWrap}>
                {slots.slice(0, 12).map((slot, idx) => (
                  <View key={`${slot}-${idx}`} style={styles.slotChip}>
                    <Text style={styles.slotText}>{slot}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Reviews */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Reviews ({reviews.length})</Text>
            {reviews.length === 0 ? (
              <Text style={styles.emptyInline}>No reviews yet.</Text>
            ) : (
              reviews.map((review) => (
                <View key={review.id} style={styles.reviewCard}>
                  <View style={styles.reviewHeader}>
                    <Text style={styles.reviewer}>{review.customer_name}</Text>
                    <View style={styles.metaItem}>
                      <Ionicons name="star" size={14} color={Colors.warning} />
                      <Text style={styles.metaText}>{review.rating}</Text>
                    </View>
                  </View>
                  {!!review.comment && <Text style={styles.reviewComment}>{review.comment}</Text>}
                </View>
              ))
            )}
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button title="Book Now" onPress={handleBookNow} fullWidth size="large" />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centerState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
  },
  emptyText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  emptyInline: {
    fontSize: FontSizes.sm,
    color: Colors.textMuted,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  coverContainer: {
    width: '100%',
    height: 220,
    backgroundColor: Colors.surface,
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverFallback: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.surfaceLight,
  },
  backButtonFloating: {
    position: 'absolute',
    top: Spacing.md,
    left: Spacing.md,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  body: {
    padding: Spacing.lg,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  name: {
    fontSize: FontSizes.xl,
    fontWeight: 'bold',
    color: Colors.text,
  },
  category: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  priceRange: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.primary,
  },
  metaRow: {
    flexDirection: 'row',
    gap: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 1,
  },
  metaText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  bio: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  serviceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  serviceName: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.text,
  },
  serviceMeta: {
    fontSize: FontSizes.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  servicePrice: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: Colors.primary,
  },
  portfolioImage: {
    width: 120,
    height: 120,
    borderRadius: BorderRadius.md,
    marginRight: Spacing.sm,
    backgroundColor: Colors.surface,
  },
  slotsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  slotChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  slotText: {
    fontSize: FontSizes.xs,
    color: Colors.text,
    fontWeight: '600',
  },
  reviewCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  reviewer: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.text,
  },
  reviewComment: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: Spacing.lg,
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
});
