import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { FontSizes } from '../../constants/theme';

/** 5 stars (half-star precision) + "4.5 (12 reviews)". */
export function RatingStars({ rating, count, size = 14, testID }: { rating?: number | string | null; count?: number | null; size?: number; testID?: string }) {
  const { colors } = useTheme();
  const value = Math.max(0, Math.min(5, Number(rating) || 0));
  const total = Number(count) || 0;
  return (
    <View style={styles.row} testID={testID} accessibilityLabel={`Rated ${value.toFixed(1)} out of 5 from ${total} reviews`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons
          key={i}
          name={value >= i ? 'star' : value >= i - 0.5 ? 'star-half' : 'star-outline'}
          size={size}
          color={colors.warning}
        />
      ))}
      <Text style={[styles.text, { color: colors.text, fontSize: size < 14 ? FontSizes.xs : FontSizes.sm }]} numberOfLines={1}>
        {value.toFixed(1)} <Text style={{ color: colors.textSecondary }}>({total} {total === 1 ? 'review' : 'reviews'})</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 1, flexShrink: 1 },
  text: { marginLeft: 4, fontWeight: '600', flexShrink: 1 },
});
