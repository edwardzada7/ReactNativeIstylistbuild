import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Image, Alert, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors, FontSizes, Spacing, BorderRadius, Shadows } from '../../src/constants/theme';
import { Button } from '../../src/components/common';
import { shopService, Product } from '../../src/services/shop.service';
import { useCartStore } from '../../src/store/cartStore';
import { formatCurrency } from '../../src/utils/currency';
import { formatRating } from '../../src/utils/display';
import { useAuth } from '../../src/contexts/AuthContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { ProductReview } from '../../src/types';

export default function ProductDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, isAuthenticated, isProvider } = useAuth();
  const { colors } = useTheme();
  const [product, setProduct] = useState<Product | null>(null);
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [averageRating, setAverageRating] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [composerVisible, setComposerVisible] = useState(false);
  const [editingReview, setEditingReview] = useState<ProductReview | null>(null);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const addItem = useCartStore((s) => s.addItem);
  const isOwnProduct = Boolean(user && product && user.auth_id === product.stylist_auth_id);

  const myReview = useMemo(() => reviews.find((review) => review.user_id === user?.auth_id) ?? null, [reviews, user?.auth_id]);

  const loadProduct = async () => {
    if (!id) return;

    try {
      const productData = await shopService.getProduct(Number(id));
      setProduct(productData);

      if (productData) {
        try {
          const reviewData = await shopService.getProductReviews(Number(id));
          setReviews(reviewData.reviews);
          setAverageRating(reviewData.average_rating);
          setReviewCount(reviewData.review_count);
        } catch (err) {
          console.error('[product-detail] failed to load reviews', err);
          setReviews([]);
          setAverageRating(0);
          setReviewCount(0);
        }
      }
    } catch (err) {
      console.error('[product-detail] failed to load product', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    loadProduct();
  }, [id]);

  const handleAddToCart = () => {
    if (isOwnProduct) return;
    if (isProvider) {
      router.push('/(provider)/shop');
      return;
    }
    if (!product) return;
    addItem({
      productId: product.id,
      name: product.name,
      price: product.price,
      image: product.image_urls?.[0] || null,
      stylistAuthId: product.stylist_auth_id,
    });
    Alert.alert('Added to Cart', `${product.name} was added to your cart.`, [
      { text: 'Keep Shopping', style: 'cancel' },
      { text: 'View Cart', onPress: () => router.push('/shop/cart') },
    ]);
  };

  const openComposer = (review?: ProductReview | null) => {
    if (!isAuthenticated) {
      Alert.alert('Sign in required', 'Please sign in to leave a review.');
      return;
    }
    if (review) {
      setEditingReview(review);
      setReviewRating(review.rating);
      setReviewText(review.review_text);
    } else {
      setEditingReview(null);
      setReviewRating(0);
      setReviewText('');
    }
    setComposerVisible(true);
  };

  const submitReview = async () => {
    if (!product || !isAuthenticated) return;

    const cleanedText = reviewText.trim();
    const normalizedRating = Number(reviewRating);
    if (normalizedRating === 0) {
      Alert.alert('Please select a star rating');
      return;
    }
    if (!Number.isInteger(normalizedRating) || normalizedRating < 1 || normalizedRating > 5) {
      Alert.alert('Rating required', 'Please select a rating from 1 to 5 stars.');
      return;
    }
    const validRating = normalizedRating;

    if (!cleanedText) {
      Alert.alert('Review required', 'Please write a short review before submitting.');
      return;
    }

    setSubmitting(true);
    try {
      const userId = user?.auth_id || user?.id || undefined;
      const reviewPayload = {
        productId: Number(product.id),
        rating: validRating || 5,
        comment: cleanedText,
      };
      const payloadBase = { ...reviewPayload, review_text: reviewPayload.comment, user_id: userId, order_id: null, item_id: null };

      if (editingReview) {
        await shopService.updateProductReview(product.id, editingReview.id, payloadBase);
      } else {
        await shopService.createProductReview(product.id, payloadBase);
      }
      setComposerVisible(false);
      setEditingReview(null);
      setReviewText('');
      setReviewRating(5);
      await loadProduct();
    } catch (err: any) {
      Alert.alert('Review failed', err?.friendlyMessage || err?.message || 'Could not save your review.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteReview = (review: ProductReview) => {
    if (!product) return;
    Alert.alert('Delete review', 'Remove your review from this product?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await shopService.deleteProductReview(product.id, review.id);
            await loadProduct();
          } catch (err: any) {
            Alert.alert('Delete failed', err?.friendlyMessage || err?.message || 'Could not delete your review.');
          }
        },
      },
    ]);
  };

  const renderStars = (rating: number, activeColor = Colors.warning, size = 16) => {
    return Array.from({ length: 5 }, (_, index) => {
      const filled = index < Math.round(rating);
      return <Ionicons key={`${rating}-${index}`} name={filled ? 'star' : 'star-outline'} size={size} color={activeColor} />;
    });
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

  if (!product) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back">
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.centerState}>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Product not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        {!isProvider && (
          <TouchableOpacity onPress={() => router.push('/shop/cart')} accessibilityRole="button" accessibilityLabel="Cart">
            <Ionicons name="cart-outline" size={24} color={colors.text} />
          </TouchableOpacity>
        )}
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {product.image_urls?.[0] ? (
          <Image source={{ uri: product.image_urls[0] }} style={styles.image} />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder, { backgroundColor: colors.surface }]}>
            <Ionicons name="image-outline" size={48} color={colors.textSecondary} />
          </View>
        )}
        <Text style={[styles.name, { color: colors.text }]}>{product.name}</Text>
        <Text style={[styles.price, { color: Colors.primary }]}>{formatCurrency(product.price)}</Text>
        {isOwnProduct ? (
          <View style={[styles.infoBanner, { backgroundColor: `${Colors.info}15` }]}>
            <Ionicons name="information-circle-outline" size={18} color={Colors.info} />
            <Text style={[styles.infoBannerText, { color: colors.text }]}>Providers cannot book their own services or purchase their own products.</Text>
          </View>
        ) : null}
        <Text style={[styles.stock, { color: colors.textSecondary }]}>{product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}</Text>
        {(product.main_category || product.category) ? (
          <View style={[styles.metaBox, { backgroundColor: colors.surface }]}>
            <Text style={[styles.metaLabel, { color: Colors.primary }]}>Category</Text>
            <Text style={[styles.metaValue, { color: colors.text }]}>{product.main_category || product.category}</Text>
            {product.subcategory ? <Text style={[styles.metaValue, { color: colors.text }]}>{product.subcategory}</Text> : null}
          </View>
        ) : null}
        {!!product.description && <Text style={[styles.description, { color: colors.textSecondary }]}>{product.description}</Text>}

        <View style={[styles.reviewSection, { borderTopColor: colors.border }]}>
          <View style={styles.reviewHeaderRow}>
            <View>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Ratings & Reviews</Text>
              <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>Real shopper feedback for this product.</Text>
            </View>
            <TouchableOpacity style={[styles.reviewButton, { backgroundColor: `${Colors.primary}12` }]} onPress={() => openComposer(myReview)} accessibilityRole="button" accessibilityLabel="Write a review">
              <Ionicons name="create-outline" size={16} color={Colors.primary} />
              <Text style={[styles.reviewButtonText, { color: Colors.primary }]}>{myReview ? 'Edit' : 'Write'}</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.summaryCard, { backgroundColor: colors.surfaceLight }]}>
            <View style={styles.summaryLeft}>
              <Text style={[styles.averageText, { color: colors.text }]}>{formatRating(averageRating)}</Text>
              <View style={styles.starRow}>{renderStars(averageRating || 0, Colors.warning, 18)}</View>
              <Text style={[styles.reviewCountText, { color: colors.textSecondary }]}>({reviewCount} Review{reviewCount === 1 ? '' : 's'})</Text>
            </View>
            <View style={styles.summaryRight}>
              <Text style={[styles.summaryHint, { color: colors.textSecondary }]}>Fresh feedback from recent buyers.</Text>
            </View>
          </View>

          {reviews.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: colors.surfaceLight }]}>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No reviews yet.</Text>
              <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>Be the first to review this product.</Text>
              <TouchableOpacity style={[styles.primaryAction, { backgroundColor: Colors.primary }]} onPress={() => openComposer()} accessibilityRole="button" accessibilityLabel="Be the first to review">
                <Text style={[styles.primaryActionText, { color: Colors.background }]}>Be the first to review</Text>
              </TouchableOpacity>
            </View>
          ) : (
            reviews.map((review) => (
              <View key={review.id} style={[styles.reviewCard, { backgroundColor: colors.surfaceLight }]}>
                <View style={styles.reviewTopRow}>
                  <View style={styles.reviewerInfo}>
                    {review.user_avatar ? (
                      <Image source={{ uri: review.user_avatar }} style={styles.avatar} />
                    ) : (
                      <View style={[styles.avatarPlaceholder, { backgroundColor: colors.surface }]}>
                        <Ionicons name="person" size={18} color={colors.textSecondary} />
                      </View>
                    )}
                    <View>
                      <Text style={[styles.reviewerName, { color: colors.text }]}>{review.user_full_name || 'Customer'}</Text>
                      <Text style={[styles.reviewDate, { color: colors.textSecondary }]}>{new Date(review.created_at).toLocaleDateString()}</Text>
                    </View>
                  </View>
                  {review.verified_purchase ? (
                    <View style={[styles.badge, { backgroundColor: `${Colors.success}14` }]}>
                      <Ionicons name="checkmark-circle" size={14} color={Colors.success} />
                      <Text style={[styles.badgeText, { color: Colors.success }]}>Verified Purchase</Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.starRow}>{renderStars(review.rating, Colors.warning, 16)}</View>
                <Text style={[styles.reviewText, { color: colors.textSecondary }]}>{review.review_text}</Text>
                {user?.auth_id === review.user_id ? (
                  <View style={styles.ownerActions}>
                    <TouchableOpacity onPress={() => openComposer(review)} accessibilityRole="button" accessibilityLabel="Edit review">
                      <Text style={[styles.ownerActionText, { color: Colors.primary }]}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDeleteReview(review)} accessibilityRole="button" accessibilityLabel="Delete review">
                      <Text style={[styles.ownerActionText, styles.ownerActionDanger, { color: Colors.error }]}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            ))
          )}
        </View>
      </ScrollView>
      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <Button
          title={isProvider ? 'Manage Products' : isOwnProduct ? 'Unavailable' : product.stock > 0 ? 'Add to Cart' : 'Out of Stock'}
          onPress={handleAddToCart}
          disabled={isOwnProduct || (!isProvider && product.stock <= 0)}
          fullWidth
          size="large"
        />
      </View>

      <Modal visible={composerVisible} transparent animationType="slide" onRequestClose={() => setComposerVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.background }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{editingReview ? 'Edit your review' : 'Write a review'}</Text>
            <Text style={[styles.modalHint, { color: colors.textSecondary }]}>Share your experience with this product.</Text>
            <View style={styles.starRow}>
              {Array.from({ length: 5 }, (_, index) => {
                const starValue = index + 1;
                return (
                  <TouchableOpacity key={starValue} onPress={() => setReviewRating(starValue)} accessibilityRole="button" accessibilityLabel={`Rate ${starValue} stars`}>
                    <Ionicons name={starValue <= reviewRating ? 'star' : 'star-outline'} size={24} color={Colors.warning} />
                  </TouchableOpacity>
                );
              })}
            </View>
            <TextInput
              style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surfaceLight }]}
              multiline
              numberOfLines={6}
              placeholder="Tell others what you liked or disliked..."
              placeholderTextColor={colors.textSecondary}
              value={reviewText}
              onChangeText={setReviewText}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.secondaryAction, { backgroundColor: colors.surface }]} onPress={() => setComposerVisible(false)}>
                <Text style={[styles.secondaryActionText, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.primaryAction, { backgroundColor: Colors.primary }]} onPress={submitReview} disabled={submitting}>
                {submitting ? <ActivityIndicator size="small" color={Colors.background} /> : <Text style={[styles.primaryActionText, { color: Colors.background }]}>{editingReview ? 'Save review' : 'Submit review'}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: FontSizes.sm },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  content: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl },
  image: { width: '100%', height: 260, borderRadius: BorderRadius.lg, marginBottom: Spacing.lg },
  imagePlaceholder: { justifyContent: 'center', alignItems: 'center' },
  name: { fontSize: FontSizes.xl, fontWeight: '800' },
  price: { fontSize: FontSizes.lg, fontWeight: '700', marginTop: Spacing.xs },
  infoBanner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.sm, borderRadius: BorderRadius.md, marginTop: Spacing.md },
  infoBannerText: { flex: 1, fontSize: FontSizes.sm, lineHeight: 19 },
  stock: { fontSize: FontSizes.sm, marginTop: Spacing.xs, marginBottom: Spacing.md },
  metaBox: { padding: Spacing.sm, borderRadius: BorderRadius.md, marginBottom: Spacing.md },
  metaLabel: { fontSize: FontSizes.xs, fontWeight: '700' },
  metaValue: { fontSize: FontSizes.sm, marginTop: 2 },
  description: { fontSize: FontSizes.sm, lineHeight: 21 },
  reviewSection: { marginTop: Spacing.xl, paddingTop: Spacing.lg, borderTopWidth: 1 },
  reviewHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  sectionTitle: { fontSize: FontSizes.lg, fontWeight: '800' },
  sectionSubtitle: { fontSize: FontSizes.xs, marginTop: 2 },
  reviewButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: BorderRadius.full },
  reviewButtonText: { fontWeight: '700', marginLeft: 4 },
  summaryCard: { borderRadius: BorderRadius.lg, padding: Spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md, ...Shadows.sm },
  summaryLeft: { flex: 1 },
  averageText: { fontSize: FontSizes.xxl, fontWeight: '800' },
  starRow: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.xs },
  reviewCountText: { marginTop: Spacing.xs },
  summaryRight: { flex: 1, alignItems: 'flex-end' },
  summaryHint: { fontSize: FontSizes.xs, textAlign: 'right' },
  emptyCard: { borderRadius: BorderRadius.lg, padding: Spacing.lg, alignItems: 'center', ...Shadows.sm },
  emptyTitle: { fontSize: FontSizes.md, fontWeight: '700' },
  emptyStateText: { marginTop: Spacing.xs, textAlign: 'center' },
  reviewCard: { borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.sm, ...Shadows.sm },
  reviewTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  reviewerInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  avatar: { width: 40, height: 40, borderRadius: 20, marginRight: Spacing.sm },
  avatarPlaceholder: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.sm },
  reviewerName: { fontWeight: '700' },
  reviewDate: { fontSize: FontSizes.xs, marginTop: 2 },
  badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: BorderRadius.full },
  badgeText: { fontSize: FontSizes.xs, fontWeight: '700', marginLeft: 4 },
  reviewText: { lineHeight: 21, marginTop: Spacing.sm },
  ownerActions: { flexDirection: 'row', marginTop: Spacing.md },
  ownerActionText: { fontWeight: '700', marginRight: Spacing.md },
  ownerActionDanger: {},
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(17,24,39,0.45)' },
  modalCard: { borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl, padding: Spacing.lg, paddingBottom: Spacing.xl },
  modalTitle: { fontSize: FontSizes.lg, fontWeight: '800' },
  modalHint: { marginTop: Spacing.xs, marginBottom: Spacing.md },
  input: { borderWidth: 1, borderRadius: BorderRadius.md, padding: Spacing.md, minHeight: 120, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: Spacing.md, gap: Spacing.sm },
  secondaryAction: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.full },
  secondaryActionText: { fontWeight: '700' },
  primaryAction: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.full, minWidth: 120, alignItems: 'center', justifyContent: 'center' },
  primaryActionText: { fontWeight: '700' },
  footer: { padding: Spacing.lg, borderTopWidth: 1 },
});
