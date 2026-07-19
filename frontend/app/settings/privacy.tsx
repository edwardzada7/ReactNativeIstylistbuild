import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, FontSizes, Spacing } from '../../src/constants/theme';

export default function Privacy() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Privacy Policy</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.paragraph}>
          We collect the information you provide when creating an account (name, email, phone) and
          the activity generated while using the app (bookings, wallet transactions, reviews) to
          operate the service.
        </Text>
        <Text style={styles.heading}>How we use your data</Text>
        <Text style={styles.paragraph}>
          Your data is used to match you with providers/customers, process payments, send booking
          and wallet notifications, and improve the platform. We do not sell your personal data.
        </Text>
        <Text style={styles.heading}>Data storage</Text>
        <Text style={styles.paragraph}>
          Account and authentication data is stored securely with our authentication provider.
          Booking, wallet, and review data is stored on our production servers.
        </Text>
        <Text style={styles.heading}>Your choices</Text>
        <Text style={styles.paragraph}>
          You can update your profile information at any time from Settings, or contact support to
          request account deletion.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  title: { fontSize: FontSizes.lg, fontWeight: 'bold', color: Colors.text },
  content: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl },
  heading: { fontSize: FontSizes.md, fontWeight: '700', color: Colors.text, marginTop: Spacing.lg, marginBottom: Spacing.sm },
  paragraph: { fontSize: FontSizes.sm, color: Colors.textSecondary, lineHeight: 21 },
});
