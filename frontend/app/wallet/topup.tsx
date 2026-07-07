import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { useRouter } from 'expo-router';
import { Colors, FontSizes, Spacing, BorderRadius } from '../../src/constants/theme';
import { Button } from '../../src/components/common';
import { useAuth } from '../../src/contexts/AuthContext';
import { walletService } from '../../src/services/wallet.service';
import { formatCurrency } from '../../src/utils/currency';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:8001/api';
// Same-origin redirect target (mirrors web's `${window.location.origin}/wallet`)
// - not an invented external domain, just the app's own known backend origin.
const REDIRECT_URL = `${API_BASE_URL.replace(/\/api\/?$/, '')}/wallet`;
const QUICK_AMOUNTS = [1000, 2000, 5000, 10000, 20000];

type Step = 'amount' | 'checkout' | 'success' | 'failed' | 'cancelled';

/**
 * Wallet Top-Up. GROUND TRUTH (Phase 6.4 - verified against production web
 * app source, frontend/src/screens/WalletScreen.jsx handleTopUp +
 * frontend/src/services/api.js paymentsAPI): this is a real hosted
 * Flutterwave checkout flow, not a client-side inline widget:
 *   1) POST /payments/flutterwave/initialize -> { authorization_url }
 *   2) Customer pays on Flutterwave's OWN hosted page (loaded here in a
 *      WebView since mobile has no browser redirect equivalent - this is
 *      the only UI-layer adaptation, the business logic is identical)
 *   3) Flutterwave redirects back to redirect_url with
 *      ?status=&tx_ref=&transaction_id= (or legacy ?reference=&trxref=)
 *   4) GET /payments/flutterwave/verify?reference=&transaction_id= is the
 *      ONLY call that actually confirms + credits the wallet.
 * Previously this called a direct /wallets/{id}/topup endpoint that never
 * verified anything with Flutterwave - a real successful payment could
 * still show "Payment Failed" with no wallet credit.
 */
export default function WalletTopUp() {
  const router = useRouter();
  const { user } = useAuth();

  const [step, setStep] = useState<Step>('amount');
  const [amount, setAmount] = useState('');
  const [checking, setChecking] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const handledRef = useRef(false);

  const numericAmount = Number(amount);
  const isValidAmount = Number.isFinite(numericAmount) && numericAmount >= 100;

  const handleContinue = async () => {
    if (!isValidAmount) {
      Alert.alert('Invalid amount', 'Please enter an amount of at least ₦100.');
      return;
    }
    if (!user?.email) {
      Alert.alert('Payment unavailable', 'User email not found. Please complete your profile.');
      return;
    }
    setChecking(true);
    setError(null);
    try {
      const response = await walletService.initializePayment({
        amount: numericAmount,
        email: user.email,
        purpose: 'wallet_topup',
        name: user.full_name,
        phone: user.phone || undefined,
        redirect_url: REDIRECT_URL,
      });
      if (response?.status && response.authorization_url) {
        handledRef.current = false;
        setCheckoutUrl(response.authorization_url);
        setStep('checkout');
      } else {
        setError(response?.message || 'Failed to initialize payment');
      }
    } catch (err: any) {
      setError(err?.friendlyMessage || 'Could not start checkout. Please try again.');
    } finally {
      setChecking(false);
    }
  };

  // Intercepts the WebView navigating back to REDIRECT_URL after payment -
  // this is the mobile equivalent of web reading its own URL query params
  // on mount. Returning false stops the WebView from actually loading that
  // URL (there's nothing useful to render there anyway).
  const handleShouldStartLoad = useCallback(
    (request: { url: string }) => {
      const url = request.url;
      if (!url.startsWith(REDIRECT_URL)) return true;
      if (handledRef.current) return false;
      handledRef.current = true;

      const query = url.split('?')[1] || '';
      const params = new URLSearchParams(query);
      const reference = params.get('reference') || params.get('trxref') || params.get('tx_ref');
      const transactionId = params.get('transaction_id');
      const flwStatus = params.get('status');

      if (!reference && !transactionId) {
        setStep('cancelled');
        return false;
      }
      if (flwStatus && flwStatus !== 'successful' && flwStatus !== 'completed') {
        setError(`Payment ${flwStatus}. No funds were deducted.`);
        setStep('failed');
        return false;
      }

      setVerifying(true);
      walletService
        .verifyPayment(reference || '', transactionId)
        .then((res) => {
          if (res?.status === 'success') {
            setStep('success');
          } else {
            setError(`Payment ${res?.status}: ${res?.message || ''}`.trim());
            setStep('failed');
          }
        })
        .catch(() => {
          setError('Failed to verify payment. Please contact support if funds were deducted.');
          setStep('failed');
        })
        .finally(() => setVerifying(false));

      return false;
    },
    []
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => (step === 'checkout' ? setStep('amount') : router.back())}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Top Up Wallet</Text>
      </View>

      {step === 'amount' && (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.content}
        >
          <Text style={styles.label}>Enter Amount</Text>
          <View style={styles.amountInputWrap}>
            <Text style={styles.currencySymbol}>₦</Text>
            <TextInput
              style={styles.amountInput}
              placeholder="0"
              placeholderTextColor={Colors.textMuted}
              keyboardType="numeric"
              value={amount}
              onChangeText={(v) => setAmount(v.replace(/[^0-9]/g, ''))}
            />
          </View>

          <View style={styles.quickRow}>
            {QUICK_AMOUNTS.map((qa) => (
              <TouchableOpacity
                key={qa}
                style={styles.quickChip}
                onPress={() => setAmount(String(qa))}
                accessibilityRole="button"
                accessibilityLabel={`₦${qa}`}
              >
                <Text style={styles.quickChipText}>{formatCurrency(qa)}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.paymentMethods}>
            <Text style={styles.paymentMethodsTitle}>Supported payment methods</Text>
            <View style={styles.methodsRow}>
              {['Card', 'Bank Transfer', 'USSD', 'Mobile Money'].map((m) => (
                <View key={m} style={styles.methodChip}>
                  <Text style={styles.methodChipText}>{m}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={{ flex: 1 }} />
          <Button
            title="Continue to Payment"
            onPress={handleContinue}
            loading={checking}
            disabled={!isValidAmount}
            fullWidth
            size="large"
          />
        </KeyboardAvoidingView>
      )}

      {step === 'checkout' && checkoutUrl && (
        <View style={{ flex: 1 }}>
          <WebView
            source={{ uri: checkoutUrl }}
            onShouldStartLoadWithRequest={handleShouldStartLoad}
            startInLoadingState
            renderLoading={() => (
              <View style={styles.centerState}>
                <ActivityIndicator size="large" color={Colors.primary} />
              </View>
            )}
          />
          {verifying && (
            <View style={styles.creditingOverlay}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.creditingText}>Confirming payment...</Text>
            </View>
          )}
        </View>
      )}

      {step === 'success' && (
        <View style={styles.centerState}>
          <View style={styles.resultIcon}>
            <Ionicons name="checkmark" size={48} color={Colors.text} />
          </View>
          <Text style={styles.resultTitle}>Top-Up Successful!</Text>
          <Text style={styles.resultSubtitle}>
            {formatCurrency(numericAmount)} has been added to your wallet.
          </Text>
          <Button title="Back to Wallet" onPress={() => router.replace('/(tabs)/wallet')} fullWidth size="large" />
        </View>
      )}

      {step === 'failed' && (
        <View style={styles.centerState}>
          <View style={[styles.resultIcon, { backgroundColor: Colors.error }]}>
            <Ionicons name="close" size={48} color={Colors.text} />
          </View>
          <Text style={styles.resultTitle}>Payment Failed</Text>
          <Text style={styles.resultSubtitle}>
            {error || 'Your payment could not be completed. No funds were deducted.'}
          </Text>
          <Button title="Try Again" onPress={() => setStep('amount')} fullWidth size="large" />
        </View>
      )}

      {step === 'cancelled' && (
        <View style={styles.centerState}>
          <View style={[styles.resultIcon, { backgroundColor: Colors.warning }]}>
            <Ionicons name="alert" size={48} color={Colors.text} />
          </View>
          <Text style={styles.resultTitle}>Payment Cancelled</Text>
          <Text style={styles.resultSubtitle}>You closed the checkout before completing payment.</Text>
          <Button title="Try Again" onPress={() => setStep('amount')} fullWidth size="large" />
        </View>
      )}
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
  content: { flex: 1, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg },
  label: { fontSize: FontSizes.sm, color: Colors.textSecondary, marginBottom: Spacing.sm },
  amountInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.lg,
  },
  currencySymbol: { fontSize: 28, fontWeight: '700', color: Colors.text, marginRight: Spacing.sm },
  amountInput: { flex: 1, fontSize: 28, fontWeight: '700', color: Colors.text },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.lg },
  quickChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.full,
  },
  quickChipText: { fontSize: FontSizes.xs, fontWeight: '600', color: Colors.text },
  errorText: { fontSize: FontSizes.sm, color: Colors.error, marginBottom: Spacing.md },
  paymentMethods: { marginTop: Spacing.md },
  paymentMethodsTitle: { fontSize: FontSizes.xs, color: Colors.textMuted, marginBottom: Spacing.sm },
  methodsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  methodChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  methodChipText: { fontSize: FontSizes.xs, color: Colors.textSecondary },
  centerState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  creditingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
  },
  creditingText: { fontSize: FontSizes.sm, color: Colors.text },
  resultIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.success,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  resultTitle: { fontSize: FontSizes.xl, fontWeight: 'bold', color: Colors.text, marginBottom: Spacing.sm },
  resultSubtitle: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
});
