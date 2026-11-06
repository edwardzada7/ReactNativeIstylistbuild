import React from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Spacing, FontSizes } from '../../src/constants/theme';
import { useTheme } from '../../src/contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Feed from '../(tabs)/feed';

// Providers see the same community feed as customers, but with a + button
// to create posts in the header. The header owns the top safe-area inset
// (the embedded Feed skips it for providers) so nothing overlaps the status bar.
export default function ProviderFeed() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[providerStyles.header, { backgroundColor: colors.background, paddingTop: insets.top + Spacing.sm }]}>
        <View style={providerStyles.titleWrap}>
          <Text style={[providerStyles.title, { color: colors.text }]}>Feed</Text>
        </View>
        <TouchableOpacity
          testID="provider-feed-create-post"
          style={[providerStyles.addButton, { backgroundColor: colors.primary }]}
          onPress={() => router.push('/(provider)/create-post')}
          accessibilityRole="button"
          accessibilityLabel="Create post"
        >
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
      <Feed />
    </View>
  );
}

const providerStyles = {
  header: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  titleWrap: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    flex: 1,
  },
  title: {
    fontSize: FontSizes.lg,
    fontWeight: '700' as const,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
};
