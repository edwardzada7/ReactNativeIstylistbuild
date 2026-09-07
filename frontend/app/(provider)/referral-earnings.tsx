import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { Colors, FontSizes, Spacing, BorderRadius } from '../../src/constants/theme';
import { PlatformReferralEarning, shopService } from '../../src/services/shop.service';
import { formatCurrency } from '../../src/utils/currency';

type ReferralFilter = 'all' | 'provider_shop' | 'provider_service';

const isType = (row: PlatformReferralEarning, type: ReferralFilter) => {
  if (type === 'all') return true;
  return row.referral_type === type || row.referral_type === `${type}_referral`;
};

const labelForType = (type: string) =>
  type === 'provider_shop' || type === 'provider_shop_referral'
    ? 'Provider Shop Referral'
    : type === 'provider_service' || type === 'provider_service_referral'
      ? 'Provider Service Referral'
      : type;

export default function ProviderReferralEarnings() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const [rows, setRows] = useState<PlatformReferralEarning[]>([]);
  const [filter, setFilter] = useState<ReferralFilter>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRows = useCallback(async () => {
    if (!user?.auth_id) return;
    try {
      setError(null);
      setRows(await shopService.getProviderReferralEarnings());
    } catch (err: any) {
      setError(err?.friendlyMessage || 'Could not load referral earnings.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.auth_id]);

  useFocusEffect(useCallback(() => { loadRows(); }, [loadRows]));

  const stats = useMemo(() => ({
    earned: rows.reduce((sum, row) => sum + Number(row.earning_amount || 0), 0),
    pending: rows.filter((row) => row.status === 'pending').reduce((sum, row) => sum + Number(row.earning_amount || 0), 0),
    available: rows.filter((row) => row.status === 'available').reduce((sum, row) => sum + Number(row.earning_amount || 0), 0),
    paid: rows.filter((row) => row.status === 'paid').reduce((sum, row) => sum + Number(row.earning_amount || 0), 0),
  }), [rows]);

  const visibleRows = rows.filter((row) => isType(row, filter));

  if (loading) {
    return <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}><View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View></SafeAreaView>;
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadRows(); }} tintColor={Colors.primary} />}
      >
        <Text style={[styles.title, { color: colors.text }]}>Referral Earnings</Text>
        {error ? <Text style={[styles.error, { color: Colors.error }]}>{error}</Text> : null}
        <View style={styles.stats}>
          {([['earned', 'Total Earned'], ['pending', 'Pending'], ['available', 'Available'], ['paid', 'Paid']] as const).map(([key, label]) => (
            <View key={key} style={[styles.stat, { backgroundColor: colors.surface }]}>
              <Text style={[styles.amount, { color: colors.text }]}>{formatCurrency(stats[key])}</Text>
              <Text style={[styles.caption, { color: colors.textSecondary }]}>{label}</Text>
            </View>
          ))}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {([['all', 'All'], ['provider_shop', 'Provider Shop Referral'], ['provider_service', 'Provider Service Referral']] as const).map(([key, label]) => (
            <TouchableOpacity key={key} onPress={() => setFilter(key)} style={[styles.filter, { borderColor: filter === key ? colors.primary : colors.border, backgroundColor: filter === key ? colors.primary : colors.surface }]}>
              <Text style={{ color: filter === key ? '#fff' : colors.text, fontSize: FontSizes.xs, fontWeight: '600' }}>{label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        {visibleRows.length === 0 ? <Text style={[styles.empty, { color: colors.textSecondary }]}>No referral earnings yet.</Text> : visibleRows.map((row) => (
          <View key={String(row.id)} style={[styles.row, { backgroundColor: colors.surface }]}>
            <View style={styles.rowHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.product, { color: colors.text }]}>{row.product_name || `Product #${row.product_id ?? 'Unknown'}`}</Text>
                <Text style={[styles.type, { color: colors.textSecondary }]}>{labelForType(row.referral_type)}</Text>
              </View>
              <Text style={[styles.reward, { color: Colors.success }]}>{formatCurrency(Number(row.earning_amount || 0))}</Text>
            </View>
            <Text style={[styles.detail, { color: colors.textSecondary }]}>Order #{row.order_id ?? 'Unknown'}  |  Sale {formatCurrency(Number(row.sale_amount || 0))}</Text>
            <View style={styles.rowFooter}>
              <Text style={[styles.status, { color: colors.text }]}><Ionicons name="ellipse" size={8} color={row.status === 'paid' ? Colors.success : row.status === 'pending' ? Colors.warning : colors.primary} />  {row.status}</Text>
              <Text style={[styles.date, { color: colors.textSecondary }]}>{new Date(row.created_at).toLocaleDateString('en-NG')}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xl },
  title: { fontSize: FontSizes.xxl, fontWeight: '700', marginBottom: Spacing.md },
  error: { marginBottom: Spacing.md, fontSize: FontSizes.sm },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  stat: { flexBasis: '48%', flexGrow: 1, padding: Spacing.md, borderRadius: BorderRadius.md },
  amount: { fontSize: FontSizes.md, fontWeight: '700' },
  caption: { fontSize: FontSizes.xs, marginTop: 4 },
  filters: { gap: Spacing.sm, paddingVertical: Spacing.lg },
  filter: { borderWidth: 1, borderRadius: BorderRadius.full, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  empty: { textAlign: 'center', marginTop: Spacing.xl },
  row: { padding: Spacing.md, borderRadius: BorderRadius.md, marginBottom: Spacing.sm },
  rowHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  product: { fontSize: FontSizes.md, fontWeight: '700' },
  type: { fontSize: FontSizes.xs, marginTop: 3 },
  reward: { fontSize: FontSizes.md, fontWeight: '700' },
  detail: { fontSize: FontSizes.xs, marginTop: Spacing.sm },
  rowFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.sm },
  status: { fontSize: FontSizes.xs, textTransform: 'capitalize' },
  date: { fontSize: FontSizes.xs },
});
