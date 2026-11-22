import React from 'react';
import { Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import { FontSizes, Spacing } from '../../constants/theme';

/** Opens Help & Support with the booking pre-filled so the team knows which booking it is about. */
export function BookingSupportButton({ booking, compact, style }: { booking?: { id?: string | number; service_name?: string } | null; compact?: boolean; style?: ViewStyle }) {
  const router = useRouter();
  const { colors } = useTheme();
  const open = () =>
    router.push({
      pathname: '/settings/help',
      params: booking?.id
        ? { category: 'booking', subject: `Booking ${String(booking.id).slice(0, 8)}${booking.service_name && booking.service_name !== 'Service' ? ` - ${booking.service_name}` : ''}` }
        : { category: 'booking' },
    });
  return (
    <TouchableOpacity
      onPress={open}
      style={[styles.button, { borderColor: colors.primary }, compact && styles.compact, style]}
      accessibilityRole="button"
      accessibilityLabel="Contact support"
    >
      <Ionicons name="headset-outline" size={compact ? 16 : 18} color={colors.primary} />
      <Text style={[styles.text, { color: colors.primary }]}>{compact ? 'Support' : 'Contact admin / support'}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderRadius: 22, paddingHorizontal: Spacing.md, paddingVertical: 8, marginTop: Spacing.sm, alignSelf: 'flex-start' },
  compact: { marginTop: 0, paddingVertical: 6 },
  text: { fontSize: FontSizes.sm, fontWeight: '700' },
});
