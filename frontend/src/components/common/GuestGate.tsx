import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, FontSizes, Spacing, BorderRadius } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';

type GateCopy = { title: string; message: string; icon: keyof typeof Ionicons.glyphMap };

export function GuestPrompt({ title, message, icon }: GateCopy) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  return (
    <View testID="guest-prompt" style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {router.canGoBack() && (
        <TouchableOpacity style={[styles.back, { top: insets.top + Spacing.sm }]} onPress={() => router.back()} testID="guest-prompt-back-button" accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
      )}
      <View style={[styles.iconWrap, { backgroundColor: `${Colors.primary}18` }]}>
        <Ionicons name={icon} size={40} color={Colors.primary} />
      </View>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text>
      <TouchableOpacity testID="guest-prompt-signin-button" style={[styles.primary, { backgroundColor: Colors.primary }]} onPress={() => router.push('/(auth)/login')} accessibilityRole="button">
        <Text style={styles.primaryText}>Sign In</Text>
      </TouchableOpacity>
      <TouchableOpacity testID="guest-prompt-signup-button" style={styles.secondary} onPress={() => router.push('/(auth)/signup')} accessibilityRole="button">
        <Text style={[styles.secondaryText, { color: Colors.primary }]}>Create an account</Text>
      </TouchableOpacity>
    </View>
  );
}

/** Renders a sign-in prompt for guests instead of an account-only screen. */
export function withAuthGate<P extends object>(Screen: React.ComponentType<P>, copy: GateCopy) {
  return function AuthGated(props: P) {
    const { isAuthenticated } = useAuth();
    if (!isAuthenticated) return <GuestPrompt {...copy} />;
    return <Screen {...props} />;
  };
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xl },
  back: { position: 'absolute', left: Spacing.lg, padding: Spacing.xs },
  iconWrap: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.lg },
  title: { fontSize: FontSizes.xl, fontWeight: '700', textAlign: 'center', marginBottom: Spacing.sm },
  message: { fontSize: FontSizes.sm, textAlign: 'center', lineHeight: 20, marginBottom: Spacing.xl },
  primary: { alignSelf: 'stretch', height: 52, borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#fff', fontSize: FontSizes.md, fontWeight: '700' },
  secondary: { marginTop: Spacing.md, padding: Spacing.sm },
  secondaryText: { fontSize: FontSizes.sm, fontWeight: '600' },
});
