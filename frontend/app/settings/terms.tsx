import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, FontSizes, Spacing } from '../../src/constants/theme';

export default function Terms() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Terms of Service</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.paragraph}>
          By using iStylist, you agree to book and provide beauty and grooming services in good
          faith. Customers agree to pay for confirmed bookings; providers agree to honor accepted
          bookings and deliver the services listed on their profile.
        </Text>
        <Text style={styles.heading}>Payments & Wallet</Text>
        <Text style={styles.paragraph}>
          Payments are processed via our payment partner and held in escrow until a booking is
          marked completed, at which point funds are released to the provider&apos;s wallet, minus the
          applicable platform fee.
        </Text>
        <Text style={styles.heading}>Cancellations</Text>
        <Text style={styles.paragraph}>
          Bookings may be canceled subject to the cancellation window shown at checkout. Repeated
          no-shows or cancellations may affect your account standing.
        </Text>
        <Text style={styles.heading}>Conduct</Text>
        <Text style={styles.paragraph}>
          Abusive behavior, fraud, or misuse of the platform may result in suspension or
          termination of your account.
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
