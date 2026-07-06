import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, FontSizes, Spacing, BorderRadius } from '../../src/constants/theme';
import { Button } from '../../src/components/common';
import { useAuth } from '../../src/contexts/AuthContext';
import { walletService } from '../../src/services/wallet.service';
import { formatCurrency } from '../../src/utils/currency';
import { NIGERIAN_BANKS } from '../../src/utils/walletHelpers';
import { Wallet } from '../../src/types';

export default function ProviderWithdraw() {
  const router = useRouter();
  const { user } = useAuth();

  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loadingWallet, setLoadingWallet] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [bankPickerVisible, setBankPickerVisible] = useState(false);
  const [bankSearch, setBankSearch] = useState('');

  const [form, setForm] = useState({ amount: '', bank_name: '', account_number: '', account_name: '' });

  const loadWallet = useCallback(async () => {
    if (!user?.auth_id) return;
    try {
      const w = await walletService.getWallet(user.auth_id);
      setWallet(w);
    } catch (err) {
      console.error('[withdraw] failed to load wallet', err);
    } finally {
      setLoadingWallet(false);
    }
  }, [user?.auth_id]);

  useEffect(() => {
    loadWallet();
  }, [loadWallet]);

  const filteredBanks = NIGERIAN_BANKS.filter((b) =>
    b.toLowerCase().includes(bankSearch.trim().toLowerCase())
  );

  const handleSubmit = async () => {
    const amount = Number(form.amount);
    if (!amount || amount <= 0) {
      Alert.alert('Missing info', 'Please enter a valid withdrawal amount.');
      return;
    }
    if (wallet && amount > wallet.balance) {
      Alert.alert('Insufficient balance', `You can withdraw up to ${formatCurrency(wallet.balance)}.`);
      return;
    }
    if (!form.bank_name || !form.account_number.trim() || !form.account_name.trim()) {
      Alert.alert('Missing info', 'Please fill in bank, account number and account name.');
      return;
    }
    setSubmitting(true);
    try {
      await walletService.requestWithdrawal({
        amount,
        bank_name: form.bank_name,
        account_number: form.account_number.trim(),
        account_name: form.account_name.trim(),
      });
      // requestWithdrawal always throws today (see wallet.service.ts) since
      // no withdrawal-creation endpoint exists on the production API yet.
    } catch (err: any) {
      Alert.alert(
        'Coming Soon',
        err?.friendlyMessage ||
          'Withdrawal requests are coming soon. This feature is not yet available on the server.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Withdraw Funds</Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.balanceBanner}>
            <Text style={styles.balanceLabel}>Available to withdraw</Text>
            {loadingWallet ? (
              <ActivityIndicator color={Colors.primary} />
            ) : (
              <Text style={styles.balanceValue}>{formatCurrency(wallet?.balance ?? 0)}</Text>
            )}
          </View>

          <View style={styles.noticeBanner}>
            <Ionicons name="information-circle-outline" size={18} color={Colors.warning} />
            <Text style={styles.noticeText}>
              Withdrawal processing is coming soon. You can fill in and submit this form, but requests
              are not sent to the backend yet.
            </Text>
          </View>

          <Text style={styles.label}>Amount (₦)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 5000"
            placeholderTextColor={Colors.textMuted}
            keyboardType="numeric"
            value={form.amount}
            onChangeText={(v) => setForm((f) => ({ ...f, amount: v.replace(/[^0-9]/g, '') }))}
          />

          <Text style={styles.label}>Bank</Text>
          <TouchableOpacity
            style={styles.selectInput}
            onPress={() => setBankPickerVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Select bank"
          >
            <Text style={form.bank_name ? styles.selectValue : styles.selectPlaceholder}>
              {form.bank_name || 'Select your bank'}
            </Text>
            <Ionicons name="chevron-down" size={18} color={Colors.textMuted} />
          </TouchableOpacity>

          <Text style={styles.label}>Account Number</Text>
          <TextInput
            style={styles.input}
            placeholder="10-digit account number"
            placeholderTextColor={Colors.textMuted}
            keyboardType="numeric"
            maxLength={10}
            value={form.account_number}
            onChangeText={(v) => setForm((f) => ({ ...f, account_number: v.replace(/[^0-9]/g, '') }))}
          />

          <Text style={styles.label}>Account Name</Text>
          <TextInput
            style={styles.input}
            placeholder="As it appears on your bank account"
            placeholderTextColor={Colors.textMuted}
            value={form.account_name}
            onChangeText={(v) => setForm((f) => ({ ...f, account_name: v }))}
          />

          <Button
            title="Submit Withdrawal"
            onPress={handleSubmit}
            loading={submitting}
            fullWidth
            size="large"
          />
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={bankPickerVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Bank</Text>
              <TouchableOpacity
                onPress={() => setBankPickerVisible(false)}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Search banks..."
              placeholderTextColor={Colors.textMuted}
              value={bankSearch}
              onChangeText={setBankSearch}
            />
            <ScrollView style={{ maxHeight: 360 }}>
              {filteredBanks.map((bank) => (
                <TouchableOpacity
                  key={bank}
                  style={styles.bankRow}
                  onPress={() => {
                    setForm((f) => ({ ...f, bank_name: bank }));
                    setBankPickerVisible(false);
                    setBankSearch('');
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={bank}
                >
                  <Text style={styles.bankRowText}>{bank}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  title: { fontSize: FontSizes.lg, fontWeight: 'bold', color: Colors.text },
  content: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl },
  balanceBanner: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  balanceLabel: { fontSize: FontSizes.xs, color: Colors.textSecondary },
  balanceValue: { fontSize: FontSizes.xl, fontWeight: 'bold', color: Colors.text, marginTop: 4 },
  noticeBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    backgroundColor: `${Colors.warning}15`,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  noticeText: { flex: 1, fontSize: FontSizes.xs, color: Colors.textSecondary },
  label: { fontSize: FontSizes.sm, color: Colors.textSecondary, marginBottom: Spacing.xs, marginTop: Spacing.sm },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: FontSizes.sm,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  selectInput: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.sm,
  },
  selectValue: { fontSize: FontSizes.sm, color: Colors.text },
  selectPlaceholder: { fontSize: FontSizes.sm, color: Colors.textMuted },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    padding: Spacing.lg,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  modalTitle: { fontSize: FontSizes.lg, fontWeight: '700', color: Colors.text },
  bankRow: { paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  bankRowText: { fontSize: FontSizes.sm, color: Colors.text },
});
