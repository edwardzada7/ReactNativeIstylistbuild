import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSizes, Spacing, BorderRadius } from '../../constants/theme';

interface ErrorBannerProps {
  message?: string | null;
  /** Extra container styles, e.g. per-screen margins or background tint. */
  style?: StyleProp<ViewStyle>;
  iconSize?: number;
}

/**
 * Inline "something went wrong" banner shown at the top of a screen's content.
 * Renders nothing when `message` is empty, so callers can pass their error
 * state directly instead of guarding with a conditional each time.
 */
export const ErrorBanner: React.FC<ErrorBannerProps> = ({ message, style, iconSize = 18 }) => {
  if (!message) return null;
  return (
    <View style={[styles.banner, style]}>
      <Ionicons name="alert-circle-outline" size={iconSize} color={Colors.error} />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  text: { flex: 1, fontSize: FontSizes.sm, color: Colors.error },
});
