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
  FlatList,
  Image as RNImage,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Share } from 'react-native';
import { WebView } from 'react-native-webview';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors, FontSizes, Spacing, BorderRadius } from '../../src/constants/theme';
import { Button } from '../../src/components/common';
import { providerService } from '../../src/services/provider.service';
import { feedService } from '../../src/services/feed.service';
import { formatCurrency, formatPriceRange } from '../../src/utils/currency';
import { Provider, Review, Post, StaffMember } from '../../src/types';
import { useTheme } from '../../src/contexts/ThemeContext';
import { useAuth } from '../../src/contexts/AuthContext';
import { chatService } from '../../src/services/chat.service';

export default function ProviderProfile() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { user } = useAuth();

  const [provider, setProvider] = useState<Provider | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [portfolio, setPortfolio] = useState<string[]>([]);
  const [slots, setSlots] = useState<string[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [coverImageError, setCoverImageError] = useState(false);
  const [consultation, setConsultation] = useState<Provider['consultation'] | null>(null);
  const [contacting, setContacting] = useState(false);
  const isOwnProvider = Boolean(user && provider && (user.id === provider.id || user.auth_id === provider.user_id));

  const loadData = useCallback(async () => {
    if (!id) return;
    try {
      setError(null);
      const profile = await providerService.getProviderFullProfile(id);
      setProvider(profile);
      if (profile.user_id) {
        void providerService.getConsultationEligibility(profile.user_id)
          .then((eligibility) => setConsultation(eligibility?.eligible ? eligibility : null))
          .catch(() => setConsultation(null));
      }
      const today = new Date().toISOString().slice(0, 10);
      const defaultDuration = profile.services[0]?.duration || 30;
      const [reviewList, slotList, portfolioList, staffList, feedResponse] = await Promise.all([
        providerService.getProviderReviews(id).catch(() => []),
        providerService.getAvailableSlots(id, today, defaultDuration).catch(() => []),
        providerService.getProviderPortfolio(id).catch(() => []),
        providerService.getProviderStaff(id).catch(() => []),
        feedService.getFeed({ page: 1, per_page: 100 }).catch(() => ({ data: [] })),
      ]);
      setCoverImageError(false);
      setReviews(reviewList);
      setSlots(slotList);
      setPortfolio(portfolioList);
      setStaff(staffList);
      // Filter posts by this provider
      console.log('[customer-provider-profile] profile.user_id:', profile.user_id, 'id param:', id);
      console.log('[customer-provider-profile] total posts from API:', feedResponse.data?.length);
      const providerPosts = (feedResponse.data || []).filter(
        (post: Post) => {
          const matches = 
            post.provider_auth_id === profile.user_id ||
            post.provider?.id === id ||
            post.user_id === profile.user_id ||
            post.provider?.auth_id === profile.user_id;
          if (matches) {
            console.log('[customer-provider-profile] matched post:', post.id, 'provider_auth_id:', post.provider_auth_id, 'provider.id:', post.provider?.id);
          }
          return matches;
        }
      );
      console.log('[customer-provider-profile] filtered posts:', providerPosts.length);
      setPosts(providerPosts);
      if (profile.services.length > 0) {
        setSelectedServiceId((prev) => {
          const isCurrentSelectionValid = profile.services.some((service) => String(service.id) === String(prev));
          return isCurrentSelectionValid ? prev : String(profile.services[0].id);
        });
      } else {
        setSelectedServiceId(null);
      }
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
    if (isOwnProvider) return;
    if (!provider) return;
    if (!selectedServiceId) {
      Alert.alert('Choose a service', 'Please select a service before booking.');
      return;
    }
    router.push({
      pathname: '/booking/[providerId]',
      params: { providerId: provider.id, serviceId: selectedServiceId },
    });
  };

  const handleAskQuestion = async () => {
    if (!provider?.user_id || contacting) return;
    setContacting(true);
    try {
      const conversation = await chatService.createInquiry(provider.user_id);
      router.push({ pathname: '/chat/[counterpartAuthId]', params: { counterpartAuthId: provider.user_id, conversationId: String(conversation.id), conversationType: 'inquiry', counterpartName: provider.business_name } });
    } catch (err: any) {
      Alert.alert('Could not start inquiry', err?.friendlyMessage || 'Please try again.');
    } finally {
      setContacting(false);
    }
  };

  const handleConsult = async () => {
    if (!provider?.user_id || !consultation || contacting) return;
    setContacting(true);
    try {
      const created = await chatService.createConsultation({
        provider_auth_id: provider.user_id,
        specialty: consultation.specialty || categoryLabel,
        fee: Number(consultation.consultation_fee),
        currency: consultation.currency || 'NGN',
      });
      router.push({ pathname: '/consultation/payment' as any, params: { consultationId: String(created.consultation.id), conversationId: String(created.conversation.id), providerAuthId: provider.user_id, providerName: provider.business_name, specialty: consultation.specialty || categoryLabel, fee: String(consultation.consultation_fee), currency: consultation.currency || 'NGN' } });
    } catch (err: any) {
      Alert.alert('Could not start consultation', err?.friendlyMessage || 'Please try again.');
    } finally {
      setContacting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !provider) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <TouchableOpacity
          style={styles.backButtonFloating}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.centerState}>
          <Ionicons name="alert-circle-outline" size={40} color={Colors.error} />
          <Text style={[styles.emptyText, { color: colors.text }]}>{error || 'Provider not found.'}</Text>
          <Button title="Retry" onPress={loadData} variant="outline" />
        </View>
      </SafeAreaView>
    );
  }

  const categoryLabel = typeof provider.category === 'string' ? provider.category : '';
  const avatarUri = provider.avatarUrl || provider.user?.avatarUrl || provider.profileImage || provider.user?.profileImage || provider.profile_image_url || provider.avatar;
  const serviceNames = new Map(provider.services.map((service) => [Number(service.id), service.name]));
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.primary} />
        }
      >
        {/* Header / Cover */}
        <View style={styles.coverContainer}>
          {avatarUri ? (
            coverImageError ? (
              <View style={styles.coverFallback}>
                <Ionicons name="person" size={64} color={Colors.primary} />
              </View>
            ) : (
              <Image
                source={avatarUri.startsWith('http') ? { uri: avatarUri } : require('../../assets/images/app-icon.png')}
                style={styles.coverImage}
                contentFit="cover"
                onError={() => setCoverImageError(true)}
              />
            )
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
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.body}>
          <View style={styles.titleRow}>
            <View style={{ flex: 1 }}>
              <View style={styles.nameRow}>
                <Text style={[styles.name, { color: colors.text }]}>{provider.business_name}</Text>
                {(provider.isVerified === true || provider.isKycVerified === true || provider.user?.isKycVerified === true || provider.is_verified === true) && (
                  <Ionicons name="checkmark-circle" size={18} color={Colors.info} />
                )}
              </View>
              {!!categoryLabel && <Text style={[styles.category, { color: colors.textSecondary }]}>{categoryLabel}</Text>}
            </View>
            <View style={styles.titleActions}>
              <TouchableOpacity onPress={() => Share.share({ title: provider.business_name, message: `${provider.business_name} on iStylist\n${provider.bio || ''}`, url: `https://istylist.app/provider/${provider.id}` })} accessibilityRole="button" accessibilityLabel="Share provider profile">
                <Ionicons name="share-social-outline" size={22} color={colors.text} />
              </TouchableOpacity>
              <Text style={[styles.priceRange, { color: colors.text }]}>{formatPriceRange(provider.price_range)}</Text>
            </View>
          </View>

          {isOwnProvider ? (
            <View style={[styles.infoBanner, { backgroundColor: `${Colors.info}15` }]}>
              <Ionicons name="information-circle-outline" size={18} color={Colors.info} />
              <Text style={[styles.infoBannerText, { color: colors.text }]}>Providers cannot book their own services or purchase their own products.</Text>
            </View>
          ) : null}

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Ionicons name="star" size={16} color={Colors.warning} />
              <Text style={[styles.metaText, { color: colors.text }]}>
                ★ {Number(provider.rating || provider.avgRating || 0).toFixed(1)} ({provider.ratingCount ?? provider.reviewsCount ?? provider.review_count ?? 0})
              </Text>
            </View>
            {(provider.location_address || provider.location) && provider.location !== 'Location not set' ? (
              <View style={styles.metaItem}>
                <Ionicons name="location-outline" size={16} color={colors.textSecondary} />
                <Text style={[styles.metaText, { color: colors.text }]} numberOfLines={1}>
                  {provider.location_address || provider.location}
                </Text>
              </View>
            ) : null}
          </View>

          {!!provider.bio && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>About</Text>
              <Text style={[styles.bio, { color: colors.textSecondary }]}>{provider.bio}</Text>
            </View>
          )}

          {!isOwnProvider && (
            <View style={styles.contactActions}>
              <Button title={contacting ? 'Opening...' : 'Ask a Question'} onPress={handleAskQuestion} variant="outline" disabled={contacting} loading={contacting} fullWidth />
              {consultation && <Button title={`Consult a Professional — ${formatCurrency(Number(consultation.consultation_fee))}`} onPress={handleConsult} disabled={contacting} fullWidth />}
            </View>
          )}

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Staff</Text>
            {staff.length === 0 ? (
              <Text style={[styles.emptyInline, { color: colors.textSecondary }]}>No staff members listed yet.</Text>
            ) : staff.map((member) => (
              <View key={member.id} style={[styles.staffCard, { backgroundColor: colors.surface }]}>
                <View style={styles.staffHeader}>
                  <RNImage source={{ uri: member.photo_url || 'https://via.placeholder.com/150' }} style={styles.staffImage} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.staffName, { color: colors.text }]}>{member.name}</Text>
                    {!!member.role && <Text style={[styles.staffRole, { color: colors.textSecondary }]}>{member.role}</Text>}
                  </View>
                </View>
                {!!member.bio && <Text style={[styles.staffBio, { color: colors.textSecondary }]}>{member.bio}</Text>}
                <Text style={[styles.staffMeta, { color: colors.textSecondary }]}>Services: {(member.service_ids || []).map((serviceId) => serviceNames.get(serviceId) || String(serviceId)).join(', ') || 'All services'}</Text>
                <Text style={[styles.staffMeta, { color: colors.textSecondary }]}>Schedule: {(member.weekly || []).filter((day) => day.is_available).map((day) => `${dayNames[day.day_of_week]} ${day.start_time || ''}-${day.end_time || ''}`).join(', ') || 'Unavailable'}</Text>
              </View>
            ))}
          </View>

          {/* Services */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Services</Text>
            {provider.services.length === 0 ? (
              <Text style={[styles.emptyInline, { color: colors.textSecondary }]}>No services listed yet.</Text>
            ) : (
              provider.services.map((service) => (
                <TouchableOpacity
                  key={service.id}
                  style={[
                    styles.serviceRow,
                    selectedServiceId === service.id && styles.serviceRowSelected,
                    { borderColor: selectedServiceId === service.id ? Colors.primary : colors.border },
                  ]}
                  onPress={() => setSelectedServiceId(service.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Select ${service.name}`}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.serviceName, { color: colors.text }]}>{service.name}</Text>
                    {!!service.description && (
                      <Text style={[styles.serviceDescription, { color: colors.textSecondary }]} numberOfLines={2}>
                        {service.description}
                      </Text>
                    )}
                    <Text style={[styles.serviceMeta, { color: colors.textSecondary }]}>
                      {service.duration} min
                      {service.in_store ? ' · In-store' : ''}
                      {service.home_service ? ' · Home service' : ''}
                    </Text>
                  </View>
                  <Text style={[styles.servicePrice, { color: colors.text }]}>{formatCurrency(service.price)}</Text>
                </TouchableOpacity>
              ))
            )}
          </View>

          {/* Portfolio */}
          {portfolio.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Portfolio</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {portfolio.map((img, idx) => (
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
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Availability</Text>
            {slots.length === 0 ? (
              <Text style={[styles.emptyInline, { color: colors.textSecondary }]}>No open slots right now.</Text>
            ) : (
              <View style={styles.slotsWrap}>
                {slots.slice(0, 12).map((slot, idx) => (
                  <View key={`${slot}-${idx}`} style={[styles.slotChip, { borderColor: colors.border }]}>
                    <Text style={[styles.slotText, { color: colors.text }]}>{slot}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Reviews */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Reviews ({reviews.length})</Text>
            {reviews.length === 0 ? (
              <Text style={[styles.emptyInline, { color: colors.textSecondary }]}>No reviews yet.</Text>
            ) : (
              reviews.map((review) => (
                <View key={review.id} style={[styles.reviewCard, { backgroundColor: colors.surface }]}>
                  <View style={styles.reviewHeader}>
                    <Text style={[styles.reviewer, { color: colors.text }]}>{review.customer_name}</Text>
                    <View style={styles.metaItem}>
                      <Ionicons name="star" size={14} color={Colors.warning} />
                      <Text style={[styles.metaText, { color: colors.text }]}>{review.rating}</Text>
                    </View>
                  </View>
                  {!!review.comment && <Text style={[styles.reviewComment, { color: colors.textSecondary }]}>{review.comment}</Text>}
                </View>
              ))
            )}
          </View>

          {/* Feed Posts */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Feed Posts ({posts.length})</Text>
            {posts.length === 0 ? (
              <Text style={[styles.emptyInline, { color: colors.textSecondary }]}>No posts yet.</Text>
            ) : (
              <FlatList
                data={posts}
                scrollEnabled={false}
                keyExtractor={(item) => String(item.id)}
                renderItem={({ item }) => (
                  <View style={[styles.postCard, { backgroundColor: colors.surface }]}>
                    {item.video_url ? (
                      <WebView
                        source={{ html: `<video controls playsinline style="width:100%;height:100%;object-fit:contain" src=${JSON.stringify(item.video_url)}></video>` }}
                        style={styles.postVideo}
                        allowsInlineMediaPlayback
                        mediaPlaybackRequiresUserAction
                      />
                    ) : item.image_url && (
                      <RNImage source={{ uri: item.image_url }} style={styles.postImage} resizeMode="cover" />
                    )}
                    {item.caption && (
                      <Text style={[styles.postCaption, { color: colors.textSecondary }]} numberOfLines={3}>
                        {item.caption}
                      </Text>
                    )}
                    <View style={styles.postMeta}>
                      <Text style={[styles.postMetaText, { color: colors.textSecondary }]}>
                        {item.likes_count || 0} likes · {item.comments_count || 0} comments
                      </Text>
                    </View>
                  </View>
                )}
              />
            )}
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
        <Button title={isOwnProvider ? 'Unavailable' : 'Book Now'} onPress={handleBookNow} disabled={isOwnProvider} fullWidth size="large" />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    textAlign: 'center',
  },
  emptyInline: {
    fontSize: FontSizes.sm,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  coverContainer: {
    width: '100%',
    height: 220,
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
  titleActions: { alignItems: 'flex-end', gap: Spacing.sm },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  name: {
    fontSize: FontSizes.xl,
    fontWeight: 'bold',
  },
  category: {
    fontSize: FontSizes.sm,
    marginTop: 4,
  },
  priceRange: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
  },
  infoBanner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.sm, borderRadius: BorderRadius.md, marginTop: Spacing.md },
  infoBannerText: { flex: 1, fontSize: FontSizes.sm, lineHeight: 19 },
  staffCard: { borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: Spacing.sm },
  staffHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  staffImage: { width: 64, height: 64, borderRadius: 32 },
  staffName: { fontSize: FontSizes.md, fontWeight: '700' },
  staffRole: { fontSize: FontSizes.sm, marginTop: 4 },
  staffBio: { fontSize: FontSizes.sm, lineHeight: 20, marginTop: Spacing.sm },
  staffMeta: { fontSize: FontSizes.xs, lineHeight: 18, marginTop: Spacing.xs },
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
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    marginBottom: Spacing.sm,
  },
  bio: {
    fontSize: FontSizes.sm,
    lineHeight: 20,
  },
  serviceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
  },
  serviceRowSelected: {
    backgroundColor: Colors.primary + '20',
    borderColor: Colors.primary,
  },
  serviceDescription: {
    fontSize: FontSizes.xs,
    marginTop: 2,
  },
  serviceName: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  serviceMeta: {
    fontSize: FontSizes.xs,
    marginTop: 2,
  },
  servicePrice: {
    fontSize: FontSizes.md,
    fontWeight: '700',
  },
  portfolioImage: {
    width: 120,
    height: 120,
    borderRadius: BorderRadius.md,
    marginRight: Spacing.sm,
  },
  slotsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  slotChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  slotText: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
  },
  reviewCard: {
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
  },
  reviewComment: {
    fontSize: FontSizes.sm,
  },
  postCard: {
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    overflow: 'hidden',
  },
  postImage: {
    width: '100%',
    height: 200,
  },
  postVideo: { width: '100%', height: 220, backgroundColor: '#000' },
  postCaption: {
    fontSize: FontSizes.sm,
    padding: Spacing.sm,
    lineHeight: 20,
  },
  postMeta: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  postMetaText: {
    fontSize: FontSizes.xs,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: Spacing.lg,
  },
  contactActions: { gap: Spacing.sm, marginBottom: Spacing.lg },
});
