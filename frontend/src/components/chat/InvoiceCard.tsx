import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { FontSizes, Spacing } from '../../constants/theme';
import { useTheme } from '../../contexts/ThemeContext';
import { formatCurrency } from '../../utils/currency';

interface InvoiceCardProps {
  amount: number;
  invoice_type?: 'service' | 'product';
  invoice_id?: number;
  serviceDetails?: string;
  service?: string;
  date?: string;
  time?: string;
  location?: string;
  staff?: string;
  items?: Array<{ product_id: number; quantity: number; name?: string; price?: number; image?: string | null; stylist_auth_id?: string }>;
  platformFee?: number;
  netPayout?: number;
  status?: string;
  onPay?: () => void;
}

export function InvoiceCard({ amount, invoice_type, serviceDetails, service, date, time, location, staff, items, platformFee = amount * 0.07, netPayout = amount * 0.93, status, onPay }: InvoiceCardProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.surfaceLight }]}>
      <Text style={[styles.title, { color: colors.text }]}>{invoice_type === 'product' ? 'Product invoice' : 'Service invoice'}</Text>
      {!!service && <Text style={[styles.details, { color: colors.text }]}>{service}</Text>}
      {!!serviceDetails && <Text style={[styles.details, { color: colors.textSecondary }]}>{serviceDetails}</Text>}
      {!!date && <Text style={[styles.meta, { color: colors.textSecondary }]}>Date: {date}</Text>}
      {!!time && <Text style={[styles.meta, { color: colors.textSecondary }]}>Time: {time}</Text>}
      {!!location && <Text style={[styles.meta, { color: colors.textSecondary }]}>Location: {location}</Text>}
      {!!staff && <Text style={[styles.meta, { color: colors.textSecondary }]}>Staff: {staff}</Text>}
      {invoice_type === 'product' && items?.map((item) => <Text key={item.product_id} style={[styles.meta, { color: colors.textSecondary }]}>{item.name || `Product #${item.product_id}`} x {item.quantity}</Text>)}
      <Text style={[styles.amount, { color: colors.text }]}>{formatCurrency(amount)}</Text>
      <Text style={[styles.meta, { color: colors.textSecondary }]}>Platform fee: {formatCurrency(platformFee)}  |  Provider payout: {formatCurrency(netPayout)}</Text>
      {status && <Text style={[styles.meta, { color: colors.textSecondary }]}>Status: {status}</Text>}
      {onPay && status !== 'paid' && (
        <TouchableOpacity style={[styles.button, { backgroundColor: colors.primary }]} onPress={onPay} accessibilityRole="button" accessibilityLabel="Pay invoice">
          <Text style={styles.buttonText}>Pay Now</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.md, borderRadius: 8, minWidth: 240 },
  title: { fontSize: FontSizes.md, fontWeight: '700' },
  details: { fontSize: FontSizes.sm, marginTop: 4 },
  amount: { fontSize: FontSizes.lg, fontWeight: '700', marginTop: Spacing.sm },
  meta: { fontSize: FontSizes.xs, marginTop: 4 },
  button: { alignItems: 'center', borderRadius: 6, marginTop: Spacing.md, paddingVertical: Spacing.sm },
  buttonText: { color: '#fff', fontSize: FontSizes.sm, fontWeight: '700' },
});
