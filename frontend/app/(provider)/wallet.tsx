import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { Colors, FontSizes, Spacing, BorderRadius } from '../../src/constants/theme';
import { useAuth } from '../../src/contexts/AuthContext';
import { walletService } from '../../src/services/wallet.service';
import { bookingService } from '../../src/services/booking.service';
import { formatCurrency } from '../../src/utils/currency';
import TransactionList from '../../src/components/wallet/TransactionList';
import { Wallet, Transaction, Booking } from '../../src/types';

const netAmount = (b: Booking) => (b.total_amount || 0) - (b.platform_fee_amount || 0);

export default function ProviderWallet() {
  const router = useRouter();
  const { user } = useAuth();

  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!user?.auth_id) return;
    try {
      setError(null);
      const [w, txns, bookingList] = await Promise.all([
        walletService.getWallet(user.auth_id),
        walletService.getTransactions(user.auth_id).catch(() => []),
        bookingService.getBookings({ role: 'provider' }).catch(() => []),
      ]);
      setWallet(w);
      setTransactions(txns);
      setBookings(bookingList);
    } catch (err: any) {
      console.error('[provider-wallet] failed to load', err);
      setError(err?.friendlyMessage || 'Could not load your wallet.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.auth_id]);

  // Refresh every time this screen regains focus - covers a customer's
  // wallet payment moving a booking into escrow, an escrow release after
  // service completion, or a withdrawal, that happened while this screen
  // wasn't visible. Also covers the initial mount/focus.
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // Earnings breakdown: "In Escrow" is a best-effort projection derived
  // from real bookings still confirmed/arrived (net of platform fee) since
  // the production API has no dedicated per-booking escrow-status field.
  // "Released Earnings" is NOT a local calculation - it's the sum of real
  // ESCROW_RELEASE transactions already recorded in the production wallet
  // ledger (GET /api/wallet/transactions), so it reflects exactly what the
  // backend has released to this provider, never a guess. Wallet balance
  // (availableBalance) is the real, authoritative available/withdrawable
  // amount - it never includes escrowed/unreleased funds.
  const stats = useMemo(() => {
    const completed = bookings.filter((b) => b.status === 'completed');
    const pendingBookings = bookings.filter((b) => ['confirmed', 'arrived'].includes(b.status));
    const inEscrow = pendingBookings.reduce((sum, b) => sum + netAmount(b), 0);
    const releasedEarnings = transactions
      .filter((t) => t.type.includes('RELEASE'))
      .reduce((sum, t) => sum + t.amount, 0);
    const totalEarnings = releasedEarnings + inEscrow;
    const availableBalance = wallet?.balance ?? 0;

    const monthly = new Map<string, number>();
    completed.forEach((b) => {
      const d = new Date(b.scheduled_at || b.created_at);
      if (isNaN(d.getTime())) return;
      const key = d.toLocaleDateString('en-NG', { month: 'short', year: 'numeric' });
      monthly.set(key, (monthly.get(key) || 0) + netAmount(b));
    });
    const monthlyEarnings = Array.from(monthly.entries())
      .slice(-6)
      .reverse();
    const maxMonthly = Math.max(1, ...monthlyEarnings.map(([, v]) => v));

    return {
      availableBalance,
      withdrawableBalance: availableBalance,
      inEscrow,
      releasedEarnings,
      totalEarnings,
      monthlyEarnings,
      maxMonthly,
    };
  }, [wallet, bookings, transactions]);

  const withdrawalHistory = useMemo(
    () => transactions.filter((t) => t.type.includes('WITHDRAWAL')),
    [transactions]
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.primary} />
        }
      >
        <Text style={styles.title}>Wallet</Text>

        {error ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={20} color={Colors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Available Balance</Text>
          <Text style={styles.balanceValue}>{formatCurrency(stats.availableBalance)}</Text>
          <TouchableOpacity
            style={styles.withdrawButton}
            onPress={() => router.push('/(provider)/withdraw')}
            accessibilityRole="button"
            accessibilityLabel="Withdraw funds"
          >
            <Ionicons name="arrow-up-circle" size={18} color={Colors.text} />
            <Text style={styles.withdrawButtonText}>Withdraw</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{formatCurrency(stats.inEscrow)}</Text>
            <Text style={styles.statLabel}>In Escrow</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{formatCurrency(stats.releasedEarnings)}</Text>
            <Text style={styles.statLabel}>Released Earnings</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{formatCurrency(stats.totalEarnings)}</Text>
            <Text style={styles.statLabel}>Total Earnings</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{formatCurrency(stats.withdrawableBalance)}</Text>
            <Text style={styles.statLabel}>Withdrawable</Text>
          </View>
        </View>
        <Text style={styles.escrowHint}>
          Money from new bookings stays locked in escrow and only moves into your wallet once the
          service is marked completed and released.
        </Text>

        {/* Monthly earnings */}
        <Text style={styles.sectionTitle}>Monthly Earnings</Text>
        {stats.monthlyEarnings.length === 0 ? (
          <Text style={styles.emptyInline}>No completed bookings yet.</Text>
        ) : (
          <View style={styles.monthlyCard}>
            {stats.monthlyEarnings.map(([month, amount]) => (
              <View key={month} style={styles.monthlyRow}>
                <Text style={styles.monthlyLabel}>{month}</Text>
                <View style={styles.monthlyBarTrack}>
                  <View
                    style={[
                      styles.monthlyBarFill,
                      { width: `${Math.max(6, (amount / stats.maxMonthly) * 100)}%` },
                    ]}
                  />
                </View>
                <Text style={styles.monthlyAmount}>{formatCurrency(amount)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Withdrawal history */}
        <Text style={styles.sectionTitle}>Withdrawal History</Text>
        {withdrawalHistory.length === 0 ? (
          <Text style={styles.emptyInline}>No withdrawals yet.</Text>
        ) : (
          withdrawalHistory.map((w) => (
            <View key={w.id} style={styles.withdrawalRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.withdrawalDesc}>{w.description || 'Withdrawal'}</Text>
                <Text style={styles.withdrawalDate}>
                  {new Date(w.created_at).toLocaleDateString('en-NG', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.withdrawalAmount}>{formatCurrency(w.amount)}</Text>
                <Text
                  style={[
                    styles.withdrawalStatus,
                    w.status === 'completed' && { color: Colors.success },
                    w.status === 'failed' && { color: Colors.error },
                    w.status === 'pending' && { color: Colors.warning },
                  ]}
                >
                  {w.status}
                </Text>
              </View>
            </View>
          ))
        )}

        <TransactionList transactions={transactions} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centerState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl },
  title: { fontSize: FontSizes.xxl, fontWeight: 'bold', color: Colors.text, marginVertical: Spacing.md },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: `${Colors.error}15`,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  errorText: { flex: 1, fontSize: FontSizes.sm, color: Colors.error },
  balanceCard: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  balanceLabel: { fontSize: FontSizes.sm, color: Colors.text, opacity: 0.85 },
  balanceValue: { fontSize: 32, fontWeight: 'bold', color: Colors.text, marginTop: 4, marginBottom: Spacing.md },
  withdrawButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.md,
  },
  withdrawButtonText: { fontSize: FontSizes.sm, fontWeight: '700', color: Colors.text },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.sm },
  escrowHint: {
    fontSize: FontSizes.xs,
    color: Colors.textMuted,
    marginBottom: Spacing.lg,
    lineHeight: 16,
  },
  statCard: {
    flexBasis: '48%',
    flexGrow: 1,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
  },
  statValue: { fontSize: FontSizes.md, fontWeight: '700', color: Colors.text },
  statLabel: { fontSize: FontSizes.xs, color: Colors.textSecondary, marginTop: 2, textAlign: 'center' },
  sectionTitle: { fontSize: FontSizes.md, fontWeight: '700', color: Colors.text, marginBottom: Spacing.sm },
  emptyInline: { fontSize: FontSizes.sm, color: Colors.textMuted, marginBottom: Spacing.lg },
  monthlyCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  monthlyRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  monthlyLabel: { fontSize: FontSizes.xs, color: Colors.textSecondary, width: 64 },
  monthlyBarTrack: {
    flex: 1,
    height: 8,
    backgroundColor: Colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  monthlyBarFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 4 },
  monthlyAmount: { fontSize: FontSizes.xs, fontWeight: '700', color: Colors.text, width: 84, textAlign: 'right' },
  withdrawalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  withdrawalDesc: { fontSize: FontSizes.sm, fontWeight: '600', color: Colors.text },
  withdrawalDate: { fontSize: FontSizes.xs, color: Colors.textMuted, marginTop: 2 },
  withdrawalAmount: { fontSize: FontSizes.sm, fontWeight: '700', color: Colors.text },
  withdrawalStatus: { fontSize: FontSizes.xs, color: Colors.textMuted, marginTop: 2, textTransform: 'capitalize' },
});
