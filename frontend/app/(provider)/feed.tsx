import React from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Spacing, FontSizes } from '../../src/constants/theme';
import Feed from '../(tabs)/feed';

// Providers see the same community feed as customers, but with a + button
// to create posts in the header.
export default function ProviderFeed() {
  const router = useRouter();

  return (
    <>
      <View style={providerStyles.header}>
        <View style={providerStyles.titleWrap}>
          <Text style={providerStyles.title}>Feed</Text>
        </View>
        <TouchableOpacity
          style={providerStyles.addButton}
          onPress={() => router.push('/(provider)/create-post')}
          accessibilityRole="button"
          accessibilityLabel="Create post"
        >
          <Ionicons name="add" size={24} color={Colors.text} />
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
    backgroundColor: Colors.background,
  },
  titleWrap: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    flex: 1,
  },
  title: {
    fontSize: FontSizes.lg,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
};
