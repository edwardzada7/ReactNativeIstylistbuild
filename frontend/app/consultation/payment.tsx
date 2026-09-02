import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button } from '../../src/components/common';
import { Colors, FontSizes, Spacing } from '../../src/constants/theme';
import { useAuth } from '../../src/contexts/AuthContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { chatService } from '../../src/services/chat.service';
import { walletService } from '../../src/services/wallet.service';
import { formatCurrency } from '../../src/utils/currency';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'https://updatedistylistbeauty-marketplace-production.up.railway.app/api';
const REDIRECT_URL = `${API_BASE_URL.replace(/\/api\/?$/, '')}/consultation-payment`;

type Step = 'summary' | 'checkout' | 'success' | 'failed' | 'cancelled';

export default function ConsultationPayment() {
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ consultationId: string; conversationId: string; providerAuthId: string; providerName: string; specialty: string; fee: string; currency: string }>();
  const [step, setStep] = useState<Step>('summary');
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const handledRef = useRef(false);

  const startPayment = async () => {
    if (!user?.email) {
      Alert.alert('Payment unavailable', 'Your account email is required for payment.');
      return;
    }
    setLoading(true);
    try {
      const response = await walletService.initializePayment({
        amount: Number(params.fee),
        email: user.email,
        purpose: 'consultation',
        name: user.full_name,
        phone: user.phone,
        redirect_url: REDIRECT_URL,
      });
      if (!response?.authorization_url) throw new Error(response?.message || 'Could not start payment.');
      handledRef.current = false;
      setCheckoutUrl(response.authorization_url);
      setStep('checkout');
    } catch (err: any) {
      setMessage(err?.friendlyMessage || err?.message || 'Could not start payment.');
      setStep('failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRedirect = useCallback((request: { url: string }) => {
    if (!request.url.startsWith(REDIRECT_URL)) return true;
    if (handledRef.current) return false;
    handledRef.current = true;
    const query = request.url.split('?')[1] || '';
    const values = new URLSearchParams(query);
    const reference = values.get('reference') || values.get('trxref') || values.get('tx_ref');
    const transactionId = values.get('transaction_id');
    const status = values.get('status');
    if (!reference && !transactionId) {
      setStep('cancelled');
      return false;
    }
    if (status && status !== 'successful' && status !== 'completed') {
      setMessage(`Payment ${status}.`);
      setStep('failed');
      return false;
    }
    setLoading(true);
    walletService.verifyPayment(reference || '', transactionId)
      .then(async (verification) => {
        if (verification?.status !== 'success') throw new Error(verification?.message || 'Payment verification failed.');
        await chatService.activateConsultation(Number(params.consultationId), reference || '', transactionId);
        setStep('success');
      })
      .catch((err: any) => {
        setMessage(err?.friendlyMessage || err?.message || 'Payment could not be verified.');
        setStep('failed');
      })
      .finally(() => setLoading(false));
    return false;
  }, [params.consultationId]);

  const openChat = () => router.replace({ pathname: '/chat/[counterpartAuthId]', params: { counterpartAuthId: params.providerAuthId, conversationId: params.conversationId, conversationType: 'consultation', counterpartName: params.providerName } });

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => (step === 'checkout' ? setStep('summary') : router.back())} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Professional Consultation</Text>
        <View style={{ width: 24 }} />
      </View>
      {step === 'checkout' && checkoutUrl ? (
        <WebView source={{ uri: checkoutUrl }} onShouldStartLoadWithRequest={handleRedirect} style={styles.webview} />
      ) : (
        <View style={styles.content}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Provider</Text>
          <Text style={[styles.value, { color: colors.text }]}>{params.providerName}</Text>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Specialty</Text>
          <Text style={[styles.value, { color: colors.text }]}>{params.specialty}</Text>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Consultation fee</Text>
          <Text style={[styles.fee, { color: colors.text }]}>{formatCurrency(Number(params.fee))}</Text>
          {step === 'success' ? <><Text style={[styles.status, { color: Colors.success }]}>Payment verified. Consultation active.</Text><Button title="Open Consultation Chat" onPress={openChat} fullWidth /></> : step === 'failed' || step === 'cancelled' ? <><Text style={[styles.status, { color: Colors.error }]}>{message || 'Payment was cancelled. Consultation remains inactive.'}</Text><Button title="Try Again" onPress={() => setStep('summary')} fullWidth /></> : <Button title={loading ? 'Starting payment...' : 'Pay Consultation Fee'} onPress={startPayment} disabled={loading} fullWidth />}
          {loading && <ActivityIndicator color={colors.primary} style={styles.loader} />}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  title: { fontSize: FontSizes.lg, fontWeight: '700' },
  content: { padding: Spacing.lg, gap: Spacing.sm },
  label: { fontSize: FontSizes.sm, marginTop: Spacing.md },
  value: { fontSize: FontSizes.md, fontWeight: '600' },
  fee: { fontSize: FontSizes.xl, fontWeight: '700', marginBottom: Spacing.lg },
  status: { fontSize: FontSizes.sm, marginVertical: Spacing.lg },
  loader: { marginTop: Spacing.md },
  webview: { flex: 1 },
});