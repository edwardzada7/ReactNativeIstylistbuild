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
import { useTheme } from '../../src/contexts/ThemeContext';
import { walletService } from '../../src/services/wallet.service';
import { formatCurrency } from '../../src/utils/currency';
import { NIGERIAN_BANKS } from '../../src/utils/walletHelpers';
import { Wallet } from '../../src/types';

export default function ProviderWithdraw() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();

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
      const response = await walletService.requestWithdrawal({
        authId: user?.auth_id || '',
        amount,
        bank_name: form.bank_name,
        account_number: form.account_number.trim(),
        account_name: form.account_name.trim(),
      });
      if (response.ok) {
        Alert.alert('Success', 'Your withdrawal request has been submitted successfully.');
        setForm({ amount: '', bank_name: '', account_number: '', account_name: '' });
        loadWallet();
      } else {
        Alert.alert('Request Failed', response.message || 'Failed to submit withdrawal request.');
      }
    } catch (err: any) {
      Alert.alert('Request Failed', err?.friendlyMessage || err?.message || 'Failed to submit withdrawal request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Withdraw Funds</Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={[styles.balanceBanner, { backgroundColor: colors.surface }]}>
            <Text style={[styles.balanceLabel, { color: colors.textSecondary }]}>Available to withdraw</Text>
            {loadingWallet ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Text style={[styles.balanceValue, { color: colors.text }]}>{formatCurrency(wallet?.balance ?? 0)}</Text>
            )}
          </View>

          <Text style={[styles.label, { color: colors.text }]}>Amount (₦)</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
            placeholder="e.g. 5000"
            placeholderTextColor={colors.textMuted}
            keyboardType="numeric"
            value={form.amount}
            onChangeText={(v) => setForm((f) => ({ ...f, amount: v.replace(/[^0-9]/g, '') }))}
          />

          <Text style={[styles.label, { color: colors.text }]}>Bank</Text>
          <TouchableOpacity
            style={[styles.selectInput, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => setBankPickerVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Select bank"
          >
            <Text style={form.bank_name ? [styles.selectValue, { color: colors.text }] : [styles.selectPlaceholder, { color: colors.textMuted }]}>
              {form.bank_name || 'Select your bank'}
            </Text>
            <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
          </TouchableOpacity>

          <Text style={[styles.label, { color: colors.text }]}>Account Number</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
            placeholder="10-digit account number"
            placeholderTextColor={colors.textMuted}
            keyboardType="numeric"
            maxLength={10}
            value={form.account_number}
            onChangeText={(v) => setForm((f) => ({ ...f, account_number: v.replace(/[^0-9]/g, '') }))}
          />

          <Text style={[styles.label, { color: colors.text }]}>Account Name</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
            placeholder="As it appears on your bank account"
            placeholderTextColor={colors.textMuted}
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
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Select Bank</Text>
              <TouchableOpacity
                onPress={() => setBankPickerVisible(false)}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
              placeholder="Search banks..."
              placeholderTextColor={colors.textMuted}
              value={bankSearch}
              onChangeText={setBankSearch}
            />
            <ScrollView style={{ maxHeight: 360 }}>
              {filteredBanks.map((bank) => (
                <TouchableOpacity
                  key={bank}
                  style={[styles.bankRow, { borderBottomColor: colors.border }]}
                  onPress={() => {
                    setForm((f) => ({ ...f, bank_name: bank }));
                    setBankPickerVisible(false);
                    setBankSearch('');
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={bank}
                >
                  <Text style={[styles.bankRowText, { color: colors.text }]}>{bank}</Text>
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
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  title: { fontSize: FontSizes.lg, fontWeight: 'bold' },
  content: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl },
  balanceBanner: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  balanceLabel: { fontSize: FontSizes.xs },
  balanceValue: { fontSize: FontSizes.xl, fontWeight: 'bold', marginTop: 4 },
  label: { fontSize: FontSizes.sm, marginBottom: Spacing.xs, marginTop: Spacing.sm },
  input: {
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: FontSizes.sm,
    marginBottom: Spacing.sm,
    borderWidth: 1,
  },
  selectInput: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
  },
  selectValue: { fontSize: FontSizes.sm },
  selectPlaceholder: { fontSize: FontSizes.sm },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: {
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
  modalTitle: { fontSize: FontSizes.lg, fontWeight: '700' },
  bankRow: { paddingVertical: Spacing.md, borderBottomWidth: 1 },
  bankRowText: { fontSize: FontSizes.sm },
});
