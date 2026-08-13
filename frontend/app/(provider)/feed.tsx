import React from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Spacing, FontSizes } from '../../src/constants/theme';
import { useTheme } from '../../src/contexts/ThemeContext';
import Feed from '../(tabs)/feed';

// Providers see the same community feed as customers, but with a + button
// to create posts in the header.
export default function ProviderFeed() {
  const router = useRouter();
  const { colors } = useTheme();

  return (
    <>
      <View style={[providerStyles.header, { backgroundColor: colors.background }]}>
        <View style={providerStyles.titleWrap}>
          <Text style={[providerStyles.title, { color: colors.text }]}>Feed</Text>
        </View>
        <TouchableOpacity
          style={[providerStyles.addButton, { backgroundColor: colors.primary }]}
          onPress={() => router.push('/(provider)/create-post')}
          accessibilityRole="button"
          accessibilityLabel="Create post"
        >
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
      <Feed />
    </>
  );
}

const providerStyles = {
  header: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
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
