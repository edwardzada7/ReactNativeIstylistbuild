import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { BorderRadius, FontSizes, Spacing } from '../../constants/theme';
import { useTheme } from '../../contexts/ThemeContext';
import { MyTicket } from '../../services/events.service';

const STATUS: Record<string, { label: string; bg: string; fg: string }> = {
  valid: { label: 'Valid', bg: '#DCFCE7', fg: '#166534' },
  used: { label: 'Used', bg: '#E5E7EB', fg: '#374151' },
  refund_due: { label: 'Refund due', bg: '#FEF3C7', fg: '#92400E' },
  canceled: { label: 'Canceled', bg: '#FEE2E2', fg: '#B91C1C' },
};

export function TicketCard({ t }: { t: MyTicket }) {
  const { colors } = useTheme();
  const st = STATUS[t.status] || STATUS.valid;
  const usable = t.status === 'valid';
  return (
    <View style={[styles.ticket, { backgroundColor: colors.surface, borderColor: colors.border }]} testID={`ticket-${t.id}`}>
      <View style={styles.ticketHead}>
        <Text style={[styles.type, { color: colors.text }]}>{t.ticket_type || 'Ticket'}</Text>
        <Text style={[styles.badge, { backgroundColor: st.bg, color: st.fg }]}>{st.label}</Text>
      </View>
      <View style={styles.qrWrap}>
        {usable && t.qr_svg ? (
          <View style={styles.qrBox}><SvgXml xml={t.qr_svg} width={220} height={220} /></View>
        ) : (
          <View style={[styles.qrBox, styles.qrEmpty]}>
            <Text style={{ color: '#6B7280', textAlign: 'center' }}>
              {t.status === 'used' ? `Used${t.used_at ? `\n${new Date(t.used_at).toLocaleString()}` : ''}` : usable ? 'QR unavailable.\nUse the PIN below.' : "This ticket can't be used"}
            </Text>
          </View>
        )}
        {usable && (
          <>
            <Text style={[styles.pinLabel, { color: colors.textSecondary }]}>Or show this PIN at the door</Text>
            <Text style={[styles.pin, { color: colors.text }]} testID="ticket-pin">{t.pin}</Text>
          </>
        )}
        <Text style={[styles.note, { color: colors.textSecondary }]}>One person per ticket. It works once, so don't share the QR code or PIN.</Text>
      </View>
    </View>
  );
}


const styles = StyleSheet.create({
  ticket: { borderWidth: 1, borderRadius: BorderRadius.lg, overflow: 'hidden' },
  ticketHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.md },
  type: { fontSize: FontSizes.md, fontWeight: '700' },
  badge: { fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, overflow: 'hidden' },
  qrWrap: { alignItems: 'center', gap: 6, paddingHorizontal: Spacing.md, paddingBottom: Spacing.md },
  qrBox: { width: 236, height: 236, backgroundColor: '#fff', borderRadius: 12, padding: 8, alignItems: 'center', justifyContent: 'center' },
  qrEmpty: { backgroundColor: '#F3F4F6' },
  pinLabel: { fontSize: FontSizes.xs },
  pin: { fontSize: 32, fontWeight: '800', letterSpacing: 8 },
  note: { fontSize: FontSizes.xs, textAlign: 'center' },
});
