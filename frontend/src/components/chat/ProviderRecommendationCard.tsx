import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { FontSizes, Spacing } from '../../constants/theme';
import { useTheme } from '../../contexts/ThemeContext';

interface ProviderRecommendationCardProps {
  providerName?: string;
  providerImage?: string | null;
  providerBio?: string | null;
  providerCategory?: string | null;
  onViewProfile: () => void;
}

export function ProviderRecommendationCard({ providerName, providerImage, providerBio, providerCategory, onViewProfile }: ProviderRecommendationCardProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.surfaceLight }]}>
      <View style={styles.header}>
        {providerImage ? <Image source={{ uri: providerImage }} style={styles.avatar} /> : <View style={[styles.avatar, { backgroundColor: colors.surface }]} />}
        <View style={styles.identity}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{providerName || 'Recommended provider'}</Text>
          {!!providerCategory && <Text style={[styles.meta, { color: colors.textSecondary }]} numberOfLines={1}>{providerCategory}</Text>}
        </View>
      </View>
      {!!providerBio && <Text style={[styles.bio, { color: colors.textSecondary }]} numberOfLines={3}>{providerBio}</Text>}
      <TouchableOpacity style={[styles.button, { borderColor: colors.primary }]} onPress={onViewProfile} accessibilityRole="button" accessibilityLabel="View recommended provider profile">
        <Text style={[styles.buttonText, { color: colors.primary }]}>View Profile</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.md, borderRadius: 8, minWidth: 240 },
  header: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  identity: { flex: 1, marginLeft: Spacing.sm },
  name: { fontSize: FontSizes.md, fontWeight: '700' },
  meta: { fontSize: FontSizes.xs, marginTop: 3 },
  bio: { fontSize: FontSizes.sm, marginTop: Spacing.sm },
  button: { alignItems: 'center', borderWidth: 1, borderRadius: 6, marginTop: Spacing.md, paddingVertical: Spacing.sm },
  buttonText: { fontSize: FontSizes.sm, fontWeight: '700' },
});
