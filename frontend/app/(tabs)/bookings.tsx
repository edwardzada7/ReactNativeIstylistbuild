import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { Colors, FontSizes, Spacing, BorderRadius } from '../../src/constants/theme';
import { Button } from '../../src/components/common';
import { bookingService } from '../../src/services/booking.service';
import { reviewService } from '../../src/services/review.service';
import { walletService } from '../../src/services/wallet.service';
import { useAuth } from '../../src/contexts/AuthContext';
import { formatCurrency } from '../../src/utils/currency';
import { derivePaymentStatus, getPaymentStatusMeta, formatStatusLabel } from '../../src/utils/walletHelpers';
import { Booking, Transaction, Wallet } from '../../src/types';

const tabs = ['Upcoming', 'Completed', 'Cancelled'];

const statusColors: Record<string, string> = {
  pending: Colors.warning,
  confirmed: Colors.info,
  arrived: Colors.info,
  completed: Colors.success,
  cancelled: Colors.error,
  rejected: Colors.error,
  no_show: Colors.error,
  disputed: Colors.warning,
};

const PAYMENT_TONE_COLOR: Record<string, string> = {
  success: Colors.success,
  error: Colors.error,
  warning: Colors.warning,
  info: Colors.info,
  neutral: Colors.textMuted,
};

export default function Bookings() {
  const router = useRouter();
  const { user } = useAuth();
  const [selectedTab, setSelectedTab] = useState('Upcoming');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [reviewedBookingIds, setReviewedBookingIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [reviewModal, setReviewModal] = useState<Booking | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const [bookingList, myReviews, walletData, txnData] = await Promise.all([
        bookingService.getBookings({ role: 'customer' }),
        reviewService.getMyReviews().catch(() => []),
        user?.auth_id ? walletService.getWallet(user.auth_id).catch(() => null) : Promise.resolve(null),
        user?.auth_id ? walletService.getTransactions(user.auth_id).catch(() => []) : Promise.resolve([]),
      ]);
      setBookings(bookingList);
      setReviewedBookingIds(new Set(myReviews.map((r) => r.booking_id)));
      setWallet(walletData);
      setTransactions(txnData);
    } catch (err: any) {
      console.error('[bookings] failed to load', err);
      setError(err?.friendlyMessage || 'Could not load your bookings.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.auth_id]);

  // Refresh wallet + bookings every time this screen regains focus so
  // balance/escrow/status reflect any change made elsewhere (Top Up,
  // a provider marking a booking completed, an admin-side refund/release,
  // etc.) - never a stale locally-cached figure. This also covers the
  // initial mount/focus, so no separate mount-only effect is needed.
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      if (selectedTab === 'Upcoming') return ['pending', 'confirmed', 'arrived'].includes(b.status);
      if (selectedTab === 'Completed') return b.status === 'completed';
      if (selectedTab === 'Cancelled')
        return ['cancelled', 'rejected', 'no_show', 'disputed'].includes(b.status);
      return true;
    });
  }, [bookings, selectedTab]);

  const handleCancel = (booking: Booking) => {
    Alert.alert('Cancel booking?', 'This cannot be undone.', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, cancel',
        style: 'destructive',
        onPress: async () => {
          setBusyId(booking.id);
          try {
            const updated = await bookingService.cancelBooking(booking.id);
            setBookings((prev) => prev.map((b) => (b.id === booking.id ? updated : b)));
          } catch (err: any) {
            Alert.alert('Error', err?.friendlyMessage || 'Could not cancel this booking.');
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  const openReviewModal = (booking: Booking) => {
    setReviewRating(5);
    setReviewComment('');
    setReviewModal(booking);
  };

  const submitReview = async () => {
    if (!reviewModal) return;
    setSubmittingReview(true);
    try {
      await reviewService.createReview({
        booking_id: reviewModal.id,
        provider_id: reviewModal.provider_id,
        rating: reviewRating,
        comment: reviewComment.trim(),
      });
      setReviewedBookingIds((prev) => new Set(prev).add(reviewModal.id));
      setReviewModal(null);
      Alert.alert('Thank you!', 'Your review has been submitted.');
    } catch (err: any) {
      Alert.alert('Error', err?.friendlyMessage || 'Could not submit your review.');
    } finally {
      setSubmittingReview(false);
    }
  };

  const handlePayFromWallet = async (booking: Booking) => {
    setBusyId(booking.id);
    try {
      if ((wallet?.balance ?? 0) < booking.total_amount) {
        Alert.alert(
          'Insufficient balance',
          `Your wallet balance (${formatCurrency(wallet?.balance ?? 0)}) is less than ${formatCurrency(
            booking.total_amount
          )}. Top up your wallet to complete this payment.`,
          [
            { text: 'Not now', style: 'cancel' },
            { text: 'Top Up Wallet', onPress: () => router.push('/wallet/topup') },
          ]
        );
        return;
      }
      await bookingService.payWithWallet(booking.id);
      Alert.alert('Payment Successful', 'Your booking is now paid and held in escrow.');
      loadData();
    } catch (err: any) {
      Alert.alert('Payment Failed', err?.friendlyMessage || 'Could not process payment.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>My Bookings</Text>
      </View>

      <View style={styles.tabs}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tabButton, selectedTab === tab && styles.tabButtonActive]}
            onPress={() => setSelectedTab(tab)}
            accessibilityRole="button"
            accessibilityLabel={tab}
          >
            <Text style={[styles.tabText, selectedTab === tab && styles.tabTextActive]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.bookingsList}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.primary} />
          }
        >
          {error ? (
            <View style={styles.emptyState}>
              <Ionicons name="alert-circle-outline" size={48} color={Colors.error} />
              <Text style={styles.emptyText}>{error}</Text>
            </View>
          ) : filteredBookings.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={64} color={Colors.textMuted} />
              <Text style={styles.emptyText}>No bookings found</Text>
            </View>
          ) : (
            filteredBookings.map((item) => (
              <View key={item.id} style={styles.bookingCard}>
                <View style={styles.bookingHeader}>
                  <TouchableOpacity
                    style={styles.providerIcon}
                    onPress={() => router.push(`/provider/${item.provider_id}`)}
                    accessibilityRole="button"
                    accessibilityLabel={item.provider_name}
                  >
                    <Ionicons name="storefront" size={24} color={Colors.primary} />
                  </TouchableOpacity>
                  <View style={styles.bookingInfo}>
                    <Text style={styles.providerName}>{item.provider_name}</Text>
                    <Text style={styles.serviceName}>{item.service_name}</Text>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: `${statusColors[item.status] || Colors.textMuted}20` },
                    ]}
                  >
                    <Text
                      style={[styles.statusText, { color: statusColors[item.status] || Colors.textMuted }]}
                    >
                      {formatStatusLabel(item.status)}
                    </Text>
                  </View>
                </View>

                <View style={styles.bookingDetails}>
                  <View style={styles.detailItem}>
                    <Ionicons name="calendar-outline" size={16} color={Colors.textSecondary} />
                    <Text style={styles.detailText}>{item.date}</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Ionicons name="time-outline" size={16} color={Colors.textSecondary} />
                    <Text style={styles.detailText}>{item.time}</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Ionicons name="cash-outline" size={16} color={Colors.textSecondary} />
                    <Text style={styles.detailText}>{formatCurrency(item.total_amount)}</Text>
                  </View>
                </View>

                {(() => {
                  const paymentKey = derivePaymentStatus(item, transactions);
                  const paymentMeta = getPaymentStatusMeta(paymentKey);
                  return (
                    <View
                      style={[
                        styles.paymentBadge,
                        { backgroundColor: `${PAYMENT_TONE_COLOR[paymentMeta.tone]}18` },
                      ]}
                    >
                      <Ionicons name="shield-checkmark-outline" size={12} color={PAYMENT_TONE_COLOR[paymentMeta.tone]} />
                      <Text style={[styles.paymentBadgeText, { color: PAYMENT_TONE_COLOR[paymentMeta.tone] }]}>
                        {paymentMeta.label}
                      </Text>
                    </View>
                  );
                })()}

                {item.status === 'pending' && derivePaymentStatus(item, transactions) === 'awaiting_payment' && (
                  <TouchableOpacity
                    style={styles.payNowButton}
                    onPress={() => handlePayFromWallet(item)}
                    disabled={busyId === item.id}
                    accessibilityRole="button"
                    accessibilityLabel="Pay from wallet"
                  >
                    {busyId === item.id ? (
                      <ActivityIndicator size="small" color={Colors.text} />
                    ) : (
                      <>
                        <Ionicons name="wallet-outline" size={16} color={Colors.text} />
                        <Text style={styles.payNowButtonText}>Pay from Wallet</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}

                {['pending', 'confirmed'].includes(item.status) && (
                  <View style={styles.bookingActions}>
                    <TouchableOpacity
                      style={styles.actionButtonSecondary}
                      onPress={() => handleCancel(item)}
                      disabled={busyId === item.id}
                      accessibilityRole="button"
                      accessibilityLabel="Cancel booking"
                    >
                      {busyId === item.id ? (
                        <ActivityIndicator size="small" color={Colors.text} />
                      ) : (
                        <Text style={styles.actionButtonTextSecondary}>Cancel</Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.actionButtonPrimary}
                      onPress={() => router.push(`/provider/${item.provider_id}`)}
                      accessibilityRole="button"
                      accessibilityLabel="View Details"
                    >
                      <Text style={styles.actionButtonTextPrimary}>View Details</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {item.status === 'completed' && !reviewedBookingIds.has(item.id) && (
                  <TouchableOpacity
                    style={styles.reviewButton}
                    onPress={() => openReviewModal(item)}
                    accessibilityRole="button"
                    accessibilityLabel="Leave a review"
                  >
                    <Ionicons name="star-outline" size={16} color={Colors.primary} />
                    <Text style={styles.reviewButtonText}>Leave a Review</Text>
                  </TouchableOpacity>
                )}
                {item.status === 'completed' && reviewedBookingIds.has(item.id) && (
                  <View style={styles.reviewedBadge}>
                    <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                    <Text style={styles.reviewedBadgeText}>Reviewed</Text>
                  </View>
                )}
              </View>
            ))
          )}
        </ScrollView>
      )}

      <Modal visible={!!reviewModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Rate your experience</Text>
              <TouchableOpacity
                onPress={() => setReviewModal(null)}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>{reviewModal?.provider_name}</Text>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => setReviewRating(star)}
                  accessibilityRole="button"
                  accessibilityLabel={`${star} star`}
                >
                  <Ionicons
                    name={star <= reviewRating ? 'star' : 'star-outline'}
                    size={36}
                    color={Colors.warning}
                  />
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={styles.commentInput}
              placeholder="Share details of your experience..."
              placeholderTextColor={Colors.textMuted}
              value={reviewComment}
              onChangeText={setReviewComment}
              multiline
            />
            <Button
              title="Submit Review"
              onPress={submitReview}
              loading={submittingReview}
              fullWidth
              size="large"
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  title: {
    fontSize: FontSizes.xxl,
    fontWeight: 'bold',
    color: Colors.text,
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  tabButton: {
    flex: 1,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: Colors.primary,
  },
  tabText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  tabTextActive: {
    color: Colors.text,
  },
  bookingsList: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  bookingCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  bookingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  providerIcon: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
  },
  bookingInfo: {
    flex: 1,
  },
  providerName: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 2,
  },
  serviceName: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  statusText: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  bookingDetails: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  paymentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.sm,
  },
  paymentBadgeText: { fontSize: FontSizes.xs, fontWeight: '600' },
  payNowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  payNowButtonText: { fontSize: FontSizes.sm, fontWeight: '700', color: Colors.text },
  bookingActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  actionButtonSecondary: {
    flex: 1,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
  },
  actionButtonTextSecondary: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.text,
  },
  actionButtonPrimary: {
    flex: 1,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
  },
  actionButtonTextPrimary: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.text,
  },
  reviewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: Spacing.sm,
    backgroundColor: `${Colors.primary}20`,
    borderRadius: BorderRadius.sm,
  },
  reviewButtonText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.primary,
  },
  reviewedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: Spacing.sm,
  },
  reviewedBadgeText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.success,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    padding: Spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  modalTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.text,
  },
  modalSubtitle: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
  },
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  commentInput: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    color: Colors.text,
    fontSize: FontSizes.sm,
    minHeight: 90,
    textAlignVertical: 'top',
    marginBottom: Spacing.lg,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl * 2,
  },
  emptyText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
  },
});