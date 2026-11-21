import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../src/components/common';
import { Colors, FontSizes, Spacing } from '../../src/constants/theme';
import { useAuth } from '../../src/contexts/AuthContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { chatService } from '../../src/services/chat.service';
import { walletService } from '../../src/services/wallet.service';
import { formatCurrency } from '../../src/utils/currency';

type Step = 'summary' | 'success' | 'failed';

/** Pays a service invoice from the customer's wallet (held in escrow until the service is done). */
export default function ServiceInvoicePayment() {
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuth();
  const { invoiceId } = useLocalSearchParams<{ invoiceId: string }>();
  const [invoice, setInvoice] = useState<any>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [step, setStep] = useState<Step>('summary');
  const [message, setMessage] = useState('');
  const [shortfall, setShortfall] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    chatService.getInvoice(Number(invoiceId)).then(setInvoice).catch(() => setMessage('Invoice could not be loaded.')).finally(() => setLoading(false));
  }, [invoiceId]);

  // Refresh the balance whenever the screen is shown (e.g. after topping up).
  useFocusEffect(useCallback(() => {
    if (!user?.auth_id) return;
    walletService.getWallet(user.auth_id).then((w) => setBalance(Number(w?.balance ?? 0))).catch(() => setBalance(null));
  }, [user?.auth_id]));

  const amount = Number(invoice?.amount || 0);
  const insufficient = balance !== null && balance < amount;

  const pay = async () => {
    setPaying(true);
    setMessage('');
    setShortfall(null);
    try {
      await chatService.payServiceInvoice(Number(invoiceId));
      setStep('success');
    } catch (error: any) {
      const detail = error?.response?.data?.detail;
      if (detail && typeof detail === 'object' && detail.error) {
        setShortfall(Number(detail.shortfall ?? 0) || null);
        setMessage(`Your wallet balance is not enough for this invoice.`);
      } else {
        setMessage(typeof detail === 'string' ? detail : error?.friendlyMessage || error?.message || 'Payment failed.');
      }
      setStep('failed');
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}><ActivityIndicator style={styles.loader} color={colors.primary} /></SafeAreaView>;
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Go back"><Ionicons name="arrow-back" size={24} color={colors.text} /></TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Service Invoice</Text>
        <View style={{ width: 24 }} />
      </View>
      <View style={styles.content}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>Service</Text>
        <Text style={[styles.value, { color: colors.text }]}>{invoice?.service || invoice?.service_name || 'Service appointment'}</Text>
        <Text style={[styles.label, { color: colors.textSecondary }]}>Amount</Text>
        <Text style={[styles.amount, { color: colors.text }]}>{formatCurrency(amount)}</Text>
        {balance !== null && (
          <Text style={{ color: insufficient ? Colors.error : colors.textSecondary, marginBottom: Spacing.md }}>
            Wallet balance: {formatCurrency(balance)}
          </Text>
        )}

        {step === 'success' ? (
          <>
            <Text style={{ color: Colors.success, marginBottom: Spacing.md }}>Paid from your wallet. The booking is created and your money is held safely until the service is done.</Text>
            <Button title="View Bookings" onPress={() => router.replace('/(tabs)/bookings')} fullWidth />
          </>
        ) : (
          <>
            {!!message && <Text style={{ color: Colors.error, marginBottom: Spacing.md }}>{message}{shortfall ? ` Add at least ${formatCurrency(shortfall)} to continue.` : ''}</Text>}
            {insufficient || shortfall ? (
              <Button title="Top up wallet" onPress={() => router.push('/(tabs)/wallet')} fullWidth />
            ) : (
              <Button title={`Pay ${formatCurrency(amount)} from wallet`} onPress={pay} loading={paying} disabled={paying || !invoice} fullWidth />
            )}
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loader: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.lg },
  title: { fontSize: FontSizes.lg, fontWeight: '700' },
  content: { padding: Spacing.lg, gap: Spacing.sm },
  label: { fontSize: FontSizes.sm, marginTop: Spacing.md },
  value: { fontSize: FontSizes.md, fontWeight: '600' },
  amount: { fontSize: FontSizes.xl, fontWeight: '700', marginBottom: Spacing.sm },
});
