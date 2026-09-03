import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal, ActivityIndicator, Switch } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, FontSizes, Spacing, BorderRadius } from '../../src/constants/theme';
import { BrandLogo } from '../../src/components/branding';
import { useAuth } from '../../src/contexts/AuthContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { supabase } from '../../src/lib/supabase';
import { apiService } from '../../src/services/api';
import { providerService } from '../../src/services/provider.service';
import { Input } from '../../src/components/common';
import { formatCurrency } from '../../src/utils/currency';

/**
 * Settings hub (Phase 2). Every item here routes to a real, functioning
 * screen backed by an existing production endpoint or Supabase Auth call -
 * no placeholders, no mock data.
 */
export default function Settings() {
  const router = useRouter();
  const { logout, user } = useAuth();
  const { colors } = useTheme();
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const isProvider = user?.role === 'provider' || user?.role_raw === 'stylist';
  const [consultationLoading, setConsultationLoading] = useState(false);
  const [consultationSaving, setConsultationSaving] = useState(false);
  const [consultationEligible, setConsultationEligible] = useState(false);
  const [consultationEnabled, setConsultationEnabled] = useState(false);
  const [consultationSpecialty, setConsultationSpecialty] = useState<string | null>(null);
  const [consultationFee, setConsultationFee] = useState('');
  const [consultationDescription, setConsultationDescription] = useState('');

  useEffect(() => {
    if (!isProvider || !user?.auth_id) return;
    setConsultationLoading(true);
    providerService.getConsultationSettings(user.auth_id).then((settings) => {
      setConsultationEligible(settings.eligible);
      setConsultationEnabled(settings.eligible && settings.enabled);
      setConsultationSpecialty(settings.specialty || null);
      setConsultationFee(settings.consultation_fee == null ? '' : String(settings.consultation_fee));
      setConsultationDescription(settings.description || '');
    }).catch((err: any) => Alert.alert('Could not load consultation settings', err?.friendlyMessage || 'Please try again.'))
      .finally(() => setConsultationLoading(false));
  }, [isProvider, user?.auth_id]);

  const saveConsultationSettings = async () => {
    if (!user?.auth_id) return;
    const fee = Number(consultationFee.replace(/[^0-9.]/g, ''));
    if (consultationEnabled && (!Number.isFinite(fee) || fee <= 0)) {
      Alert.alert('Invalid consultation fee', 'Enter a fee greater than ₦0 to enable consultations.');
      return;
    }
    setConsultationSaving(true);
    try {
      const saved = await providerService.updateConsultationSettings(user.auth_id, {
        enabled: consultationEnabled,
        consultation_fee: Number.isFinite(fee) && fee > 0 ? fee : undefined,
        description: consultationDescription.trim() || undefined,
        currency: 'NGN',
      });
      setConsultationEnabled(Boolean(saved.enabled));
      setConsultationFee(saved.consultation_fee == null ? consultationFee : String(saved.consultation_fee));
      Alert.alert('Saved', 'Professional consultation settings have been updated.');
    } catch (err: any) {
      Alert.alert('Save failed', err?.friendlyMessage || 'Could not update consultation settings.');
    } finally {
      setConsultationSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          try {
            await logout();
          } catch (err) {
            console.error('[settings] logout failed', err);
          } finally {
            router.replace('/(auth)/login');
          }
        },
      },
    ]);
  };

  const handleDeleteAccount = async () => {
    if (!user?.auth_id) {
      Alert.alert('Unable to delete account', 'No active account is available.');
      return;
    }

    setDeletingAccount(true);
    try {
      console.log('[settings] deleting account', { auth_id: user.auth_id });
      const response = await apiService.delete(`/users/by-auth/${user.auth_id}`);
      console.log('[settings] delete account response', response);

      await supabase.auth.signOut();
      await AsyncStorage.clear();
      await SecureStore.deleteItemAsync('istylist_supabase_encryption_key');
      await logout();
      setDeleteModalVisible(false);
      router.replace('/(auth)/login');
    } catch (err: any) {
      console.error('[settings] delete account failed', {
        status: err?.response?.status,
        data: err?.response?.data,
        message: err?.message,
        friendlyMessage: err?.friendlyMessage,
      });
      Alert.alert('Delete failed', err?.friendlyMessage || 'We could not delete your account right now.');
    } finally {
      setDeletingAccount(false);
    }
  };

  const sections = [
    {
      title: 'Account',
      items: [
        { icon: 'person-outline', label: 'Edit Profile', onPress: () => router.push('/settings/edit-profile') },
        { icon: 'lock-closed-outline', label: 'Change Password', onPress: () => router.push('/settings/change-password') },
        { icon: 'notifications-outline', label: 'Notifications', onPress: () => router.push('/notifications') },
        { icon: 'trash-outline', label: 'Delete Account', onPress: () => setDeleteModalVisible(true), isDanger: true },
      ],
    },
    {
      title: 'Support',
      items: [
        { icon: 'help-circle-outline', label: 'Help & Support', onPress: () => router.push('/settings/help') },
        { icon: 'document-text-outline', label: 'Terms of Service', onPress: () => router.push('/settings/terms') },
        { icon: 'shield-checkmark-outline', label: 'Privacy Policy', onPress: () => router.push('/settings/privacy') },
      ],
    },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.titleWrap}>
          <BrandLogo size={24} />
          <Text style={[styles.title, { color: colors.text }]}>Settings</Text>
        </View>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.accountEmail, { color: colors.textSecondary }]}>{user?.email}</Text>
        {sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{section.title}</Text>
            <View style={[styles.menuItems, { backgroundColor: colors.surface }]}>
              {section.items.map((item) => (
                <TouchableOpacity
                  key={item.label}
                  style={[styles.menuItem, { borderBottomColor: colors.border }]}
                  onPress={item.onPress}
                  accessibilityRole="button"
                  accessibilityLabel={item.label}
                >
                  <View style={styles.menuItemLeft}>
                    <Ionicons name={item.icon as any} size={22} color={colors.text} />
                    <Text style={[styles.menuItemLabel, { color: colors.text }]}>{item.label}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        {isProvider && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Professional Consultation</Text>
            <View style={[styles.consultationCard, { backgroundColor: colors.surface }]}>
              <Text style={[styles.consultationTitle, { color: colors.text }]}>Professional Consultation</Text>
              <Text style={[styles.consultationDescription, { color: colors.textSecondary }]}>Allow customers to pay through iStylist for a professional consultation.</Text>
              {consultationLoading ? <ActivityIndicator color={colors.primary} /> : (
                <>
                  <View style={styles.consultationRow}>
                    <Text style={[styles.menuItemLabel, { color: colors.text }]}>Enable Professional Consultation</Text>
                    <Switch value={consultationEnabled} onValueChange={setConsultationEnabled} disabled={!consultationEligible || consultationSaving} trackColor={{ false: colors.border, true: colors.primary }} thumbColor={consultationEnabled ? colors.primary : colors.textMuted} />
                  </View>
                  {!consultationEligible && <Text style={[styles.eligibilityText, { color: colors.error }]}>An approved professional certification is required before consultation can be enabled.</Text>}
                  {consultationSpecialty && <Text style={[styles.specialtyText, { color: colors.textSecondary }]}>Approved specialty: {consultationSpecialty}</Text>}
                  <Input label="Consultation Fee (NGN)" value={consultationFee} onChangeText={setConsultationFee} placeholder="e.g. 15000" keyboardType="decimal-pad" editable={!consultationSaving} />
                  {consultationFee && <Text style={[styles.feePreview, { color: colors.textSecondary }]}>{formatCurrency(consultationFee)}</Text>}
                  <Input label="Description (optional)" value={consultationDescription} onChangeText={setConsultationDescription} placeholder="What customers can expect" multiline editable={!consultationSaving} style={styles.descriptionInput} />
                  <TouchableOpacity style={[styles.saveButton, { backgroundColor: colors.primary }]} onPress={saveConsultationSettings} disabled={consultationSaving}>
                    {consultationSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Save Consultation Settings</Text>}
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        )}

        <TouchableOpacity style={[styles.logoutButton, { backgroundColor: `${colors.error}20` }]} onPress={handleLogout} accessibilityRole="button" accessibilityLabel="Logout">
          <Ionicons name="log-out-outline" size={22} color={colors.error} />
          <Text style={[styles.logoutText, { color: colors.error }]}>Logout</Text>
        </TouchableOpacity>
        <Text style={[styles.version, { color: colors.textMuted }]}>Version 1.0.0</Text>
      </ScrollView>

      <Modal transparent animationType="fade" visible={deleteModalVisible} onRequestClose={() => setDeleteModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Delete account?</Text>
            <Text style={[styles.modalText, { color: colors.textSecondary }]}>
              This action permanently removes your account and connected profile data.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalSecondaryButton, { borderColor: colors.border }]}
                onPress={() => setDeleteModalVisible(false)}
                disabled={deletingAccount}
              >
                <Text style={[styles.modalSecondaryText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalDangerButton, { backgroundColor: colors.error }]}
                onPress={handleDeleteAccount}
                disabled={deletingAccount}
              >
                {deletingAccount ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.modalDangerText}>Delete Account</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  titleWrap: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  title: { fontSize: FontSizes.lg, fontWeight: 'bold' },
  content: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl },
  accountEmail: { fontSize: FontSizes.sm, marginBottom: Spacing.lg },
  section: { marginBottom: Spacing.lg },
  sectionTitle: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
  },
  menuItems: { borderRadius: BorderRadius.lg, overflow: 'hidden' },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
  },
  menuItemLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  menuItemLabel: { fontSize: FontSizes.md },
  consultationCard: { borderRadius: BorderRadius.lg, padding: Spacing.md },
  consultationTitle: { fontSize: FontSizes.md, fontWeight: '700' },
  consultationDescription: { fontSize: FontSizes.sm, lineHeight: 20, marginTop: Spacing.xs, marginBottom: Spacing.md },
  consultationRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md, marginBottom: Spacing.sm },
  eligibilityText: { fontSize: FontSizes.sm, lineHeight: 19, marginBottom: Spacing.md },
  specialtyText: { fontSize: FontSizes.sm, marginBottom: Spacing.md },
  feePreview: { fontSize: FontSizes.sm, marginTop: -Spacing.sm, marginBottom: Spacing.md },
  descriptionInput: { minHeight: 90, textAlignVertical: 'top' },
  saveButton: { alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.md, borderRadius: BorderRadius.md },
  saveButtonText: { color: '#fff', fontSize: FontSizes.sm, fontWeight: '700' },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  logoutText: { fontSize: FontSizes.md, fontWeight: '600' },
  version: { fontSize: FontSizes.xs, textAlign: 'center', marginTop: Spacing.lg },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
  },
  modalCard: {
    width: '100%',
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
  },
  modalTitle: { fontSize: FontSizes.lg, fontWeight: '700', marginBottom: Spacing.sm },
  modalText: { fontSize: FontSizes.sm, lineHeight: 20 },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  modalButton: {
    minWidth: 120,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSecondaryButton: { borderWidth: 1 },
  modalDangerButton: { minWidth: 140 },
  modalSecondaryText: { fontSize: FontSizes.sm, fontWeight: '600' },
  modalDangerText: { color: '#fff', fontSize: FontSizes.sm, fontWeight: '700' },
});
