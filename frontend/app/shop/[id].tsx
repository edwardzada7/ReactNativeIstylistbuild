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
import { useAuth } from '../../src/contexts/AuthContext';
import { ProductReview } from '../../src/types';

export default function ProductDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, isAuthenticated } = useAuth();
  const [product, setProduct] = useState<Product | null>(null);
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [averageRating, setAverageRating] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [composerVisible, setComposerVisible] = useState(false);
  const [editingReview, setEditingReview] = useState<ProductReview | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const addItem = useCartStore((s) => s.addItem);

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
      setReviewRating(5);
      setReviewText('');
    }
    setComposerVisible(true);
  };

  const submitReview = async () => {
    if (!product || !isAuthenticated) return;
    if (!reviewText.trim()) {
      Alert.alert('Review required', 'Please write a short review before submitting.');
      return;
    }
    setSubmitting(true);
    try {
      if (editingReview) {
        await shopService.updateProductReview(product.id, editingReview.id, { rating: reviewRating, review_text: reviewText.trim() });
      } else {
        await shopService.createProductReview(product.id, { rating: reviewRating, review_text: reviewText.trim() });
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
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!product) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back">
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.centerState}>
          <Text style={styles.emptyText}>Product not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('/shop/cart')} accessibilityRole="button" accessibilityLabel="Cart">
          <Ionicons name="cart-outline" size={24} color={Colors.text} />
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {product.image_urls?.[0] ? (
          <Image source={{ uri: product.image_urls[0] }} style={styles.image} />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder]}>
            <Ionicons name="image-outline" size={48} color={Colors.textMuted} />
          </View>
        )}
        <Text style={styles.name}>{product.name}</Text>
        <Text style={styles.price}>{formatCurrency(product.price)}</Text>
        <Text style={styles.stock}>{product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}</Text>
        {(product.main_category || product.category) ? (
          <View style={styles.metaBox}>
            <Text style={styles.metaLabel}>Category</Text>
            <Text style={styles.metaValue}>{product.main_category || product.category}</Text>
            {product.subcategory ? <Text style={styles.metaValue}>{product.subcategory}</Text> : null}
          </View>
        ) : null}
        {!!product.description && <Text style={styles.description}>{product.description}</Text>}

        <View style={styles.reviewSection}>
          <View style={styles.reviewHeaderRow}>
            <View>
              <Text style={styles.sectionTitle}>Ratings & Reviews</Text>
              <Text style={styles.sectionSubtitle}>Real shopper feedback for this product.</Text>
            </View>
            <TouchableOpacity style={styles.reviewButton} onPress={() => openComposer(myReview)} accessibilityRole="button" accessibilityLabel="Write a review">
              <Ionicons name="create-outline" size={16} color={Colors.primary} />
              <Text style={styles.reviewButtonText}>{myReview ? 'Edit' : 'Write'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.summaryCard}>
            <View style={styles.summaryLeft}>
              <Text style={styles.averageText}>{averageRating ? averageRating.toFixed(1) : '0.0'}</Text>
              <View style={styles.starRow}>{renderStars(averageRating || 0, Colors.warning, 18)}</View>
              <Text style={styles.reviewCountText}>({reviewCount} Review{reviewCount === 1 ? '' : 's'})</Text>
            </View>
            <View style={styles.summaryRight}>
              <Text style={styles.summaryHint}>Fresh feedback from recent buyers.</Text>
            </View>
          </View>

          {reviews.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No reviews yet.</Text>
              <Text style={styles.emptyStateText}>Be the first to review this product.</Text>
              <TouchableOpacity style={styles.primaryAction} onPress={() => openComposer()} accessibilityRole="button" accessibilityLabel="Be the first to review">
                <Text style={styles.primaryActionText}>Be the first to review</Text>
              </TouchableOpacity>
            </View>
          ) : (
            reviews.map((review) => (
              <View key={review.id} style={styles.reviewCard}>
                <View style={styles.reviewTopRow}>
                  <View style={styles.reviewerInfo}>
                    {review.user_avatar ? (
                      <Image source={{ uri: review.user_avatar }} style={styles.avatar} />
                    ) : (
                      <View style={styles.avatarPlaceholder}>
                        <Ionicons name="person" size={18} color={Colors.textMuted} />
                      </View>
                    )}
                    <View>
                      <Text style={styles.reviewerName}>{review.user_full_name || 'Customer'}</Text>
                      <Text style={styles.reviewDate}>{new Date(review.created_at).toLocaleDateString()}</Text>
                    </View>
                  </View>
                  {review.verified_purchase ? (
                    <View style={styles.badge}>
                      <Ionicons name="checkmark-circle" size={14} color={Colors.success} />
                      <Text style={styles.badgeText}>Verified Purchase</Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.starRow}>{renderStars(review.rating, Colors.warning, 16)}</View>
                <Text style={styles.reviewText}>{review.review_text}</Text>
                {user?.auth_id === review.user_id ? (
                  <View style={styles.ownerActions}>
                    <TouchableOpacity onPress={() => openComposer(review)} accessibilityRole="button" accessibilityLabel="Edit review">
                      <Text style={styles.ownerActionText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDeleteReview(review)} accessibilityRole="button" accessibilityLabel="Delete review">
                      <Text style={[styles.ownerActionText, styles.ownerActionDanger]}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            ))
          )}
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <Button
          title={product.stock > 0 ? 'Add to Cart' : 'Out of Stock'}
          onPress={handleAddToCart}
          disabled={product.stock <= 0}
          fullWidth
          size="large"
        />
      </View>

      <Modal visible={composerVisible} transparent animationType="slide" onRequestClose={() => setComposerVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{editingReview ? 'Edit your review' : 'Write a review'}</Text>
            <Text style={styles.modalHint}>Share your experience with this product.</Text>
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
              style={styles.input}
              multiline
              numberOfLines={6}
              placeholder="Tell others what you liked or disliked..."
              value={reviewText}
              onChangeText={setReviewText}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.secondaryAction} onPress={() => setComposerVisible(false)}>
                <Text style={styles.secondaryActionText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryAction} onPress={submitReview} disabled={submitting}>
                {submitting ? <ActivityIndicator size="small" color={Colors.background} /> : <Text style={styles.primaryActionText}>{editingReview ? 'Save review' : 'Submit review'}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centerState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: FontSizes.sm, color: Colors.textSecondary },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  content: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl },
  image: { width: '100%', height: 260, borderRadius: BorderRadius.lg, marginBottom: Spacing.lg },
  imagePlaceholder: { backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center' },
  name: { fontSize: FontSizes.xl, fontWeight: '800', color: Colors.text },
  price: { fontSize: FontSizes.lg, fontWeight: '700', color: Colors.primary, marginTop: Spacing.xs },
  stock: { fontSize: FontSizes.sm, color: Colors.textSecondary, marginTop: Spacing.xs, marginBottom: Spacing.md },
  metaBox: { backgroundColor: Colors.surface, padding: Spacing.sm, borderRadius: BorderRadius.md, marginBottom: Spacing.md },
  metaLabel: { fontSize: FontSizes.xs, color: Colors.primary, fontWeight: '700' },
  metaValue: { fontSize: FontSizes.sm, color: Colors.text, marginTop: 2 },
  description: { fontSize: FontSizes.sm, color: Colors.textSecondary, lineHeight: 21 },
  reviewSection: { marginTop: Spacing.xl, paddingTop: Spacing.lg, borderTopWidth: 1, borderTopColor: Colors.border },
  reviewHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  sectionTitle: { fontSize: FontSizes.lg, fontWeight: '800', color: Colors.text },
  sectionSubtitle: { fontSize: FontSizes.xs, color: Colors.textSecondary, marginTop: 2 },
  reviewButton: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: `${Colors.primary}12`, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: BorderRadius.full },
  reviewButtonText: { color: Colors.primary, fontWeight: '700', marginLeft: 4 },
  summaryCard: { backgroundColor: Colors.surfaceLight, borderRadius: BorderRadius.lg, padding: Spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md, ...Shadows.sm },
  summaryLeft: { flex: 1 },
  averageText: { fontSize: FontSizes.xxl, fontWeight: '800', color: Colors.text },
  starRow: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.xs },
  reviewCountText: { color: Colors.textSecondary, marginTop: Spacing.xs },
  summaryRight: { flex: 1, alignItems: 'flex-end' },
  summaryHint: { color: Colors.textSecondary, fontSize: FontSizes.xs, textAlign: 'right' },
  emptyCard: { backgroundColor: Colors.surfaceLight, borderRadius: BorderRadius.lg, padding: Spacing.lg, alignItems: 'center', ...Shadows.sm },
  emptyTitle: { fontSize: FontSizes.md, fontWeight: '700', color: Colors.text },
  emptyStateText: { color: Colors.textSecondary, marginTop: Spacing.xs, textAlign: 'center' },
  reviewCard: { backgroundColor: Colors.surfaceLight, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.sm, ...Shadows.sm },
  reviewTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  reviewerInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  avatar: { width: 40, height: 40, borderRadius: 20, marginRight: Spacing.sm },
  avatarPlaceholder: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.sm },
  reviewerName: { fontWeight: '700', color: Colors.text },
  reviewDate: { color: Colors.textSecondary, fontSize: FontSizes.xs, marginTop: 2 },
  badge: { flexDirection: 'row', alignItems: 'center', backgroundColor: `${Colors.success}14`, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: BorderRadius.full },
  badgeText: { color: Colors.success, fontSize: FontSizes.xs, fontWeight: '700', marginLeft: 4 },
  reviewText: { color: Colors.textSecondary, lineHeight: 21, marginTop: Spacing.sm },
  ownerActions: { flexDirection: 'row', marginTop: Spacing.md },
  ownerActionText: { color: Colors.primary, fontWeight: '700', marginRight: Spacing.md },
  ownerActionDanger: { color: Colors.error },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(17,24,39,0.45)' },
  modalCard: { backgroundColor: Colors.background, borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl, padding: Spacing.lg, paddingBottom: Spacing.xl },
  modalTitle: { fontSize: FontSizes.lg, fontWeight: '800', color: Colors.text },
  modalHint: { color: Colors.textSecondary, marginTop: Spacing.xs, marginBottom: Spacing.md },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.md, padding: Spacing.md, minHeight: 120, textAlignVertical: 'top', color: Colors.text, backgroundColor: Colors.surfaceLight },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: Spacing.md, gap: Spacing.sm },
  secondaryAction: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.full, backgroundColor: Colors.surface },
  secondaryActionText: { color: Colors.textSecondary, fontWeight: '700' },
  primaryAction: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.full, backgroundColor: Colors.primary, minWidth: 120, alignItems: 'center', justifyContent: 'center' },
  primaryActionText: { color: Colors.background, fontWeight: '700' },
  footer: { padding: Spacing.lg, borderTopWidth: 1, borderTopColor: Colors.border },
});
