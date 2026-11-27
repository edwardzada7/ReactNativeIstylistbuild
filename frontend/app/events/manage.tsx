import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { FontSizes, Spacing, BorderRadius } from '../../src/constants/theme';
import { useTheme } from '../../src/contexts/ThemeContext';
import { useAuth } from '../../src/contexts/AuthContext';
import { Button } from '../../src/components/common';
import { EventItem, PromoTier, formatEventDate, providerEvents } from '../../src/services/events.service';
import { mediaService } from '../../src/services/media.service';
import { formatCurrency } from '../../src/utils/currency';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'https://updatedistylistbeauty-marketplace-production.up.railway.app/api';
const PROMO_REDIRECT = `${API_BASE_URL.replace(/\/api\/?$/, '')}/provider/events`;

type TypeForm = { id: number | null; name: string; price: string; capacity: string };
type Form = { title: string; description: string; banner_url: string; venue: string; address: string; date: string; time: string; endTime: string; isFree: boolean; types: TypeForm[] };

const pad = (n: number) => String(n).padStart(2, '0');
const blank = (): Form => ({ title: '', description: '', banner_url: '', venue: '', address: '', date: '', time: '', endTime: '', isFree: false, types: [{ id: null, name: 'General', price: '0', capacity: '' }] });
const fromEvent = (e: EventItem): Form => {
  const d = new Date(e.starts_at);
  const end = e.ends_at ? new Date(e.ends_at) : null;
  return {
    title: e.title, description: e.description || '', banner_url: e.banner_url || '', venue: e.venue || '', address: e.address || '',
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
    endTime: end ? `${pad(end.getHours())}:${pad(end.getMinutes())}` : '',
    isFree: !!e.is_free,
    types: e.ticket_types.map((t: any) => ({ id: t.id, name: t.name, price: String(t.price), capacity: t.capacity == null ? '' : String(t.capacity) })),
  };
};
const buildIso = (date: string, time: string): string | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{1,2}:\d{2}$/.test(time)) return null;
  const d = new Date(`${date}T${time.padStart(5, '0')}:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

const STATUS: Record<string, string> = { draft: 'Draft', pending_review: 'In review', published: 'Live', rejected: 'Not approved', canceled: 'Canceled' };

export default function ManageEvents() {
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuth();
  const [events, setEvents] = useState<EventItem[] | null>(null);
  const [trusted, setTrusted] = useState(false);
  const [tiers, setTiers] = useState<PromoTier[]>([]);
  const [editing, setEditing] = useState<{ id: number | null; form: Form } | null>(null);
  const [busy, setBusy] = useState(false);
  const [attendees, setAttendees] = useState<{ event: EventItem; rows: any[] } | null>(null);
  const [scanners, setScanners] = useState<{ event: EventItem; rows: any[] } | null>(null);
  const [promoFor, setPromoFor] = useState<EventItem | null>(null);
  const [promoDays, setPromoDays] = useState<number | null>(null);
  const [promoFeed, setPromoFeed] = useState(false);
  const [payUrl, setPayUrl] = useState<string | null>(null);
  const handled = useRef(false);

  const load = useCallback(async () => {
    try {
      const r = await providerEvents.mine();
      setEvents(r.events);
      setTrusted(!!r.trusted);
      setTiers(r.promo_tiers || []);
    } catch (e: any) {
      Alert.alert('Could not load your events', e?.friendlyMessage || e?.response?.data?.detail || 'Please try again.');
      setEvents([]);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const pickBanner = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (res.canceled || !res.assets?.[0] || !user?.auth_id || !editing) return;
    try {
      const url = await mediaService.upload(res.assets[0].uri, user.auth_id, 'posts', 'image');
      setEditing({ ...editing, form: { ...editing.form, banner_url: url } });
    } catch (e: any) { Alert.alert('Upload failed', e?.message || 'Try again.'); }
  };

  const save = async (submit: boolean) => {
    if (!editing) return;
    const f = editing.form;
    if (f.title.trim().length < 2) return Alert.alert('Title needed', 'Give the event a title.');
    const starts = buildIso(f.date, f.time);
    if (!starts) return Alert.alert('Date and time', 'Use the date as 2026-12-20 and the time as 18:30.');
    let ends: string | null = null;
    if (f.endTime.trim()) {
      ends = buildIso(f.date, f.endTime.trim());
      if (!ends) return Alert.alert('End time', 'Use the time as 21:00.');
      if (new Date(ends) <= new Date(starts)) ends = new Date(new Date(ends).getTime() + 86400000).toISOString();
    }
    if (!f.types.length) return Alert.alert('Tickets', 'Add at least one ticket type.');
    const body = {
      title: f.title.trim(), description: f.description.trim() || null, banner_url: f.banner_url || null,
      venue: f.venue.trim() || null, address: f.address.trim() || null, starts_at: starts, ends_at: ends,
      status: submit ? 'published' : 'draft', fee_mode: 'add_on', is_free: f.isFree,
      ticket_types: f.types.map((t) => ({ id: t.id, name: t.name.trim() || 'Ticket', price: f.isFree ? 0 : Number(t.price) || 0, capacity: t.capacity.trim() ? Number(t.capacity) : null, max_per_order: 10, is_active: true })),
    };
    setBusy(true);
    try {
      const saved = editing.id ? await providerEvents.update(editing.id, body) : await providerEvents.create(body);
      Alert.alert(submit ? (saved.status === 'published' ? 'Your event is live' : 'Submitted for review') : 'Saved', submit && saved.status !== 'published' ? "We'll review it shortly and notify you when it's live." : undefined);
      setEditing(null);
      void load();
    } catch (e: any) {
      const d = e?.response?.data?.detail;
      Alert.alert('Could not save', e?.friendlyMessage || (typeof d === 'string' ? d : 'Please check the details and try again.'));
    } finally { setBusy(false); }
  };

  const cancel = (e: EventItem) =>
    Alert.alert('Cancel this event?', 'Every ticket buyer is notified and refunded automatically. This cannot be undone.', [
      { text: 'Keep event', style: 'cancel' },
      { text: 'Cancel event', style: 'destructive', onPress: async () => {
        try { const r = await providerEvents.cancel(e.id); Alert.alert('Event canceled', `${r.refunded || 0} refunded${r.refund_pending ? `, ${r.refund_pending} will be refunded by support` : ''}.`); void load(); }
        catch (err: any) { Alert.alert('Could not cancel', err?.friendlyMessage || 'Try again.'); }
      } },
    ]);

  const startPromo = async () => {
    if (!promoFor || !promoDays) return;
    if (!user?.email) return Alert.alert('Email needed', 'Add an email to your profile first.');
    try {
      const r = await providerEvents.promote(promoFor.id, { days: promoDays, email: user.email, redirect_url: PROMO_REDIRECT, announce_in_feed: promoFeed });
      handled.current = false;
      setPromoFor(null);
      setPayUrl(r.authorization_url);
    } catch (e: any) { Alert.alert('Could not start payment', e?.friendlyMessage || e?.response?.data?.detail || 'Try again.'); }
  };

  const onPayNav = (req: { url: string }) => {
    if (!req.url.startsWith(PROMO_REDIRECT) || handled.current) return true;
    handled.current = true;
    const q = new URLSearchParams(req.url.split('?')[1] || '');
    const ref = q.get('reference') || q.get('trxref');
    setPayUrl(null);
    if (!ref) { Alert.alert('Payment cancelled', 'No charge was made.'); return false; }
    providerEvents.verifyPromo(ref)
      .then((r) => { Alert.alert(r.status === 'success' ? 'Event promoted' : 'Payment not completed', r.status === 'success' ? 'Your event now shows the Promoted tag and appears first.' : r.message); void load(); })
      .catch(() => Alert.alert('Could not confirm', 'If you were charged, contact support.'));
    return false;
  };

  const setForm = (patch: Partial<Form>) => editing && setEditing({ ...editing, form: { ...editing.form, ...patch } });
  const input = [styles.input, { color: colors.text, borderColor: colors.border }];

  if (payUrl) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
        <View style={styles.header}><TouchableOpacity onPress={() => setPayUrl(null)}><Ionicons name="close" size={24} color={colors.text} /></TouchableOpacity><Text style={[styles.title, { color: colors.text }]}>Promote event</Text><View style={{ width: 24 }} /></View>
        <WebView source={{ uri: payUrl }} onShouldStartLoadWithRequest={onPayNav} startInLoadingState />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Go back"><Ionicons name="arrow-back" size={24} color={colors.text} /></TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>My Events</Text>
        <TouchableOpacity onPress={() => setEditing({ id: null, form: blank() })} accessibilityLabel="New event"><Ionicons name="add-circle" size={28} color={colors.primary} /></TouchableOpacity>
      </View>
      {!events ? <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} /> : (
        <ScrollView contentContainerStyle={{ padding: Spacing.lg, gap: Spacing.md }}>
          {!events.length && <Text style={{ color: colors.textSecondary, textAlign: 'center', marginTop: 40 }}>No events yet. Tap + to post a masterclass, pop-up or launch. Sell tickets or list it free.</Text>}
          {events.map((e) => {
            const ended = new Date(e.ends_at || e.starts_at) < new Date();
            return (
              <View key={e.id} style={[styles.card, { backgroundColor: colors.surface }]}>
                <View style={styles.rowBetween}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardTitle, { color: colors.text }]}>{e.title}</Text>
                    <Text style={{ color: colors.primary, fontSize: FontSizes.sm }}>{formatEventDate(e.starts_at)}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    {e.is_promoted ? <Text style={[styles.pill, { backgroundColor: '#ede9fe', color: '#5b21b6' }]}>Promoted</Text> : null}
                    <Text style={[styles.pill, e.is_free ? { backgroundColor: '#dcfce7', color: '#166534' } : { backgroundColor: '#dbeafe', color: '#1e40af' }]}>{e.is_free ? 'Free' : 'Paid'}</Text>
                    <Text style={[styles.pill, { backgroundColor: colors.background, color: colors.text }]}>{STATUS[e.status] || e.status}</Text>
                  </View>
                </View>
                {e.status === 'rejected' && e.rejection_reason ? <Text style={{ color: colors.error, fontSize: FontSizes.sm }}>Not approved: {e.rejection_reason}. Edit and submit again.</Text> : null}
                {e.status === 'pending_review' ? <Text style={{ color: colors.textSecondary, fontSize: FontSizes.sm }}>We're reviewing this event. You'll be notified when it's live.</Text> : null}
                <Text style={{ color: colors.textSecondary, fontSize: FontSizes.sm }}>
                  {e.stats?.tickets_issued ?? 0} tickets · {e.stats?.checked_in ?? 0} checked in · {formatCurrency(e.stats?.revenue ?? 0)} sales
                </Text>
                {e.status === 'published' && (e.stats?.organizer_payout_due || 0) > 0 ? (
                  <Text style={{ color: colors.textSecondary, fontSize: FontSizes.xs }}>
                    Your earnings {formatCurrency(e.stats?.organizer_payout_due || 0)} {e.payout_status === 'paid' ? '(paid)' : `· paid out after ${formatEventDate(e.payout_due_at)}`}
                  </Text>
                ) : null}
                <View style={styles.actions}>
                  {e.status !== 'canceled' && !ended ? <Text style={[styles.action, { color: colors.primary }]} onPress={() => setEditing({ id: e.id, form: fromEvent(e) })}>Edit</Text> : null}
                  {e.status === 'published' && !ended ? <Text style={[styles.action, { color: colors.primary }]} onPress={() => { setPromoDays(tiers[0]?.days ?? null); setPromoFeed(false); setPromoFor(e); }}>Promote</Text> : null}
                  <Text style={[styles.action, { color: colors.primary }]} onPress={async () => setAttendees({ event: e, rows: await providerEvents.attendees(e.id).catch(() => []) })}>Attendees</Text>
                  {e.status === 'published' ? <Text style={[styles.action, { color: colors.primary }]} onPress={async () => setScanners({ event: e, rows: await providerEvents.scanners(e.id).catch(() => []) })}>Door codes</Text> : null}
                  {['published', 'pending_review'].includes(e.status) && !ended ? <Text style={[styles.action, { color: colors.error }]} onPress={() => cancel(e)}>Cancel</Text> : null}
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      <Modal visible={!!editing} animationType="slide" onRequestClose={() => setEditing(null)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setEditing(null)}><Ionicons name="close" size={24} color={colors.text} /></TouchableOpacity>
            <Text style={[styles.title, { color: colors.text }]}>{editing?.id ? 'Edit event' : 'New event'}</Text>
            <View style={{ width: 24 }} />
          </View>
          {editing ? (
            <ScrollView contentContainerStyle={{ padding: Spacing.lg, gap: Spacing.sm }} keyboardShouldPersistTaps="handled">
              <Text style={{ color: colors.textSecondary, fontSize: FontSizes.xs }}>{trusted ? 'Your events go live right away.' : "New organisers' first events are reviewed before going live."}</Text>
              <TouchableOpacity onPress={pickBanner} style={[styles.banner, { borderColor: colors.border }]}>
                {editing.form.banner_url ? <Image source={{ uri: editing.form.banner_url }} style={{ width: '100%', height: '100%' }} /> : <Text style={{ color: colors.textSecondary }}>Add banner image</Text>}
              </TouchableOpacity>
              <TextInput style={input} placeholder="Event title" placeholderTextColor={colors.textMuted} value={editing.form.title} onChangeText={(v) => setForm({ title: v })} maxLength={160} />
              <TextInput style={[...input, { minHeight: 90, textAlignVertical: 'top' }]} multiline placeholder="Description (no phone numbers, handles or links)" placeholderTextColor={colors.textMuted} value={editing.form.description} onChangeText={(v) => setForm({ description: v })} />
              <TextInput style={input} placeholder="Date (YYYY-MM-DD)" placeholderTextColor={colors.textMuted} value={editing.form.date} onChangeText={(v) => setForm({ date: v })} keyboardType="numbers-and-punctuation" />
              <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
                <TextInput style={[...input, { flex: 1 }]} placeholder="Start (18:30)" placeholderTextColor={colors.textMuted} value={editing.form.time} onChangeText={(v) => setForm({ time: v })} keyboardType="numbers-and-punctuation" />
                <TextInput style={[...input, { flex: 1 }]} placeholder="End (optional)" placeholderTextColor={colors.textMuted} value={editing.form.endTime} onChangeText={(v) => setForm({ endTime: v })} keyboardType="numbers-and-punctuation" />
              </View>
              <TextInput style={input} placeholder="Venue" placeholderTextColor={colors.textMuted} value={editing.form.venue} onChangeText={(v) => setForm({ venue: v })} />
              <TextInput style={input} placeholder="Address" placeholderTextColor={colors.textMuted} value={editing.form.address} onChangeText={(v) => setForm({ address: v })} />
              <Text style={[styles.cardTitle, { color: colors.text, marginTop: Spacing.sm }]}>Tickets</Text>
              <View style={styles.rowBetween}>
                <Text style={{ color: colors.text, fontWeight: '600' }}>This is a free event</Text>
                <Switch value={editing.form.isFree} onValueChange={(v) => setForm({ isFree: v, types: v ? editing.form.types.map((x) => ({ ...x, price: '0' })) : editing.form.types })} />
              </View>
              <Text style={{ color: colors.textSecondary, fontSize: FontSizes.xs }}>Price 0 = free "I'm attending". Leave capacity empty for unlimited. iStylist keeps a commission on paid tickets; your earnings are paid 24 hours after the event ends.</Text>
              {editing.form.types.map((t, i) => (
                <View key={t.id ?? `n${i}`} style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                  <TextInput style={[...input, { flex: 2 }]} placeholder="Name" placeholderTextColor={colors.textMuted} value={t.name} onChangeText={(v) => setForm({ types: editing.form.types.map((x, k) => (k === i ? { ...x, name: v } : x)) })} />
                  {editing.form.isFree ? <Text style={{ flex: 1, color: '#166534', fontWeight: '700' }}>Free</Text> : <TextInput style={[...input, { flex: 1 }]} placeholder="₦" placeholderTextColor={colors.textMuted} keyboardType="numeric" value={t.price} onChangeText={(v) => setForm({ types: editing.form.types.map((x, k) => (k === i ? { ...x, price: v } : x)) })} />}
                  <TextInput style={[...input, { flex: 1 }]} placeholder="Cap." placeholderTextColor={colors.textMuted} keyboardType="numeric" value={t.capacity} onChangeText={(v) => setForm({ types: editing.form.types.map((x, k) => (k === i ? { ...x, capacity: v } : x)) })} />
                  <TouchableOpacity onPress={() => setForm({ types: editing.form.types.filter((_, k) => k !== i) })}><Ionicons name="trash-outline" size={18} color={colors.error} /></TouchableOpacity>
                </View>
              ))}
              <Text style={[styles.action, { color: colors.primary }]} onPress={() => setForm({ types: [...editing.form.types, { id: null, name: '', price: '0', capacity: '' }] })}>+ Add ticket type</Text>
              <Button title={busy ? 'Saving...' : trusted ? 'Publish' : 'Submit for review'} onPress={() => save(true)} loading={busy} fullWidth size="large" />
              <Button title="Save as draft" variant="outline" onPress={() => save(false)} disabled={busy} fullWidth />
            </ScrollView>
          ) : null}
        </SafeAreaView>
      </Modal>

      <Modal visible={!!promoFor} transparent animationType="slide" onRequestClose={() => setPromoFor(null)}>
        <View style={styles.backdrop}>
          <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Promote “{promoFor?.title}”</Text>
            <Text style={{ color: colors.textSecondary, fontSize: FontSizes.sm }}>Promoted events get a "Promoted" tag and appear first in Events.</Text>
            {tiers.map((t) => (
              <TouchableOpacity key={t.days} onPress={() => setPromoDays(t.days)} style={[styles.tier, { borderColor: promoDays === t.days ? colors.primary : colors.border }]}>
                <Text style={{ color: colors.text }}>{t.days} days</Text><Text style={{ color: colors.text, fontWeight: '700' }}>{formatCurrency(t.price)}</Text>
              </TouchableOpacity>
            ))}
            <View style={styles.rowBetween}><Text style={{ color: colors.text }}>Also announce in the feed</Text><Switch value={promoFeed} onValueChange={setPromoFeed} /></View>
            <Button title="Pay with Paystack" onPress={startPromo} disabled={!promoDays} fullWidth size="large" />
            <Text style={[styles.action, { color: colors.textSecondary, textAlign: 'center' }]} onPress={() => setPromoFor(null)}>Cancel</Text>
          </View>
        </View>
      </Modal>

      <Modal visible={!!attendees} transparent animationType="slide" onRequestClose={() => setAttendees(null)}>
        <View style={styles.backdrop}><View style={[styles.sheet, { backgroundColor: colors.surface, maxHeight: '80%' }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Attendees · {attendees?.event.title}</Text>
          <ScrollView>
            {(attendees?.rows || []).map((r) => (
              <View key={r.id} style={[styles.rowBetween, { paddingVertical: 6 }]}>
                <Text style={{ color: colors.text, flex: 1 }}>{r.name} · {r.ticket_type}</Text>
                <Text style={{ color: colors.textSecondary }}>{r.status === 'used' ? 'Checked in' : String(r.status).replace('_', ' ')}</Text>
              </View>
            ))}
            {attendees && !attendees.rows.length ? <Text style={{ color: colors.textSecondary }}>No tickets yet.</Text> : null}
          </ScrollView>
          <Button title="Close" variant="outline" onPress={() => setAttendees(null)} fullWidth />
        </View></View>
      </Modal>

      <Modal visible={!!scanners} transparent animationType="slide" onRequestClose={() => setScanners(null)}>
        <View style={styles.backdrop}><View style={[styles.sheet, { backgroundColor: colors.surface, maxHeight: '80%' }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Door codes · {scanners?.event.title}</Text>
          <Text style={{ color: colors.textSecondary, fontSize: FontSizes.xs }}>Door staff open Events → Scanner in the app (or app.istylist.online/scanner), enter a code, and can only scan this event.</Text>
          <ScrollView>
            {(scanners?.rows || []).map((s) => (
              <View key={s.id} style={[styles.rowBetween, { paddingVertical: 6 }]}>
                <Text style={{ color: colors.text, fontSize: FontSizes.lg, fontWeight: '800', letterSpacing: 3 }}>{s.access_code}</Text>
                <Text style={[styles.action, { color: colors.error }]} onPress={async () => { if (!scanners) return; await providerEvents.deleteScanner(scanners.event.id, s.id).catch(() => undefined); setScanners({ ...scanners, rows: await providerEvents.scanners(scanners.event.id).catch(() => []) }); }}>Remove</Text>
              </View>
            ))}
          </ScrollView>
          <Button title="Create new code" onPress={async () => { if (!scanners) return; await providerEvents.addScanner(scanners.event.id, null).catch(() => undefined); setScanners({ ...scanners, rows: await providerEvents.scanners(scanners.event.id).catch(() => []) }); }} fullWidth />
          <Button title="Close" variant="outline" onPress={() => setScanners(null)} fullWidth />
        </View></View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  title: { fontSize: FontSizes.lg, fontWeight: 'bold' },
  card: { borderRadius: BorderRadius.md, padding: Spacing.md, gap: 6 },
  cardTitle: { fontSize: FontSizes.md, fontWeight: '700' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  pill: { fontSize: FontSizes.xs, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, overflow: 'hidden' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, marginTop: 4 },
  action: { fontSize: FontSizes.sm, fontWeight: '700' },
  input: { borderWidth: 1, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, minHeight: 46, fontSize: FontSizes.md },
  banner: { height: 120, borderWidth: 1, borderStyle: 'dashed', borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { padding: Spacing.lg, borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl, gap: Spacing.sm },
  tier: { flexDirection: 'row', justifyContent: 'space-between', borderWidth: 2, borderRadius: BorderRadius.md, padding: Spacing.md },
});
