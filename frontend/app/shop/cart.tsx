import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert, ActivityIndicator, Modal, TextInput } from 'react-native';
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
import { useTheme } from '../../src/contexts/ThemeContext';

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  'https://updatedistylistbeauty-marketplace-production.up.railway.app/api';
const REDIRECT_URL = `${API_BASE_URL.replace(/\/api\/?$/, '')}/shop/cart`;
type CheckoutStep = 'cart' | 'checkout' | 'success' | 'failed' | 'cancelled';
type DeliveryAddress = { street: string; city: string; state: string; phone: string };

export default function Cart() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  const { lines, setQuantity, removeItem, clear, total } = useCartStore();
  const hasOwnProduct = Boolean(user && lines.some((line) => line.stylistAuthId === user.auth_id));
  const [checkingOut, setCheckingOut] = useState(false);
  const [step, setStep] = useState<CheckoutStep>('cart');
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [shippingAddress, setShippingAddress] = useState('');
  const [isAddressModalVisible, setAddressModalVisible] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState<DeliveryAddress>({ street: '', city: '', state: '', phone: '' });
  const [addressForm, setAddressForm] = useState<DeliveryAddress>(deliveryAddress);
  const [pendingItems, setPendingItems] = useState<Array<{ product_id: number; quantity: number }>>([]);
  const [pendingAmount, setPendingAmount] = useState<number | null>(null);
  const handledRef = useRef(false);

  useEffect(() => {
    const profile = user as (typeof user & { address_id?: string | number }) | null;
    if (profile?.address_id && !selectedAddressId) setSelectedAddressId(String(profile.address_id));
    if (!shippingAddress) {
      const profileAddress = [profile?.address, profile?.location_address, profile?.location]
        .find((value) => typeof value === 'string' && value.trim().length > 0);
      if (profileAddress) setShippingAddress(profileAddress);
    }
  }, [selectedAddressId, shippingAddress, user]);

  const handlePaystackPayment = async (address: DeliveryAddress = deliveryAddress) => {
    if (lines.length === 0) {
      Alert.alert('Cart Empty', 'Add items before checking out.');
      return;
    }
    if (!user?.email) {
      setError('Please complete your profile before paying.');
      setStep('failed');
      return;
    }

    const items = lines
      .map((l) => ({ product_id: Number(l.productId), quantity: Number(l.quantity) }))
      .filter((item) => Number.isFinite(item.product_id) && item.product_id > 0 && Number.isFinite(item.quantity) && item.quantity > 0);
    const amount = Number(total()) || 0;
    const paymentMethod = 'paystack';
    const addressId = selectedAddressId || String((user as any).address_id || '').trim();
    const legacyDeliveryAddress = [shippingAddress, user.address, user.location_address, user.location]
      .find((value) => typeof value === 'string' && value.trim().length > 0) || 'Delivery address not provided';

    if (!items.length) {
      Alert.alert('Cart Empty', 'Your cart items are invalid. Please review them before checking out.');
      return;
    }
    if (!amount || amount <= 0) {
      Alert.alert('Cart Empty', 'Your cart total must be greater than zero before checkout.');
      return;
    }
    if (!addressId && !address.street.trim() && legacyDeliveryAddress === 'Delivery address not provided') {
      Alert.alert('Delivery address required', 'Please select or provide a delivery address before checking out.');
      return;
    }

    setCheckingOut(true);
    setError(null);
    try {
      const shippingAddressText = `${address.street}, ${address.city}, ${address.state}`.trim();
      const order = await shopService.createOrder({
        customer_auth_id: user.auth_id,
        items,
        shipping_address: shippingAddressText || legacyDeliveryAddress,
        note: address.phone ? `Phone: ${address.phone}` : undefined,
      });
      const orderId = order?.id ?? order?.order_id;
      if (!orderId) {
        throw new Error('Shop order was not returned by the server.');
      }

      const response = await shopService.initializePaystackCheckout({
        amount,
        email: user.email,
        order_id: orderId,
        callback_url: REDIRECT_URL,
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

  const handleCheckout = () => {
    if (!deliveryAddress.street.trim()) {
      setAddressForm(deliveryAddress);
      setAddressModalVisible(true);
      return;
    }
    void handlePaystackPayment();
  };

  const handleProceedToPayment = () => {
    const address = {
      street: addressForm.street.trim(),
      city: addressForm.city.trim(),
      state: addressForm.state.trim(),
      phone: addressForm.phone.trim(),
    };
    if (!address.street || !address.city || !address.state || !address.phone) {
      Alert.alert('Address required', 'Please complete every delivery address field.');
      return;
    }
    setDeliveryAddress(address);
    setAddressModalVisible(false);
    void handlePaystackPayment(address);
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
    [clear, deliveryAddress, pendingAmount, pendingItems, total, user?.email, user?.full_name, user?.name, user?.phone, lines]
  );

  if (step === 'checkout' && checkoutUrl) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setStep('cart')} accessibilityRole="button" accessibilityLabel="Go back">
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>Complete Payment</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={{ flex: 1 }}>
          <WebView
            source={{ uri: checkoutUrl }}
            onShouldStartLoadWithRequest={handleShouldStartLoad}
            startInLoadingState
            renderLoading={() => (
              <View style={styles.centerState}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            )}
          />
          {verifying ? (
            <View style={styles.overlay}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.overlayText, { color: colors.text }]}>Confirming payment...</Text>
            </View>
          ) : null}
        </View>
      </SafeAreaView>
    );
  }

  if (step === 'success') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.header}>
          <View style={{ width: 24 }} />
          <Text style={[styles.title, { color: colors.text }]}>Order Placed</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.centerState}>
          <View style={[styles.resultIcon, { backgroundColor: colors.success }]}>
            <Ionicons name="checkmark" size={42} color={colors.text} />
          </View>
          <Text style={[styles.resultTitle, { color: colors.text }]}>Payment Successful</Text>
          <Text style={[styles.resultSubtitle, { color: colors.textSecondary }]}>Your shop order has been placed and your cart is clear.</Text>
          <Button title="View Orders" onPress={() => router.replace('/shop/orders')} fullWidth size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (step === 'failed' || step === 'cancelled') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setStep('cart')} accessibilityRole="button" accessibilityLabel="Go back">
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>{step === 'cancelled' ? 'Payment Cancelled' : 'Payment Failed'}</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.centerState}>
          <View style={[styles.resultIcon, { backgroundColor: step === 'cancelled' ? colors.warning : colors.error }]}>
            <Ionicons name={step === 'cancelled' ? 'alert' : 'close'} size={42} color={colors.text} />
          </View>
          <Text style={[styles.resultTitle, { color: colors.text }]}>{step === 'cancelled' ? 'Payment Cancelled' : 'Payment Failed'}</Text>
          <Text style={[styles.resultSubtitle, { color: colors.textSecondary }]}>{error || 'Your payment could not be completed. Your cart is still intact.'}</Text>
          <Button title="Try Again" onPress={() => setStep('cart')} fullWidth size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>My Cart</Text>
        <TouchableOpacity onPress={() => router.push('/shop/orders')} accessibilityRole="button" accessibilityLabel="Order history">
          <Ionicons name="receipt-outline" size={22} color={colors.text} />
        </TouchableOpacity>
      </View>

      {lines.length === 0 ? (
        <View style={styles.centerState}>
          <Ionicons name="cart-outline" size={32} color={colors.textMuted} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Your cart is empty.</Text>
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {lines.map((line) => (
              <View key={line.productId} style={[styles.line, { backgroundColor: colors.surface }]}>
                {line.image ? (
                  <Image source={{ uri: line.image }} style={styles.lineImage} />
                ) : (
                  <View style={[styles.lineImage, styles.lineImagePlaceholder, { backgroundColor: colors.background }]}>
                    <Ionicons name="image-outline" size={20} color={colors.textMuted} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.lineName, { color: colors.text }]} numberOfLines={1}>{line.name}</Text>
                  <Text style={[styles.linePrice, { color: colors.primary }]}>{formatCurrency(line.price)}</Text>
                </View>
                <View style={styles.qtyRow}>
                  <TouchableOpacity style={[styles.qtyBtn, { backgroundColor: colors.background }]} onPress={() => setQuantity(line.productId, line.quantity - 1)} accessibilityLabel="Decrease quantity">
                    <Ionicons name="remove" size={16} color={colors.text} />
                  </TouchableOpacity>
                  <Text style={[styles.qtyText, { color: colors.text }]}>{line.quantity}</Text>
                  <TouchableOpacity style={[styles.qtyBtn, { backgroundColor: colors.background }]} onPress={() => setQuantity(line.productId, line.quantity + 1)} accessibilityLabel="Increase quantity">
                    <Ionicons name="add" size={16} color={colors.text} />
                  </TouchableOpacity>
                </View>
                <TouchableOpacity onPress={() => removeItem(line.productId)} accessibilityLabel="Remove item">
                  <Ionicons name="trash-outline" size={18} color={colors.error} />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <View style={styles.totalRow}>
              <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>Total</Text>
              <Text style={[styles.totalValue, { color: colors.text }]}>{formatCurrency(total())}</Text>
            </View>
            {hasOwnProduct ? (
              <Text style={[styles.errorText, { color: colors.error }]}>Providers cannot book their own services or purchase their own products.</Text>
            ) : null}
            {error ? <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text> : null}
            <Button title={hasOwnProduct ? 'Unavailable' : checkingOut ? 'Preparing Checkout...' : 'Checkout'} onPress={handleCheckout} disabled={hasOwnProduct} loading={checkingOut} fullWidth size="large" />
          </View>
        </>
      )}
      <Modal
        visible={isAddressModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAddressModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Delivery Address</Text>
            {([
              ['street', 'Street Address'],
              ['city', 'City'],
              ['state', 'State'],
              ['phone', 'Phone Number'],
            ] as const).map(([field, placeholder]) => (
              <TextInput
                key={field}
                style={[styles.addressInput, { color: colors.text, borderColor: colors.border }]}
                placeholder={placeholder}
                placeholderTextColor={colors.textMuted}
                value={addressForm[field]}
                onChangeText={(value) => setAddressForm((current) => ({ ...current, [field]: value }))}
                keyboardType={field === 'phone' ? 'phone-pad' : 'default'}
                autoCapitalize={field === 'phone' ? 'none' : 'words'}
              />
            ))}
            <Button title="Proceed to Payment" onPress={handleProceedToPayment} fullWidth size="large" />
            <TouchableOpacity style={styles.cancelAddressButton} onPress={() => setAddressModalVisible(false)}>
              <Text style={[styles.cancelAddressText, { color: colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  title: { fontSize: FontSizes.lg, fontWeight: 'bold' },
  centerState: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.xl },
  emptyText: { fontSize: FontSizes.sm },
  content: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl },
  line: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, borderRadius: BorderRadius.md, padding: Spacing.sm, marginBottom: Spacing.sm },
  lineImage: { width: 48, height: 48, borderRadius: BorderRadius.sm },
  lineImagePlaceholder: { justifyContent: 'center', alignItems: 'center' },
  lineName: { fontSize: FontSizes.sm, fontWeight: '600' },
  linePrice: { fontSize: FontSizes.xs, fontWeight: '700', marginTop: 2 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  qtyBtn: { width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
  qtyText: { fontSize: FontSizes.sm, fontWeight: '600', minWidth: 18, textAlign: 'center' },
  footer: { padding: Spacing.lg, borderTopWidth: 1 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.md },
  totalLabel: { fontSize: FontSizes.md },
  totalValue: { fontSize: FontSizes.lg, fontWeight: '800' },
  errorText: { fontSize: FontSizes.sm, marginBottom: Spacing.sm, textAlign: 'center' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', gap: Spacing.md },
  overlayText: { fontSize: FontSizes.sm },
  resultIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  resultTitle: { fontSize: FontSizes.xl, fontWeight: 'bold', marginBottom: Spacing.sm },
  resultSubtitle: { fontSize: FontSizes.sm, textAlign: 'center', marginBottom: Spacing.xl },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  modalCard: { padding: Spacing.lg, borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl, gap: Spacing.sm },
  modalTitle: { fontSize: FontSizes.lg, fontWeight: '700', marginBottom: Spacing.sm },
  addressInput: { minHeight: 48, borderWidth: 1, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, fontSize: FontSizes.md },
  cancelAddressButton: { alignItems: 'center', paddingVertical: Spacing.sm },
  cancelAddressText: { fontSize: FontSizes.md, fontWeight: '600' },
});
