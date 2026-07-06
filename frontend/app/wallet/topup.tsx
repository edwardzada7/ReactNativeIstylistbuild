import React, { useCallback, useMemo, useState } from 'react';
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

const FLW_PUBLIC_KEY = process.env.EXPO_PUBLIC_FLW_PUBLIC_KEY || '';
const QUICK_AMOUNTS = [1000, 2000, 5000, 10000, 20000];

type Step = 'amount' | 'checkout' | 'success' | 'failed' | 'cancelled';

/**
 * Flutterwave top-up, implemented as an Inline Checkout loaded inside a
 * react-native-webview (works in Expo Go - no native build required, unlike
 * the flutterwave-react-native SDK which needs native Android/iOS config).
 * Uses ONLY the existing public key (client-side initiation). After a
 * successful payment, calls the real, confirmed `POST /wallets/{id}/topup`
 * endpoint to credit the wallet - Flutterwave's own server-side webhook
 * (/api/webhooks/flutterwave, signature-protected) is the backend's
 * authoritative source of truth; this call is the client-facing complement
 * so the balance updates immediately in the app.
 */
function buildCheckoutHtml(options: Record<string, any>): string {
  const optionsJson = JSON.stringify(options);
  return [
    '<!DOCTYPE html><html><head>',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
    '<script src="https://checkout.flutterwave.com/v3.js"></script>',
    '</head><body style="margin:0;background:#0B0B0F;">',
    '<script>',
    'function post(msg){ if (window.ReactNativeWebView) { window.ReactNativeWebView.postMessage(JSON.stringify(msg)); } }',
    'try {',
    'var opts = ' + optionsJson + ';',
    'opts.callback = function (data) { post({ event: "callback", data: data }); };',
    'opts.onclose = function (incomplete) { post({ event: "close", incomplete: incomplete }); };',
    'FlutterwaveCheckout(opts);',
    '} catch (e) { post({ event: "error", message: String(e) }); }',
    '</script>',
    '</body></html>',
  ].join('\n');
}

export default function WalletTopUp() {
  const router = useRouter();
  const { user } = useAuth();

  const [step, setStep] = useState<Step>('amount');
  const [amount, setAmount] = useState('');
  const [walletId, setWalletId] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [crediting, setCrediting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const numericAmount = Number(amount);
  const isValidAmount = Number.isFinite(numericAmount) && numericAmount >= 100;

  const txRef = useMemo(
    () => `WALLET-${(user?.auth_id || 'guest').slice(0, 8)}-${Date.now()}`,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [step === 'checkout']
  );

  const handleContinue = async () => {
    if (!isValidAmount) {
      Alert.alert('Invalid amount', 'Please enter an amount of at least ₦100.');
      return;
    }
    if (!FLW_PUBLIC_KEY) {
      Alert.alert('Payment unavailable', 'Payment configuration is missing. Please contact support.');
      return;
    }
    if (!user?.auth_id) return;
    setChecking(true);
    setError(null);
    try {
      const wallet = await walletService.getWallet(user.auth_id);
      if (!wallet) {
        setError('No wallet found for your account yet. Please contact support.');
        return;
      }
      setWalletId(wallet.id);
      setStep('checkout');
    } catch (err: any) {
      setError(err?.friendlyMessage || 'Could not start checkout. Please try again.');
    } finally {
      setChecking(false);
    }
  };

  const handleMessage = useCallback(
    async (event: any) => {
      let payload: any;
      try {
        payload = JSON.parse(event.nativeEvent.data);
      } catch {
        return;
      }

      if (payload.event === 'close') {
        if (payload.incomplete) setStep('cancelled');
        return;
      }
      if (payload.event === 'error') {
        setError(payload.message || 'Checkout failed to load.');
        setStep('failed');
        return;
      }
      if (payload.event === 'callback') {
        const data = payload.data || {};
        if (data.status === 'successful' || data.status === 'completed') {
          if (!walletId) {
            setStep('failed');
            setError('Payment succeeded but wallet could not be credited (missing wallet id).');
            return;
          }
          setCrediting(true);
          try {
            await walletService.topUp(walletId, numericAmount);
            setStep('success');
          } catch (err: any) {
            setStep('failed');
            setError(
              err?.friendlyMessage ||
                'Payment was received by Flutterwave, but we could not update your wallet balance. It will sync automatically shortly.'
            );
          } finally {
            setCrediting(false);
          }
        } else {
          setStep('failed');
        }
      }
    },
    [walletId, numericAmount]
  );

  const checkoutHtml = useMemo(() => {
    if (step !== 'checkout') return '';
    return buildCheckoutHtml({
      public_key: FLW_PUBLIC_KEY,
      tx_ref: txRef,
      amount: numericAmount,
      currency: 'NGN',
      payment_options: 'card,banktransfer,ussd,mobilemoney',
      customer: {
        email: user?.email || 'customer@istylist.app',
        name: user?.full_name || 'iStylist Customer',
        phone_number: user?.phone || '',
      },
      customizations: {
        title: 'iStylist Wallet Top-Up',
        description: `Add ${formatCurrency(numericAmount)} to your wallet`,
      },
    });
  }, [step, txRef, numericAmount, user]);

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

      {step === 'checkout' && (
        <View style={{ flex: 1 }}>
          <WebView
            source={{ html: checkoutHtml }}
            onMessage={handleMessage}
            startInLoadingState
            renderLoading={() => (
              <View style={styles.centerState}>
                <ActivityIndicator size="large" color={Colors.primary} />
              </View>
            )}
          />
          {crediting && (
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
