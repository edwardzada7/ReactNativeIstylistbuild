import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/** Small "PRO" pill for providers with an active iStylist Pro plan. */
export function ProBadge({ pro, size = 'sm' }: { pro?: boolean | null; size?: 'sm' | 'md' }) {
  if (!pro) return null;
  const md = size === 'md';
  return (
    <View style={[styles.pill, md && styles.pillMd]} accessibilityLabel="iStylist Pro">
      <Ionicons name="ribbon" size={md ? 11 : 9} color="#fff" />
      <Text style={[styles.text, md && styles.textMd]}>PRO</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: '#F59E0B', borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2 },
  pillMd: { paddingHorizontal: 8, paddingVertical: 3 },
  text: { color: '#fff', fontSize: 9, fontWeight: '800' },
  textMd: { fontSize: 11 },
});
