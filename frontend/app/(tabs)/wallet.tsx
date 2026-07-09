import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { Colors, FontSizes, Spacing, BorderRadius } from '../../src/constants/theme';
import { useAuth } from '../../src/contexts/AuthContext';
import { walletService } from '../../src/services/wallet.service';
import { formatCurrency } from '../../src/utils/currency';
import TransactionList from '../../src/components/wallet/TransactionList';
import { ErrorBanner } from '../../src/components/common';
import { Wallet, Transaction } from '../../src/types';
import { getErrorMessage } from '../../src/utils/errors';

export default function CustomerWallet() {
  const router = useRouter();
  const { user } = useAuth();

  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!user?.auth_id) return;
    try {
      setError(null);
      const [w, txns] = await Promise.all([
        walletService.getWallet(user.auth_id),
        walletService.getTransactions(user.auth_id).catch(() => []),
      ]);
      setWallet(w);
      setTransactions(txns);
    } catch (err: any) {
      console.error('[wallet] failed to load', err);
      setError(getErrorMessage(err, 'Could not load your wallet.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.auth_id]);

  // Refresh every time this screen regains focus - covers Top Up, a
  // booking payment, an escrow release/refund, or a cancellation that
  // happened while this screen wasn't visible. Also covers the initial
  // mount/focus, so no separate mount-only effect is needed.
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // Derived stats - all computed from real wallet balance + transaction
  // history, never hardcoded. See walletHelpers.ts for the pending-escrow
  // heuristic (an ESCROW_HOLD transaction with no matching RELEASE/REFUND
  // for the same booking yet).
  const stats = useMemo(() => {
    const currentBalance = wallet?.balance ?? 0;
    const releasedOrRefundedBookingIds = new Set(
      transactions
        .filter((t) => t.type.includes('RELEASE') || t.type.includes('REFUND'))
        .map((t) => t.booking_id)
        .filter(Boolean)
    );
    const pendingEscrow = transactions
      .filter((t) => t.type.includes('ESCROW_HOLD') && !releasedOrRefundedBookingIds.has(t.booking_id))
      .reduce((sum, t) => sum + t.amount, 0);
    const totalSpent = transactions
      .filter((t) => t.direction === 'DEBIT' && (t.type.includes('BOOKING') || t.type.includes('ESCROW_HOLD')))
      .reduce((sum, t) => sum + t.amount, 0);
    return {
      currentBalance,
      pendingEscrow,
      availableBalance: currentBalance,
      totalSpent,
    };
  }, [wallet, transactions]);

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

        <ErrorBanner message={error} iconSize={20} style={{ backgroundColor: `${Colors.error}15` }} />

        {/* Balance card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Current Balance</Text>
          <Text style={styles.balanceValue}>{formatCurrency(stats.currentBalance)}</Text>
          <TouchableOpacity
            style={styles.topUpButton}
            onPress={() => router.push('/wallet/topup')}
            accessibilityRole="button"
            accessibilityLabel="Top up wallet"
          >
            <Ionicons name="add-circle" size={18} color={Colors.text} />
            <Text style={styles.topUpButtonText}>Top Up</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{formatCurrency(stats.pendingEscrow)}</Text>
            <Text style={styles.statLabel}>Pending Escrow</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{formatCurrency(stats.availableBalance)}</Text>
            <Text style={styles.statLabel}>Available</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{formatCurrency(stats.totalSpent)}</Text>
            <Text style={styles.statLabel}>Total Spent</Text>
          </View>
        </View>

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
  balanceCard: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  balanceLabel: { fontSize: FontSizes.sm, color: Colors.text, opacity: 0.85 },
  balanceValue: { fontSize: 32, fontWeight: 'bold', color: Colors.text, marginTop: 4, marginBottom: Spacing.md },
  topUpButton: {
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
  topUpButtonText: { fontSize: FontSizes.sm, fontWeight: '700', color: Colors.text },
  statsRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    alignItems: 'center',
  },
  statValue: { fontSize: FontSizes.sm, fontWeight: '700', color: Colors.text },
  statLabel: { fontSize: FontSizes.xs, color: Colors.textSecondary, marginTop: 2, textAlign: 'center' },
});
