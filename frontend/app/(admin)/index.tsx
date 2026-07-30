import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, FontSizes, Spacing, BorderRadius } from '../../src/constants/theme';

const adminSections = [
  {
    title: 'Feed Moderation',
    description: 'Review provider posts before they appear in customer and provider feeds.',
    route: '/(admin)/feed-moderation',
    icon: 'images-outline' as const,
  },
  {
    title: 'Shop Moderation',
    description: 'Approve or reject marketplace products before they appear in the shop.',
    route: '/(admin)/shop-moderation',
    icon: 'bag-handle-outline' as const,
  },
];

export default function AdminDashboard() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Admin Dashboard</Text>
          <Text style={styles.subtitle}>Manage moderation for the marketplace and community feed.</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {adminSections.map((item) => (
          <TouchableOpacity
            key={item.title}
            style={styles.card}
            onPress={() => router.push(item.route as any)}
            accessibilityRole="button"
            accessibilityLabel={item.title}
          >
            <View style={styles.cardIcon}>
              <Ionicons name={item.icon} size={24} color={Colors.primary} />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardDescription}>{item.description}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.lg },
  title: { fontSize: FontSizes.xl, fontWeight: '700', color: Colors.text },
  subtitle: { fontSize: FontSizes.sm, color: Colors.textSecondary, marginTop: 4 },
  content: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: `${Colors.primary}14`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: FontSizes.md, fontWeight: '700', color: Colors.text },
  cardDescription: { fontSize: FontSizes.sm, color: Colors.textSecondary, marginTop: 4 },
});
