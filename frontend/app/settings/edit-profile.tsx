import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, FontSizes, Spacing, BorderRadius } from '../../src/constants/theme';
import { Button, Input } from '../../src/components/common';
import { useAuth } from '../../src/contexts/AuthContext';
import apiService from '../../src/services/api';

const GENDERS = ['male', 'female', 'other'];

/**
 * Edit Profile (Phase 2). Real contract (verified via direct API probe):
 * PUT /api/users/{numeric_id} returns 200 and persists `name`, `phone`,
 * `gender` - NOT a new/invented endpoint, the same `users` resource
 * ensureProfile() already reads via GET /users/by-auth/{auth_id}.
 * IMPORTANT: `city`/`country` were tried and confirmed via curl to be
 * silently ignored by this endpoint (200 response, but re-fetching shows
 * they stay null) - since the user's rules disallow modifying the
 * production backend, those two fields are intentionally NOT in this form
 * to avoid a misleading "Saved" state that doesn't actually persist.
 */
export default function EditProfile() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const [form, setForm] = useState({
    full_name: user?.full_name || '',
    phone: user?.phone || '',
  });
  const [gender, setGender] = useState<string | undefined>(user?.gender);
  const [saving, setSaving] = useState(false);

  // `user` from AuthContext can still be hydrating when this screen mounts
  // (e.g. navigating here right after login) - without this sync, the
  // form's initial useState snapshot stays permanently empty even once the
  // real profile loads a moment later.
  useEffect(() => {
    if (user) {
      setForm({ full_name: user.full_name || '', phone: user.phone || '' });
      setGender(user.gender);
    }
  }, [user]);

  const handleSave = async () => {
    if (!user?.id) return;
    if (!form.full_name.trim()) {
      Alert.alert('Missing info', 'Please enter your name.');
      return;
    }
    setSaving(true);
    try {
      await apiService.put(`/users/${user.id}`, {
        name: form.full_name.trim(),
        phone: form.phone.trim() || undefined,
        gender,
      });
      await refreshUser();
      Alert.alert('Saved', 'Your profile has been updated.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err?.friendlyMessage || 'Could not update your profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Edit Profile</Text>
        <View style={{ width: 24 }} />
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Input
            label="Full Name"
            value={form.full_name}
            onChangeText={(v) => setForm((f) => ({ ...f, full_name: v }))}
            placeholder="Your full name"
            icon="person-outline"
          />
          <Input label="Email" value={user?.email || ''} editable={false} icon="mail-outline" />
          <Input
            label="Phone"
            value={form.phone}
            onChangeText={(v) => setForm((f) => ({ ...f, phone: v }))}
            placeholder="e.g. +2348011122233"
            keyboardType="phone-pad"
            icon="call-outline"
          />
          <Text style={styles.label}>Gender</Text>
          <View style={styles.chipRow}>
            {GENDERS.map((g) => (
              <TouchableOpacity
                key={g}
                style={[styles.chip, gender === g && styles.chipActive]}
                onPress={() => setGender(g)}
                accessibilityRole="button"
                accessibilityLabel={g}
              >
                <Text style={[styles.chipText, gender === g && styles.chipTextActive]}>
                  {g.charAt(0).toUpperCase() + g.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Button title="Save Changes" onPress={handleSave} loading={saving} fullWidth size="large" style={{ marginTop: Spacing.md }} />
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
  label: { fontSize: FontSizes.sm, fontWeight: '600', color: Colors.text, marginBottom: Spacing.sm },
  chipRow: { flexDirection: 'row', gap: Spacing.sm },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: FontSizes.sm, color: Colors.text },
  chipTextActive: { fontWeight: '700' },
});
