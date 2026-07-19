import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, FontSizes, Spacing, BorderRadius } from '../../src/constants/theme';
import { Button, Input } from '../../src/components/common';
import { useAuth } from '../../src/contexts/AuthContext';
import { supportService } from '../../src/services/support.service';

const CATEGORIES = ['general', 'payment', 'booking', 'technical', 'account'];

/**
 * Help & Support (Phase 2). Real contract (verified via direct API probe):
 * POST /api/support/tickets requires { name, email, category, subject,
 * message } and returns 200/201 - a genuine contact-form endpoint on the
 * production API, not invented here.
 */
export default function Help() {
  const router = useRouter();
  const { user } = useAuth();
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const handleSubmit = async () => {
    if (!subject.trim() || !message.trim()) {
      Alert.alert('Missing info', 'Please fill in the subject and message.');
      return;
    }
    setSending(true);
    try {
      await supportService.createTicket({
        name: user?.full_name || 'App User',
        email: user?.email || '',
        category,
        subject: subject.trim(),
        message: message.trim(),
      });
      Alert.alert('Sent', "We've received your message and will get back to you soon.", [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err?.friendlyMessage || 'Could not send your message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Help & Support</Text>
        <View style={{ width: 24 }} />
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.hint}>Tell us what&apos;s going on and our team will follow up by email.</Text>

          <Text style={styles.label}>Category</Text>
          <View style={styles.categoryRow}>
            {CATEGORIES.map((c) => (
              <TouchableOpacity
                key={c}
                style={[styles.categoryChip, category === c && styles.categoryChipActive]}
                onPress={() => setCategory(c)}
                accessibilityRole="button"
                accessibilityLabel={c}
              >
                <Text style={[styles.categoryChipText, category === c && styles.categoryChipTextActive]}>
                  {c.charAt(0).toUpperCase() + c.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Input label="Subject" value={subject} onChangeText={setSubject} placeholder="Brief summary of your issue" />
          <Input
            label="Message"
            value={message}
            onChangeText={setMessage}
            placeholder="Describe your issue in detail..."
            multiline
            numberOfLines={5}
            style={{ minHeight: 120, textAlignVertical: 'top' }}
          />
          <Button title="Send Message" onPress={handleSubmit} loading={sending} fullWidth size="large" />
        </ScrollView>
      </KeyboardAvoidingView>
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
  hint: { fontSize: FontSizes.sm, color: Colors.textSecondary, marginBottom: Spacing.lg },
  label: { fontSize: FontSizes.sm, fontWeight: '600', color: Colors.text, marginBottom: Spacing.sm },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.md },
  categoryChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  categoryChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  categoryChipText: { fontSize: FontSizes.sm, color: Colors.text },
  categoryChipTextActive: { fontWeight: '700' },
});
