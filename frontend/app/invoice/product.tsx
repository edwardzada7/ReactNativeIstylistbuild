import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BorderRadius, Colors, FontSizes, Spacing } from '../../src/constants/theme';
import { useAuth } from '../../src/contexts/AuthContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { shopService, Product } from '../../src/services/shop.service';
import { chatService } from '../../src/services/chat.service';
import { formatCurrency } from '../../src/utils/currency';

export default function ProductInvoice() {
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuth();
  const { conversationId, customerAuthId } = useLocalSearchParams<{ conversationId: string; customerAuthId: string }>();
  const [products, setProducts] = useState<Product[]>([]);
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user?.auth_id) return;
    shopService.getProviderProducts(user.auth_id).then((items) => setProducts(items.filter((item) => item.stock > 0))).catch(() => Alert.alert('Could not load products', 'Please try again.')).finally(() => setLoading(false));
  }, [user?.auth_id]);

  const selected = products.filter((item) => (quantities[item.id] || 0) > 0);
  const total = selected.reduce((sum, item) => sum + item.price * quantities[item.id], 0);
  const submit = async () => {
    if (!user?.auth_id || !conversationId || !customerAuthId || !selected.length) { Alert.alert('Choose products', 'Select at least one product and quantity.'); return; }
    setSaving(true);
    try {
      const invoice = await chatService.createInvoice({
        conversation_id: Number(conversationId), customer_auth_id: customerAuthId, provider_auth_id: user.auth_id,
        invoice_type: 'product', amount: total, note: note.trim() || undefined,
        items: selected.map((item) => ({ product_id: item.id, quantity: quantities[item.id] })),
      });
      await chatService.sendInvoiceMessage(Number(conversationId), customerAuthId, {
        invoice_id: invoice.id, invoice_type: 'product', amount: total, status: 'pending', note: note.trim() || undefined,
        items: selected.map((item) => ({ product_id: item.id, quantity: quantities[item.id], name: item.name, price: item.price, image: item.image_urls?.[0] || null, stylist_auth_id: item.stylist_auth_id })),
      });
      router.back();
    } catch (error: any) { Alert.alert('Invoice failed', error?.friendlyMessage || error?.message || 'Could not create invoice.'); }
    finally { setSaving(false); }
  };

  if (loading) return <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}><ActivityIndicator style={styles.loader} color={colors.primary} /></SafeAreaView>;
  return <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
    <View style={styles.header}><TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color={colors.text} /></TouchableOpacity><Text style={[styles.title, { color: colors.text }]}>Product Invoice</Text><View style={{ width: 24 }} /></View>
    <ScrollView contentContainerStyle={styles.content}>{products.map((item) => <View key={item.id} style={[styles.row, { backgroundColor: colors.surface }]}><View style={{ flex: 1 }}><Text style={{ color: colors.text, fontWeight: '700' }}>{item.name}</Text><Text style={{ color: colors.textSecondary }}>{formatCurrency(item.price)} · {item.stock} available</Text></View><TouchableOpacity onPress={() => setQuantities((current) => ({ ...current, [item.id]: Math.max(0, (current[item.id] || 0) - 1) }))}><Ionicons name="remove-circle-outline" size={24} color={colors.textSecondary} /></TouchableOpacity><Text style={[styles.quantity, { color: colors.text }]}>{quantities[item.id] || 0}</Text><TouchableOpacity onPress={() => setQuantities((current) => ({ ...current, [item.id]: Math.min(item.stock, (current[item.id] || 0) + 1) }))}><Ionicons name="add-circle-outline" size={24} color={colors.primary} /></TouchableOpacity></View>)}
      <TextInput placeholder="Note (optional)" placeholderTextColor={colors.textSecondary} value={note} onChangeText={setNote} style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]} multiline />
      <Text style={[styles.total, { color: colors.text }]}>Total: {formatCurrency(total)}</Text><TouchableOpacity style={[styles.button, { backgroundColor: colors.primary }]} onPress={submit} disabled={saving}><Text style={styles.buttonText}>{saving ? 'Creating...' : 'Create Product Invoice'}</Text></TouchableOpacity>
    </ScrollView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({ container: { flex: 1 }, loader: { flex: 1 }, header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.lg }, title: { fontSize: FontSizes.lg, fontWeight: '700' }, content: { padding: Spacing.lg, gap: Spacing.sm }, row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, borderRadius: BorderRadius.md }, quantity: { minWidth: 24, textAlign: 'center', fontWeight: '700' }, input: { borderWidth: 1, borderRadius: BorderRadius.md, padding: Spacing.md, minHeight: 70, textAlignVertical: 'top' }, total: { fontSize: FontSizes.lg, fontWeight: '700', textAlign: 'right', marginTop: Spacing.md }, button: { padding: Spacing.md, borderRadius: BorderRadius.md, alignItems: 'center', marginTop: Spacing.md }, buttonText: { color: '#fff', fontWeight: '700' } });
