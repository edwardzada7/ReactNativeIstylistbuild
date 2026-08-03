import React, { useCallback, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { useRouter } from 'expo-router';
import { Colors, FontSizes, Spacing, BorderRadius } from '../../src/constants/theme';
import { Button } from '../../src/components/common';
import { useAuth } from '../../src/contexts/AuthContext';
import { shopService } from '../../src/services/shop.service';
import { useCartStore } from '../../src/store/cartStore';
import { formatCurrency } from '../../src/utils/currency';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:8001/api';
const REDIRECT_URL = `${API_BASE_URL.replace(/\/api\/?$/, '')}/shop/cart`;
type CheckoutStep = 'cart' | 'checkout' | 'success' | 'failed' | 'cancelled';

export default function Cart() {
  const router = useRouter();
  const { user } = useAuth();
  const { lines, setQuantity, removeItem, clear, total } = useCartStore();
  const [checkingOut, setCheckingOut] = useState(false);
  const [step, setStep] = useState<CheckoutStep>('cart');
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [pendingItems, setPendingItems] = useState<Array<{ product_id: number; quantity: number }>>([]);
  const [pendingAmount, setPendingAmount] = useState<number | null>(null);
  const handledRef = useRef(false);

  const handleCheckout = async () => {
    if (lines.length === 0) {
      Alert.alert('Cart Empty', 'Add items before checking out.');
      return;
    }
    if (!user?.email) {
      setError('Please complete your profile before paying.');
      setStep('failed');
      return;
    }

    const items = lines.map((l) => ({ product_id: l.productId, quantity: l.quantity }));
    const amount = total();

    setCheckingOut(true);
    setError(null);
    try {
      const response = await shopService.initializePaystackCheckout({
        amount,
        email: user.email,
        name: user.full_name,
        phone: user.phone || undefined,
        redirect_url: REDIRECT_URL,
        currency: 'NGN',
      });

      if (response?.status && response.authorization_url) {
        handledRef.current = false;
        setPendingItems(items);
        setPendingAmount(amount);
        setCheckoutUrl(response.authorization_url);
        setStep('checkout');
      } else {
        setError(response?.message || 'Could not start checkout. Please try again.');
        setStep('failed');
      }
    } catch (err: any) {
      setError(err?.friendlyMessage || err?.response?.data?.detail || err?.message || 'Could not start checkout. Please try again.');
      setStep('failed');
    } finally {
      setCheckingOut(false);
    }
  };

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
      const paystackStatus = params.get('status');

      if (!reference && !transactionId) {
        setError('Payment was cancelled. No charge was made.');
        setStep('cancelled');
        return false;
      }
      if (paystackStatus && paystackStatus.toLowerCase() !== 'success') {
        setError(`Payment ${paystackStatus}. No funds were deducted.`);
        setStep('failed');
        return false;
      }

      setVerifying(true);
      shopService
        .verifyPaystackCheckout({
          reference: reference || '',
          transaction_id: transactionId,
          items: pendingItems,
          amount: pendingAmount ?? total(),
          email: user?.email || undefined,
          name: user?.full_name || undefined,
          phone: user?.phone || undefined,
          currency: 'NGN',
          provider_auth_id: lines.find((line) => line.stylistAuthId)?.stylistAuthId,
        })
        .then((res) => {
          if (res?.status === 'success') {
            clear();
            setStep('success');
          } else {
            setError(res?.message || 'Payment could not be verified. Please try again.');
            setStep('failed');
          }
        })
        .catch((err: any) => {
          setError(err?.friendlyMessage || err?.response?.data?.detail || err?.message || 'Could not verify payment. Please contact support if funds were deducted.');
          setStep('failed');
        })
        .finally(() => setVerifying(false));

      return false;
    },
    [clear, pendingAmount, pendingItems, total, user?.email, user?.full_name, user?.phone]
  );

  if (step === 'checkout' && checkoutUrl) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setStep('cart')} accessibilityRole="button" accessibilityLabel="Go back">
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Complete Payment</Text>
          <View style={{ width: 24 }} />
        </View>
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
          {verifying ? (
            <View style={styles.overlay}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.overlayText}>Confirming payment...</Text>
            </View>
          ) : null}
        </View>
      </SafeAreaView>
    );
  }

  if (step === 'success') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <View style={{ width: 24 }} />
          <Text style={styles.title}>Order Placed</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.centerState}>
          <View style={styles.resultIcon}>
            <Ionicons name="checkmark" size={42} color={Colors.text} />
          </View>
          <Text style={styles.resultTitle}>Payment Successful</Text>
          <Text style={styles.resultSubtitle}>Your shop order has been placed and your cart is clear.</Text>
          <Button title="View Orders" onPress={() => router.replace('/shop/orders')} fullWidth size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (step === 'failed' || step === 'cancelled') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setStep('cart')} accessibilityRole="button" accessibilityLabel="Go back">
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>{step === 'cancelled' ? 'Payment Cancelled' : 'Payment Failed'}</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.centerState}>
          <View style={[styles.resultIcon, { backgroundColor: step === 'cancelled' ? Colors.warning : Colors.error }]}>
            <Ionicons name={step === 'cancelled' ? 'alert' : 'close'} size={42} color={Colors.text} />
          </View>
          <Text style={styles.resultTitle}>{step === 'cancelled' ? 'Payment Cancelled' : 'Payment Failed'}</Text>
          <Text style={styles.resultSubtitle}>{error || 'Your payment could not be completed. Your cart is still intact.'}</Text>
          <Button title="Try Again" onPress={() => setStep('cart')} fullWidth size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>My Cart</Text>
        <TouchableOpacity onPress={() => router.push('/shop/orders')} accessibilityRole="button" accessibilityLabel="Order history">
          <Ionicons name="receipt-outline" size={22} color={Colors.text} />
        </TouchableOpacity>
      </View>

      {lines.length === 0 ? (
        <View style={styles.centerState}>
          <Ionicons name="cart-outline" size={32} color={Colors.textMuted} />
          <Text style={styles.emptyText}>Your cart is empty.</Text>
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {lines.map((line) => (
              <View key={line.productId} style={styles.line}>
                {line.image ? (
                  <Image source={{ uri: line.image }} style={styles.lineImage} />
                ) : (
                  <View style={[styles.lineImage, styles.lineImagePlaceholder]}>
                    <Ionicons name="image-outline" size={20} color={Colors.textMuted} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.lineName} numberOfLines={1}>{line.name}</Text>
                  <Text style={styles.linePrice}>{formatCurrency(line.price)}</Text>
                </View>
                <View style={styles.qtyRow}>
                  <TouchableOpacity style={styles.qtyBtn} onPress={() => setQuantity(line.productId, line.quantity - 1)} accessibilityLabel="Decrease quantity">
                    <Ionicons name="remove" size={16} color={Colors.text} />
                  </TouchableOpacity>
                  <Text style={styles.qtyText}>{line.quantity}</Text>
                  <TouchableOpacity style={styles.qtyBtn} onPress={() => setQuantity(line.productId, line.quantity + 1)} accessibilityLabel="Increase quantity">
                    <Ionicons name="add" size={16} color={Colors.text} />
                  </TouchableOpacity>
                </View>
                <TouchableOpacity onPress={() => removeItem(line.productId)} accessibilityLabel="Remove item">
                  <Ionicons name="trash-outline" size={18} color={Colors.error} />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
          <View style={styles.footer}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>{formatCurrency(total())}</Text>
            </View>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <Button title={checkingOut ? 'Preparing Checkout...' : 'Checkout'} onPress={handleCheckout} loading={checkingOut} fullWidth size="large" />
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  title: { fontSize: FontSizes.lg, fontWeight: 'bold', color: Colors.text },
  centerState: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.sm },
  emptyText: { fontSize: FontSizes.sm, color: Colors.textSecondary },
  content: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl },
  line: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.surface, borderRadius: BorderRadius.md, padding: Spacing.sm, marginBottom: Spacing.sm },
  lineImage: { width: 48, height: 48, borderRadius: BorderRadius.sm },
  lineImagePlaceholder: { backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' },
  lineName: { fontSize: FontSizes.sm, fontWeight: '600', color: Colors.text },
  linePrice: { fontSize: FontSizes.xs, color: Colors.primary, fontWeight: '700', marginTop: 2 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  qtyBtn: { width: 26, height: 26, borderRadius: 13, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' },
  qtyText: { fontSize: FontSizes.sm, fontWeight: '600', color: Colors.text, minWidth: 18, textAlign: 'center' },
  footer: { padding: Spacing.lg, borderTopWidth: 1, borderTopColor: Colors.border },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.md },
  totalLabel: { fontSize: FontSizes.md, color: Colors.textSecondary },
  totalValue: { fontSize: FontSizes.lg, fontWeight: '800', color: Colors.text },
  errorText: { fontSize: FontSizes.sm, color: Colors.error, marginBottom: Spacing.sm, textAlign: 'center' },
  centerState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: Spacing.xl },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', gap: Spacing.md },
  overlayText: { fontSize: FontSizes.sm, color: Colors.text },
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
  resultSubtitle: { fontSize: FontSizes.sm, color: Colors.textSecondary, textAlign: 'center', marginBottom: Spacing.xl },
});
