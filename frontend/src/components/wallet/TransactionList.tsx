import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSizes, Spacing, BorderRadius } from '../../constants/theme';
import { formatCurrency } from '../../utils/currency';
import { getTransactionMeta, TRANSACTION_FILTERS, Tone } from '../../utils/walletHelpers';
import { Transaction } from '../../types';

const TONE_COLOR: Record<Tone, string> = {
  success: Colors.success,
  error: Colors.error,
  warning: Colors.warning,
  info: Colors.info,
  neutral: Colors.textMuted,
};

interface Props {
  transactions: Transaction[];
  title?: string;
  emptyLabel?: string;
}

/**
 * Shared search + filter + list + details-modal UI for wallet transaction
 * history. Used by both the customer and provider wallet screens so the
 * "Transaction History / Details / Filters / Search" requirement is
 * implemented once, consistently, against the real transaction shape
 * returned by GET /api/wallet/transactions.
 */
export default function TransactionList({
  transactions,
  title = 'Transaction History',
  emptyLabel = 'No transactions found.',
}: Props) {
  const [activeFilter, setActiveFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedTxn, setSelectedTxn] = useState<Transaction | null>(null);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return transactions.filter((t) => {
      if (activeFilter !== 'all' && !t.type.includes(activeFilter)) return false;
      if (!query) return true;
      return (
        t.description.toLowerCase().includes(query) ||
        t.reference.toLowerCase().includes(query) ||
        getTransactionMeta(t.type, t.direction).label.toLowerCase().includes(query)
      );
    });
  }, [transactions, activeFilter, search]);

  return (
    <View>
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search transactions..."
          placeholderTextColor={Colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} accessibilityRole="button" accessibilityLabel="Clear search">
            <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersRow}>
        {TRANSACTION_FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterChip, activeFilter === f.key && styles.filterChipActive]}
            onPress={() => setActiveFilter(f.key)}
            accessibilityRole="button"
            accessibilityLabel={f.label}
          >
            <Text style={[styles.filterChipText, activeFilter === f.key && styles.filterChipTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={styles.sectionTitle}>{title}</Text>
      {filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="receipt-outline" size={40} color={Colors.textMuted} />
          <Text style={styles.emptyText}>{emptyLabel}</Text>
        </View>
      ) : (
        filtered.map((txn) => {
          const meta = getTransactionMeta(txn.type, txn.direction);
          const sign = txn.direction === 'CREDIT' ? '+' : '-';
          return (
            <TouchableOpacity
              key={txn.id}
              style={styles.txnRow}
              onPress={() => setSelectedTxn(txn)}
              accessibilityRole="button"
              accessibilityLabel={`${meta.label} ${formatCurrency(txn.amount)}`}
            >
              <View style={[styles.txnIcon, { backgroundColor: `${TONE_COLOR[meta.tone]}20` }]}>
                <Ionicons name={meta.icon as any} size={20} color={TONE_COLOR[meta.tone]} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.txnLabel}>{meta.label}</Text>
                <Text style={styles.txnDate}>
                  {new Date(txn.created_at).toLocaleDateString('en-NG', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.txnAmount, { color: TONE_COLOR[meta.tone] }]}>
                  {sign}
                  {formatCurrency(txn.amount)}
                </Text>
                <Text style={styles.txnStatus}>{txn.status}</Text>
              </View>
            </TouchableOpacity>
          );
        })
      )}

      <Modal visible={!!selectedTxn} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Transaction Details</Text>
              <TouchableOpacity
                onPress={() => setSelectedTxn(null)}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>
            {selectedTxn && (
              <>
                <DetailRow label="Type" value={getTransactionMeta(selectedTxn.type, selectedTxn.direction).label} />
                <DetailRow
                  label="Amount"
                  value={`${selectedTxn.direction === 'CREDIT' ? '+' : '-'}${formatCurrency(selectedTxn.amount)}`}
                />
                <DetailRow label="Status" value={selectedTxn.status} />
                <DetailRow
                  label="Date"
                  value={new Date(selectedTxn.created_at).toLocaleDateString('en-NG', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                />
                <DetailRow
                  label="Time"
                  value={new Date(selectedTxn.created_at).toLocaleTimeString('en-NG', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                />
                <DetailRow label="Reference" value={selectedTxn.reference || '-'} />
                <DetailRow label="Description" value={selectedTxn.description || '-'} />
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  searchInput: { flex: 1, fontSize: FontSizes.sm, color: Colors.text, paddingVertical: 2 },
  filtersRow: { marginBottom: Spacing.md },
  filterChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.full,
    marginRight: Spacing.sm,
  },
  filterChipActive: { backgroundColor: Colors.primary },
  filterChipText: { fontSize: FontSizes.xs, fontWeight: '600', color: Colors.textSecondary },
  filterChipTextActive: { color: Colors.text },
  sectionTitle: { fontSize: FontSizes.md, fontWeight: '700', color: Colors.text, marginBottom: Spacing.sm },
  emptyState: { alignItems: 'center', paddingVertical: Spacing.xxl, gap: Spacing.sm },
  emptyText: { fontSize: FontSizes.sm, color: Colors.textMuted },
  txnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  txnIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  txnLabel: { fontSize: FontSizes.sm, fontWeight: '600', color: Colors.text },
  txnDate: { fontSize: FontSizes.xs, color: Colors.textMuted, marginTop: 2 },
  txnAmount: { fontSize: FontSizes.sm, fontWeight: '700' },
  txnStatus: { fontSize: FontSizes.xs, color: Colors.textMuted, marginTop: 2, textTransform: 'capitalize' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
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
    marginBottom: Spacing.md,
  },
  modalTitle: { fontSize: FontSizes.lg, fontWeight: '700', color: Colors.text },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.md,
  },
  detailLabel: { fontSize: FontSizes.sm, color: Colors.textSecondary },
  detailValue: { fontSize: FontSizes.sm, color: Colors.text, fontWeight: '600', flex: 1, textAlign: 'right' },
});
