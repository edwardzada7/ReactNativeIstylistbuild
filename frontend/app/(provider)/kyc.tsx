import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Colors, FontSizes, Spacing, BorderRadius } from '../../src/constants/theme';
import { Button } from '../../src/components/common';
import { useAuth } from '../../src/contexts/AuthContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import apiService from '../../src/services/api';

const fileToBase64 = async (asset: any): Promise<{ mime: string; data: string }> => {
  if (!asset?.uri) {
    throw new Error('Invalid file asset');
  }
  const response = await fetch(asset.uri);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const idx = result.indexOf(',');
      resolve({
        mime: asset.mimeType || blob.type || 'image/jpeg',
        data: idx >= 0 ? result.slice(idx + 1) : result,
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

type AccountType = 'individual' | 'business';

export default function ProviderKYC() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  const authId = user?.auth_id;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<'not_submitted' | 'pending' | 'verified' | 'rejected'>('not_submitted');
  const [existing, setExisting] = useState<any>(null);
  const [accountType, setAccountType] = useState<AccountType>('individual');

  // Individual form state
  const [individual, setIndividual] = useState({
    full_name: '',
    phone_number: '',
    date_of_birth: '',
    id_type: 'national_id',
    id_number: '',
  });
  const [selfieFile, setSelfieFile] = useState<any>(null);
  const [idDocFile, setIdDocFile] = useState<any>(null);

  // Business form state
  const [business, setBusiness] = useState({
    business_name: '',
    registration_number: '',
    business_address: '',
    contact_person: '',
    contact_phone: '',
  });
  const [cacFile, setCacFile] = useState<any>(null);
  const [logoFile, setLogoFile] = useState<any>(null);

  const loadStatus = useCallback(async () => {
    if (!authId) return;
    try {
      setLoading(true);
      const res = await apiService.get<{ status?: string; submission?: any }>(`/kyc/me?auth_id=${encodeURIComponent(authId)}`);
      setStatus((res.status as any) || 'not_submitted');
      setExisting(res.submission || null);
      const s = res.submission;
      if (s) {
        setAccountType(s.account_type || 'individual');
        if (s.account_type === 'individual') {
          setIndividual({
            full_name: s.full_name || '',
            phone_number: s.phone_number || '',
            date_of_birth: s.date_of_birth || '',
            id_type: s.id_type || 'national_id',
            id_number: s.id_number || '',
          });
        } else {
          setBusiness({
            business_name: s.business_name || '',
            registration_number: s.registration_number || '',
            business_address: s.business_address || '',
            contact_person: s.contact_person || '',
            contact_phone: s.contact_phone || '',
          });
        }
      }
    } catch (e) {
      setStatus('not_submitted');
    } finally {
      setLoading(false);
    }
  }, [authId]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const handleFilePick = async (setter: (file: any) => void) => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
        Alert.alert('File too large', 'Please select a file smaller than 5MB.');
        return;
      }
      setter(asset);
    } catch (err) {
      console.error('File picker error:', err);
    }
  };

  const handleSubmit = async () => {
    if (!authId) {
      Alert.alert('Error', 'Please log in to submit KYC.');
      return;
    }

    try {
      setSubmitting(true);
      const payload: any = {
        auth_id: authId,
        account_type: accountType,
      };

      if (accountType === 'individual') {
        if (!individual.full_name || !individual.phone_number || !individual.date_of_birth || !individual.id_type || !individual.id_number) {
          Alert.alert('Missing fields', 'Please complete all required fields.');
          return;
        }
        payload.individual = {
          ...individual,
          selfie: selfieFile ? await fileToBase64(selfieFile) : undefined,
          id_doc: idDocFile ? await fileToBase64(idDocFile) : undefined,
        };
      } else {
        if (!business.business_name || !business.registration_number || !business.business_address || !business.contact_person || !business.contact_phone) {
          Alert.alert('Missing fields', 'Please complete all required fields.');
          return;
        }
        payload.business = {
          ...business,
          cac_doc: cacFile ? await fileToBase64(cacFile) : undefined,
          logo: logoFile ? await fileToBase64(logoFile) : undefined,
        };
      }

      await apiService.post('/kyc/submit', payload);
      Alert.alert('Success', 'KYC submitted. Awaiting review.');
      await loadStatus();
    } catch (e: any) {
      const detail = e?.response?.data?.detail || e?.message || 'Failed to submit';
      Alert.alert('Error', typeof detail === 'string' ? detail : JSON.stringify(detail));
    } finally {
      setSubmitting(false);
    }
  };

  const readOnly = status === 'pending' || status === 'verified';

  if (!authId) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.centerState}>
          <Text style={[styles.message, { color: colors.text }]}>Please log in to access KYC.</Text>
          <Button title="Go to Login" onPress={() => router.push('/(auth)/login')} fullWidth size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>KYC Verification</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {status === 'rejected' && existing?.rejection_reason && (
          <View style={[styles.alertBanner, { backgroundColor: `${colors.error}20`, borderColor: colors.error }]}>
            <Ionicons name="alert-circle" size={20} color={colors.error} />
            <View style={styles.alertContent}>
              <Text style={[styles.alertTitle, { color: colors.error }]}>Rejected</Text>
              <Text style={[styles.alertText, { color: colors.text }]}>{existing.rejection_reason}</Text>
              <Text style={[styles.alertText, { color: colors.text }]}>You may update your details and resubmit below.</Text>
            </View>
          </View>
        )}

        {status === 'verified' && (
          <View style={[styles.alertBanner, { backgroundColor: `${colors.success}20`, borderColor: colors.success }]}>
            <Ionicons name="checkmark-circle" size={20} color={colors.success} />
            <Text style={[styles.alertText, { color: colors.text }]}>Your account is verified. Thank you.</Text>
          </View>
        )}

        {status === 'pending' && (
          <View style={[styles.alertBanner, { backgroundColor: `${colors.warning}20`, borderColor: colors.warning }]}>
            <Ionicons name="time" size={20} color={colors.warning} />
            <Text style={[styles.alertText, { color: colors.text }]}>Your submission is under review. We'll notify you once a decision is made.</Text>
          </View>
        )}

        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={[styles.label, { color: colors.text }]}>Account Type</Text>
          <View style={styles.accountTypeRow}>
            <TouchableOpacity
              style={[
                styles.accountTypeButton,
                { backgroundColor: accountType === 'individual' ? colors.primary : colors.background, borderColor: colors.border },
              ]}
              onPress={() => !readOnly && setAccountType('individual')}
              disabled={readOnly}
            >
              <Text style={[styles.accountTypeText, { color: accountType === 'individual' ? '#fff' : colors.text }]}>
                Individual
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.accountTypeButton,
                { backgroundColor: accountType === 'business' ? colors.primary : colors.background, borderColor: colors.border },
              ]}
              onPress={() => !readOnly && setAccountType('business')}
              disabled={readOnly}
            >
              <Text style={[styles.accountTypeText, { color: accountType === 'business' ? '#fff' : colors.text }]}>
                Business
              </Text>
            </TouchableOpacity>
          </View>

          {accountType === 'individual' ? (
            <View style={styles.formSection}>
              <Text style={[styles.fieldLabel, { color: colors.text }]}>Full Name *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                value={individual.full_name}
                onChangeText={(v) => setIndividual({ ...individual, full_name: v })}
                editable={!readOnly}
                placeholder="Enter your full name"
                placeholderTextColor={colors.textMuted}
              />

              <Text style={[styles.fieldLabel, { color: colors.text }]}>Phone Number *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                value={individual.phone_number}
                onChangeText={(v) => setIndividual({ ...individual, phone_number: v })}
                editable={!readOnly}
                placeholder="+234..."
                placeholderTextColor={colors.textMuted}
                keyboardType="phone-pad"
              />

              <Text style={[styles.fieldLabel, { color: colors.text }]}>Date of Birth *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                value={individual.date_of_birth}
                onChangeText={(v) => setIndividual({ ...individual, date_of_birth: v })}
                editable={!readOnly}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textMuted}
              />

              <Text style={[styles.fieldLabel, { color: colors.text }]}>Government ID Type *</Text>
              <View style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <TextInput
                  style={{ color: colors.text }}
                  value={individual.id_type}
                  onChangeText={(v) => setIndividual({ ...individual, id_type: v })}
                  editable={!readOnly}
                />
              </View>

              <Text style={[styles.fieldLabel, { color: colors.text }]}>Government ID Number *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                value={individual.id_number}
                onChangeText={(v) => setIndividual({ ...individual, id_number: v })}
                editable={!readOnly}
                placeholder="Enter your ID number"
                placeholderTextColor={colors.textMuted}
              />

              {!readOnly && (
                <>
                  <TouchableOpacity
                    style={[styles.fileButton, { backgroundColor: colors.background, borderColor: colors.border }]}
                    onPress={() => handleFilePick(setSelfieFile)}
                  >
                    <Ionicons name="image-outline" size={20} color={colors.primary} />
                    <Text style={[styles.fileButtonText, { color: colors.text }]}>
                      {selfieFile?.fileName || 'Upload Selfie (Image, max 5MB)'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.fileButton, { backgroundColor: colors.background, borderColor: colors.border }]}
                    onPress={() => handleFilePick(setIdDocFile)}
                  >
                    <Ionicons name="image-outline" size={20} color={colors.primary} />
                    <Text style={[styles.fileButtonText, { color: colors.text }]}>
                      {idDocFile?.fileName || 'Upload ID Document (Image, max 5MB)'}
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          ) : (
            <View style={styles.formSection}>
              <Text style={[styles.fieldLabel, { color: colors.text }]}>Business Name *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                value={business.business_name}
                onChangeText={(v) => setBusiness({ ...business, business_name: v })}
                editable={!readOnly}
                placeholder="Enter business name"
                placeholderTextColor={colors.textMuted}
              />

              <Text style={[styles.fieldLabel, { color: colors.text }]}>Registration Number *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                value={business.registration_number}
                onChangeText={(v) => setBusiness({ ...business, registration_number: v })}
                editable={!readOnly}
                placeholder="Enter registration number"
                placeholderTextColor={colors.textMuted}
              />

              <Text style={[styles.fieldLabel, { color: colors.text }]}>Business Address *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                value={business.business_address}
                onChangeText={(v) => setBusiness({ ...business, business_address: v })}
                editable={!readOnly}
                placeholder="Enter business address"
                placeholderTextColor={colors.textMuted}
              />

              <Text style={[styles.fieldLabel, { color: colors.text }]}>Contact Person *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                value={business.contact_person}
                onChangeText={(v) => setBusiness({ ...business, contact_person: v })}
                editable={!readOnly}
                placeholder="Enter contact person name"
                placeholderTextColor={colors.textMuted}
              />

              <Text style={[styles.fieldLabel, { color: colors.text }]}>Contact Phone *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                value={business.contact_phone}
                onChangeText={(v) => setBusiness({ ...business, contact_phone: v })}
                editable={!readOnly}
                placeholder="+234..."
                placeholderTextColor={colors.textMuted}
                keyboardType="phone-pad"
              />

              {!readOnly && (
                <>
                  <TouchableOpacity
                    style={[styles.fileButton, { backgroundColor: colors.background, borderColor: colors.border }]}
                    onPress={() => handleFilePick(setCacFile)}
                  >
                    <Ionicons name="image-outline" size={20} color={colors.primary} />
                    <Text style={[styles.fileButtonText, { color: colors.text }]}>
                      {cacFile?.fileName || 'Upload CAC Certificate (Image, max 5MB)'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.fileButton, { backgroundColor: colors.background, borderColor: colors.border }]}
                    onPress={() => handleFilePick(setLogoFile)}
                  >
                    <Ionicons name="image-outline" size={20} color={colors.primary} />
                    <Text style={[styles.fileButtonText, { color: colors.text }]}>
                      {logoFile?.fileName || 'Upload Business Logo (Image, max 5MB)'}
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}

          {!readOnly && (
            <Button
              title={submitting ? 'Submitting...' : status === 'rejected' ? 'Resubmit KYC' : 'Submit KYC'}
              onPress={handleSubmit}
              loading={submitting}
              fullWidth
              size="large"
            />
          )}
        </View>
      </ScrollView>
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
  title: { fontSize: FontSizes.lg, fontWeight: 'bold' },
  centerState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
  message: { fontSize: FontSizes.md, marginBottom: Spacing.lg, textAlign: 'center' },
  content: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    borderWidth: 1,
  },
  alertContent: { flex: 1 },
  alertTitle: { fontSize: FontSizes.sm, fontWeight: 'bold', marginBottom: 4 },
  alertText: { fontSize: FontSizes.xs },
  card: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
  },
  label: { fontSize: FontSizes.md, fontWeight: '600', marginBottom: Spacing.md },
  accountTypeRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  accountTypeButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
  },
  accountTypeText: { fontSize: FontSizes.sm, fontWeight: '600' },
  formSection: { gap: Spacing.md },
  fieldLabel: { fontSize: FontSizes.sm, fontWeight: '500' },
  input: {
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: FontSizes.sm,
    borderWidth: 1,
  },
  fileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
  },
  fileButtonText: { fontSize: FontSizes.sm },
});
