import React from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FontSizes, Spacing } from '../../constants/theme';
import { useTheme } from '../../contexts/ThemeContext';

interface LocationCardProps {
  latitude?: number;
  longitude?: number;
  addressName?: string | null;
  mapUrl?: string;
}

export function LocationCard({ latitude, longitude, addressName, mapUrl }: LocationCardProps) {
  const { colors } = useTheme();
  const openMap = () => {
    const url = mapUrl || `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
    Linking.openURL(url);
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.surfaceLight }]}>
      <Ionicons name="location" size={24} color={colors.primary} />
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>Shared location</Text>
        <Text style={[styles.address, { color: colors.textSecondary }]}>{addressName || 'Shared Location'}</Text>
        <TouchableOpacity onPress={openMap} accessibilityRole="button" accessibilityLabel="Open in Google Maps">
          <Text style={[styles.link, { color: colors.primary }]}>Open in Google Maps</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', gap: Spacing.sm, padding: Spacing.md, borderRadius: 8, minWidth: 220 },
  content: { flex: 1 },
  title: { fontSize: FontSizes.sm, fontWeight: '700' },
  address: { fontSize: FontSizes.xs, marginTop: 4 },
  link: { fontSize: FontSizes.xs, fontWeight: '700', marginTop: Spacing.sm },
});
