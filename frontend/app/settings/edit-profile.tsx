import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, FontSizes, Spacing } from '../../src/constants/theme';
import { Button, Input } from '../../src/components/common';
import { useAuth } from '../../src/contexts/AuthContext';
import apiService from '../../src/services/api';

/**
 * Edit Profile (Phase 2). Real contract (verified via direct API probe):
 * PUT /api/users/{numeric_id} returns 200 and accepts partial updates -
 * NOT a new/invented endpoint, the same `users` resource ensureProfile()
 * already reads via GET /users/by-auth/{auth_id}.
 */
export default function EditProfile() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const [form, setForm] = useState({
    full_name: user?.full_name || '',
    phone: user?.phone || '',
    city: user?.city || '',
    country: user?.country || '',
  });
  const [saving, setSaving] = useState(false);

  // `user` from AuthContext can still be hydrating when this screen mounts
  // (e.g. navigating here right after login) - without this sync, the
  // form's initial useState snapshot stays permanently empty even once the
  // real profile loads a moment later.
  useEffect(() => {
    if (user) {
      setForm({
        full_name: user.full_name || '',
        phone: user.phone || '',
        city: user.city || '',
        country: user.country || '',
      });
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
        city: form.city.trim() || undefined,
        country: form.country.trim() || undefined,
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
          <Input
            label="City"
            value={form.city}
            onChangeText={(v) => setForm((f) => ({ ...f, city: v }))}
            placeholder="e.g. Lagos"
            icon="location-outline"
          />
          <Input
            label="Country"
            value={form.country}
            onChangeText={(v) => setForm((f) => ({ ...f, country: v }))}
            placeholder="e.g. Nigeria"
            icon="flag-outline"
          />
          <Button title="Save Changes" onPress={handleSave} loading={saving} fullWidth size="large" />
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
});
