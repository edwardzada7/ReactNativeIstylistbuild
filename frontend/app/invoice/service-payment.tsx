import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../src/components/common';
import { Colors, FontSizes, Spacing } from '../../src/constants/theme';
import { useAuth } from '../../src/contexts/AuthContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { chatService } from '../../src/services/chat.service';
import { walletService } from '../../src/services/wallet.service';
import { formatCurrency } from '../../src/utils/currency';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'https://updatedistylistbeauty-marketplace-production.up.railway.app/api';
const REDIRECT_URL = `${API_BASE_URL.replace(/\/api\/?$/, '')}/service-invoice-payment`;
type Step = 'summary' | 'checkout' | 'success' | 'failed';

export default function ServiceInvoicePayment() {
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuth();
  const { invoiceId } = useLocalSearchParams<{ invoiceId: string }>();
  const [invoice, setInvoice] = useState<any>(null);
  const [step, setStep] = useState<Step>('summary');
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const handledRef = useRef(false);

  useEffect(() => { chatService.getInvoice(Number(invoiceId)).then(setInvoice).catch(() => setMessage('Invoice could not be loaded.')).finally(() => setLoading(false)); }, [invoiceId]);
  const startPayment = async () => {
    if (!user?.email || !invoice) return;
    setLoading(true);
    try {
      const response = await walletService.initializePayment({ amount: Number(invoice.amount), email: user.email, purpose: 'service_invoice', name: user.full_name, phone: user.phone, redirect_url: REDIRECT_URL });
      if (!response.authorization_url) throw new Error(response.message || 'Could not start payment.');
      handledRef.current = false; setCheckoutUrl(response.authorization_url); setStep('checkout');
    } catch (error: any) { setMessage(error?.friendlyMessage || error?.message || 'Could not start payment.'); setStep('failed'); }
    finally { setLoading(false); }
  };
  const handleRedirect = useCallback((request: { url: string }) => {
    if (!request.url.startsWith(REDIRECT_URL) || handledRef.current) return !handledRef.current;
    handledRef.current = true;
    const params = new URLSearchParams(request.url.split('?')[1] || '');
    const reference = params.get('reference') || params.get('tx_ref') || params.get('trxref');
    const transactionId = params.get('transaction_id');
    if (!reference && !transactionId) { setMessage('Payment cancelled.'); setStep('failed'); return false; }
    setLoading(true);
    walletService.verifyPayment(reference || '', transactionId).then(async (result) => {
      if (result.status !== 'success') throw new Error(result.message || 'Payment verification failed.');
      await chatService.payServiceInvoice(Number(invoiceId), reference || '', transactionId); setStep('success');
    }).catch((error: any) => { setMessage(error?.friendlyMessage || error?.message || 'Payment could not be verified.'); setStep('failed'); }).finally(() => setLoading(false));
    return false;
  }, [invoiceId]);

  if (loading && !invoice) return <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}><ActivityIndicator style={styles.loader} color={colors.primary} /></SafeAreaView>;
  if (step === 'checkout' && checkoutUrl) return <SafeAreaView style={styles.container}><WebView source={{ uri: checkoutUrl }} onShouldStartLoadWithRequest={handleRedirect} /></SafeAreaView>;
  return <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}><View style={styles.header}><TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color={colors.text} /></TouchableOpacity><Text style={[styles.title, { color: colors.text }]}>Service Invoice</Text><View style={{ width: 24 }} /></View><View style={styles.content}><Text style={[styles.label, { color: colors.textSecondary }]}>Service</Text><Text style={[styles.value, { color: colors.text }]}>{invoice?.service || invoice?.service_name || 'Service appointment'}</Text><Text style={[styles.label, { color: colors.textSecondary }]}>Amount</Text><Text style={[styles.amount, { color: colors.text }]}>{formatCurrency(Number(invoice?.amount || 0))}</Text>{step === 'success' ? <><Text style={{ color: Colors.success }}>Payment verified and booking created.</Text><Button title="View Bookings" onPress={() => router.replace('/(tabs)/bookings')} fullWidth /></> : step === 'failed' ? <><Text style={{ color: Colors.error }}>{message || 'Payment failed.'}</Text><Button title="Try Again" onPress={() => setStep('summary')} fullWidth /></> : <Button title="Pay Service Invoice" onPress={startPayment} disabled={loading} fullWidth />}</View></SafeAreaView>;
}
const styles = StyleSheet.create({ container: { flex: 1 }, loader: { flex: 1 }, header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.lg }, title: { fontSize: FontSizes.lg, fontWeight: '700' }, content: { padding: Spacing.lg, gap: Spacing.sm }, label: { fontSize: FontSizes.sm, marginTop: Spacing.md }, value: { fontSize: FontSizes.md, fontWeight: '600' }, amount: { fontSize: FontSizes.xl, fontWeight: '700', marginBottom: Spacing.lg } });
