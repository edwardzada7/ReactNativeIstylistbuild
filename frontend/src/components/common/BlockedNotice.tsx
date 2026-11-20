import React, { useState } from 'react';
import { Alert, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSizes, Spacing } from '../../constants/theme';
import { useTheme } from '../../contexts/ThemeContext';
import { Button } from './Button';

interface Props {
  label: string; // e.g. "provider" or "seller"
  onBack: () => void;
  onUnblock: () => Promise<void>;
}

/** Shown instead of a profile or product page when the viewer has blocked its owner. */
export function BlockedNotice({ label, onBack, onUnblock }: Props) {
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false);

  const handleUnblock = async () => {
    setBusy(true);
    try {
      await onUnblock();
    } catch (error: any) {
      Alert.alert('Could not unblock', error?.friendlyMessage || error?.message || 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <TouchableOpacity
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        style={{ padding: Spacing.md }}
      >
        <Ionicons name="arrow-back" size={22} color={colors.text} />
      </TouchableOpacity>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl, gap: Spacing.md }}>
        <Ionicons name="ban-outline" size={44} color={Colors.error} />
        <Text style={{ color: colors.text, fontSize: FontSizes.lg, fontWeight: '700', textAlign: 'center' }}>
          You blocked this {label}
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: FontSizes.md, textAlign: 'center' }}>
          Their profile, products and posts are hidden. Unblock them to see their content again.
        </Text>
        <Button title={busy ? 'Unblocking...' : 'Unblock'} onPress={handleUnblock} variant="outline" disabled={busy} />
      </View>
    </SafeAreaView>
  );
}
