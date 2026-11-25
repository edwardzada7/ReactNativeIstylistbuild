import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Modal, ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { BorderRadius, Colors, FontSizes, Spacing } from '../../src/constants/theme';
import { VerifiedBadge } from '../../src/components/common';
import { useTheme } from '../../src/contexts/ThemeContext';
import { useAuth } from '../../src/contexts/AuthContext';
import { EventItem, EventQuote, eventsService, formatEventDate, guestOrders } from '../../src/services/events.service';
import { formatCurrency } from '../../src/utils/currency';

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  'https://updatedistylistbeauty-marketplace-production.up.railway.app/api';
// Paystack sends the buyer here after paying; the WebView catches it before it loads and we verify on the server.
const REDIRECT_URL = `${API_BASE_URL.replace(/\/api\/?$/, '')}/events/purchase-complete`;
const GUEST_REDIRECT_URL = `${API_BASE_URL.replace(/\/api\/?$/, '')}/events/guest-tickets`;

export default function EventDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { user, isAuthenticated } = useAuth();
  const [event, setEvent] = useState<EventItem | null>(null);
  const [missing, setMissing] = useState(false);
  const [typeId, setTypeId] = useState<number | null>(null);
  const [qty, setQty] = useState(1);
  const [quote, setQuote] = useState<EventQuote | null>(null);
  const [busy, setBusy] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const handledRef = useRef(false);
  const [guestOpen, setGuestOpen] = useState(false);
  const [guest, setGuest] = useState({ name: '', email: '', phone: '' });

  const load = useCallback(async () => {
    try {
      const data = await eventsService.get(String(id));
      setEvent(data);
      setTypeId((cur) => cur ?? data.ticket_types.find((t) => t.on_sale)?.id ?? null);
    } catch {
      setMissing(true);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const selected = event?.ticket_types.find((t) => t.id === typeId) || null;

  useEffect(() => {
    if (!event || !selected || event.status !== 'published') {
      setQuote(null);
      return;
    }
    let cancelled = false;
    eventsService.quote(event.id, selected.id, qty).then((q) => !cancelled && setQuote(q)).catch(() => !cancelled && setQuote(null));
    return () => {
      cancelled = true;
    };
  }, [event, selected, qty]);

  const maxQty = selected ? Math.min(selected.max_per_order, selected.remaining ?? selected.max_per_order) : 1;
  const free = !!selected && selected.price === 0;

  const share = () => {
    if (!event) return;
    Share.share({ message: `${event.title}\n${formatEventDate(event.starts_at)}\nhttps://app.istylist.online/events/${event.id}` }).catch(() => {});
  };

  const buy = async () => {
    if (!event || !selected) return;
    if (!isAuthenticated) {
      setGuestOpen(true);
      return;
    }
    const email = (user as any)?.email;
    if (!email) {
      Alert.alert('Email needed', 'We need an email on your account to take payment.');
      return;
    }
    setBusy(true);
    try {
      const res = await eventsService.checkout(event.id, { ticket_type_id: selected.id, quantity: qty, email, redirect_url: REDIRECT_URL });
      if (res.status === 'free') {
        Alert.alert("You're in!", `${res.ticket_count} ticket${res.ticket_count === 1 ? '' : 's'} added to My Tickets.`, [
          { text: 'View tickets', onPress: () => router.replace('/events/tickets' as any) },
        ]);
      } else if (res.authorization_url) {
        handledRef.current = false;
        setCheckoutUrl(res.authorization_url);
      }
    } catch (e: any) {
      Alert.alert('Could not start checkout', e?.friendlyMessage || e?.response?.data?.detail || e?.message || 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const guestBuy = async () => {
    if (!event || !selected) return;
    if (guest.name.trim().length < 2) return Alert.alert('Your name', 'Please enter your name.');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(guest.email.trim())) return Alert.alert('Email needed', 'Enter a valid email address. Your tickets are sent there.');
    setBusy(true);
    try {
      const res = await eventsService.guestCheckout(event.id, {
        ticket_type_id: selected.id,
        quantity: qty,
        name: guest.name.trim(),
        email: guest.email.trim(),
        phone: guest.phone.trim() || null,
        redirect_url: GUEST_REDIRECT_URL,
      });
      setGuestOpen(false);
      if (res.status === 'free') {
        if (res.emailed) {
          Alert.alert('Check your email', `We sent your ticket(s) to ${res.email}. Open the link in that email to see your QR code and PIN.`);
        } else if (res.access_token) {
          await guestOrders.save({ reference: res.reference, token: res.access_token, title: event.title });
          router.replace(`/events/guest-tickets?reference=${res.reference}&t=${res.access_token}` as any);
        }
      } else if (res.authorization_url) {
        handledRef.current = false;
        setCheckoutUrl(res.authorization_url);
      }
    } catch (e: any) {
      Alert.alert('Could not start checkout', e?.friendlyMessage || e?.response?.data?.detail || e?.message || 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const onRedirect = (request: { url: string }) => {
    if (request.url.startsWith(GUEST_REDIRECT_URL) && !handledRef.current) {
      handledRef.current = true;
      const q = new URLSearchParams(request.url.split('?')[1] || '');
      const ref = q.get('reference') || q.get('trxref');
      const tok = q.get('t');
      setCheckoutUrl(null);
      if (ref && tok) router.replace(`/events/guest-tickets?reference=${ref}&t=${tok}` as any);
      else Alert.alert('Payment cancelled', 'No funds were charged.');
      return false;
    }
    if (!request.url.startsWith(REDIRECT_URL) || handledRef.current) return true;
    handledRef.current = true;
    const params = new URLSearchParams(request.url.split('?')[1] || '');
    const reference = params.get('reference') || params.get('trxref');
    setCheckoutUrl(null);
    if (!reference) {
      Alert.alert('Payment cancelled', 'No funds were charged.');
      return false;
    }
    eventsService
      .verify(reference)
      .then((r) => {
        if (r.status === 'success') {
          Alert.alert("You're going!", 'Your tickets are ready, each with its own QR code and PIN.', [
            { text: 'View tickets', onPress: () => router.replace('/events/tickets' as any) },
          ]);
        } else {
          Alert.alert('Payment not completed', r.message || 'If you were charged, contact support.');
        }
      })
      .catch((e: any) =>
        Alert.alert('Could not verify payment', e?.friendlyMessage || e?.response?.data?.detail || `If you were charged, contact support with reference ${reference}.`),
      );
    return false;
  };

  if (missing) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.text }}>This event isn't available.</Text>
        <TouchableOpacity onPress={() => router.replace('/events' as any)}><Text style={{ color: Colors.primary, marginTop: 12, fontWeight: '700' }}>Back to events</Text></TouchableOpacity>
      </SafeAreaView>
    );
  }
  if (!event) {
    return <SafeAreaView style={[styles.center, { backgroundColor: colors.background }]}><ActivityIndicator color={Colors.primary} /></SafeAreaView>;
  }

  const canceled = event.status === 'canceled';
  const cta = !selected ? 'Sold out' : free ? "I'm attending" : `Buy ${qty > 1 ? `${qty} tickets` : 'ticket'}${quote ? ` · ${formatCurrency(quote.total)}` : ''}`;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/events' as any))} accessibilityLabel="Go back" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Event details</Text>
        <TouchableOpacity onPress={share} accessibilityLabel="Share event" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="share-outline" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        {event.banner_url ? <Image source={{ uri: event.banner_url }} style={styles.banner} /> : <View style={[styles.banner, { backgroundColor: Colors.primary }]} />}
        <View style={styles.body}>
          <View style={styles.orgRow}>
            {event.is_official && <><Text style={[styles.org, { color: colors.textSecondary }]}>{event.organizer_name}</Text><VerifiedBadge verified size={15} /></>}
            {canceled && <Text style={styles.canceled}>Canceled</Text>}
            {(event.my_ticket_count || 0) > 0 && <Text style={styles.have}>You have {event.my_ticket_count} ticket{event.my_ticket_count === 1 ? '' : 's'}</Text>}
          </View>
          <Text style={[styles.title, { color: colors.text }]}>{event.title}</Text>
          <View style={styles.line}><Ionicons name="calendar-outline" size={18} color={Colors.primary} /><Text style={[styles.lineText, { color: colors.text }]}>{formatEventDate(event.starts_at)}{event.ends_at ? ` – ${formatEventDate(event.ends_at)}` : ''}</Text></View>
          {(event.venue || event.address) ? (
            <View style={styles.line}><Ionicons name="location-outline" size={18} color={Colors.primary} /><Text style={[styles.lineText, { color: colors.text }]}>{[event.venue, event.address].filter(Boolean).join(', ')}</Text></View>
          ) : null}
          {event.description ? <Text style={[styles.desc, { color: colors.textSecondary }]}>{event.description}</Text> : null}

          {!canceled && (
            <View style={[styles.tickets, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Tickets</Text>
              {event.ticket_types.filter((t) => t.is_active).map((t) => (
                <TouchableOpacity
                  key={t.id}
                  disabled={!t.on_sale}
                  onPress={() => { setTypeId(t.id); setQty(1); }}
                  style={[styles.type, { borderColor: typeId === t.id ? Colors.primary : colors.border, opacity: t.on_sale ? 1 : 0.5 }]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.typeName, { color: colors.text }]}>{t.name}</Text>
                    {t.description ? <Text style={[styles.typeDesc, { color: colors.textSecondary }]}>{t.description}</Text> : null}
                    <Text style={[styles.typeDesc, { color: colors.textSecondary }]}>{t.sold_out ? 'Sold out' : !t.on_sale ? 'Sales closed' : t.remaining !== null && t.remaining <= 10 ? `Only ${t.remaining} left` : ''}</Text>
                  </View>
                  <Text style={[styles.typePrice, { color: colors.text }]}>{t.price === 0 ? 'Free' : formatCurrency(t.price)}</Text>
                </TouchableOpacity>
              ))}
              {selected?.on_sale && (
                <View style={{ gap: Spacing.sm }}>
                  <View style={styles.qtyRow}>
                    <Text style={[styles.typeName, { color: colors.text }]}>Quantity</Text>
                    <View style={styles.qtyCtl}>
                      <TouchableOpacity style={[styles.qtyBtn, { borderColor: colors.border }]} onPress={() => setQty((q) => Math.max(1, q - 1))} accessibilityLabel="Fewer tickets"><Ionicons name="remove" size={18} color={colors.text} /></TouchableOpacity>
                      <Text style={[styles.qtyNum, { color: colors.text }]}>{qty}</Text>
                      <TouchableOpacity style={[styles.qtyBtn, { borderColor: colors.border }]} onPress={() => setQty((q) => Math.min(maxQty, q + 1))} accessibilityLabel="More tickets"><Ionicons name="add" size={18} color={colors.text} /></TouchableOpacity>
                    </View>
                  </View>
                  {quote && !free && (
                    <View style={[styles.quote, { borderTopColor: colors.border }]}>
                      <View style={styles.qRow}><Text style={{ color: colors.text }}>{qty} × {formatCurrency(quote.unit_price)}</Text><Text style={{ color: colors.text }}>{formatCurrency(quote.subtotal)}</Text></View>
                      {quote.service_fee > 0 && <View style={styles.qRow}><Text style={{ color: colors.textSecondary }}>Service fee</Text><Text style={{ color: colors.textSecondary }}>{formatCurrency(quote.service_fee)}</Text></View>}
                      <View style={styles.qRow}><Text style={[styles.total, { color: colors.text }]}>Total</Text><Text style={[styles.total, { color: colors.text }]}>{formatCurrency(quote.total)}</Text></View>
                    </View>
                  )}
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>
      {!canceled && (
        <View style={[styles.footer, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
          <TouchableOpacity style={[styles.cta, { backgroundColor: Colors.primary, opacity: busy || !selected?.on_sale ? 0.6 : 1 }]} disabled={busy || !selected?.on_sale} onPress={buy} testID="event-buy-btn">
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>{cta}</Text>}
          </TouchableOpacity>
        </View>
      )}

      <Modal visible={guestOpen} animationType="slide" transparent onRequestClose={() => setGuestOpen(false)}>
        <KeyboardAvoidingView behavior="padding" style={styles.sheetBackdrop}>
          <View style={[styles.sheet, { backgroundColor: colors.background }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{free ? 'Get your free ticket' : 'Get your tickets'}</Text>
            <Text style={{ color: colors.textSecondary }}>No account needed. We'll email your tickets (QR code + PIN) to you.</Text>
            {(['name', 'email', 'phone'] as const).map((field) => (
              <TextInput
                key={field}
                value={guest[field]}
                onChangeText={(v) => setGuest((g) => ({ ...g, [field]: v }))}
                placeholder={field === 'name' ? 'Full name' : field === 'email' ? 'Email (tickets are sent here)' : 'Phone (optional)'}
                placeholderTextColor={colors.textMuted}
                keyboardType={field === 'email' ? 'email-address' : field === 'phone' ? 'phone-pad' : 'default'}
                autoCapitalize={field === 'name' ? 'words' : 'none'}
                autoCorrect={false}
                style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
              />
            ))}
            {quote && !free ? <Text style={{ color: colors.text }}>Total to pay: <Text style={{ fontWeight: '800' }}>{formatCurrency(quote.total)}</Text> via Paystack</Text> : null}
            <TouchableOpacity style={[styles.cta, { backgroundColor: Colors.primary, opacity: busy ? 0.6 : 1 }]} disabled={busy} onPress={guestBuy}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>{free ? 'Get my ticket' : 'Continue to payment'}</Text>}
            </TouchableOpacity>
            <View style={styles.authRow}>
              <Text style={{ color: colors.textSecondary }}>Want more? </Text>
              <TouchableOpacity onPress={() => { setGuestOpen(false); router.push('/(auth)/signup'); }}><Text style={styles.link}>Sign up</Text></TouchableOpacity>
              <Text style={{ color: colors.textSecondary }}> or </Text>
              <TouchableOpacity onPress={() => { setGuestOpen(false); router.push('/(auth)/login'); }}><Text style={styles.link}>sign in</Text></TouchableOpacity>
            </View>
            <TouchableOpacity onPress={() => setGuestOpen(false)} style={{ alignSelf: 'center', padding: 8 }}><Text style={{ color: colors.textSecondary }}>Cancel</Text></TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={!!checkoutUrl} animationType="slide" onRequestClose={() => setCheckoutUrl(null)}>
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => setCheckoutUrl(null)} accessibilityLabel="Close checkout"><Ionicons name="close" size={24} color={colors.text} /></TouchableOpacity>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Pay for tickets</Text>
            <View style={{ width: 24 }} />
          </View>
          {checkoutUrl ? <WebView source={{ uri: checkoutUrl }} onShouldStartLoadWithRequest={onRedirect} /> : null}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  headerTitle: { fontSize: FontSizes.lg, fontWeight: '700' },
  banner: { width: '100%', height: 200 },
  body: { padding: Spacing.md, gap: Spacing.sm },
  orgRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  org: { fontSize: FontSizes.sm },
  canceled: { backgroundColor: '#FEE2E2', color: '#B91C1C', fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, overflow: 'hidden' },
  have: { backgroundColor: '#DCFCE7', color: '#166534', fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, overflow: 'hidden' },
  title: { fontSize: FontSizes.xl, fontWeight: '800' },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  lineText: { flex: 1, fontSize: FontSizes.md },
  desc: { fontSize: FontSizes.md, lineHeight: 22, marginTop: 4 },
  tickets: { borderWidth: 1, borderRadius: BorderRadius.lg, padding: Spacing.md, gap: Spacing.sm, marginTop: Spacing.sm },
  sectionTitle: { fontSize: FontSizes.lg, fontWeight: '700' },
  type: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderRadius: BorderRadius.md, padding: Spacing.sm },
  typeName: { fontSize: FontSizes.md, fontWeight: '600' },
  typeDesc: { fontSize: FontSizes.xs },
  typePrice: { fontSize: FontSizes.md, fontWeight: '800' },
  qtyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  qtyCtl: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  qtyBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  qtyNum: { fontSize: FontSizes.lg, fontWeight: '700', minWidth: 20, textAlign: 'center' },
  quote: { borderTopWidth: 1, paddingTop: Spacing.sm, gap: 4 },
  qRow: { flexDirection: 'row', justifyContent: 'space-between' },
  total: { fontSize: FontSizes.md, fontWeight: '800' },
  sheetBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: Spacing.lg, gap: Spacing.sm },
  input: { borderWidth: 1, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, height: 48, fontSize: FontSizes.md },
  authRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 4 },
  link: { color: Colors.primary, fontWeight: '700' },
  footer: { padding: Spacing.md, borderTopWidth: 1 },
  cta: { height: 50, borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: '#fff', fontSize: FontSizes.md, fontWeight: '800' },
});
