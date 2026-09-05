import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Button } from '../../src/components/common';
import { useAuth } from '../../src/contexts/AuthContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { supabase } from '../../src/lib/supabase';
import { providerService } from '../../src/services/provider.service';
import { BorderRadius, FontSizes, Spacing } from '../../src/constants/theme';

const statusLabel: Record<string, string> = {
  not_submitted: 'Not Submitted',
  pending: 'Pending Review',
  approved: 'Approved',
  rejected: 'Rejected',
  expired: 'Expired',
};

export default function ProviderCertificate() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [picking, setPicking] = useState(false);
  const [status, setStatus] = useState('not_submitted');
  const [certification, setCertification] = useState<any>(null);
  const [specialty, setSpecialty] = useState('');
  const [certificationName, setCertificationName] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [certificateAsset, setCertificateAsset] = useState<any>(null);

  const loadCertification = useCallback(async () => {
    if (!user?.auth_id) return;
    setLoading(true);
    try {
      const result = await providerService.getCertification(user.auth_id);
      setStatus(result.status || 'not_submitted');
      setCertification(result.certification);
      if (result.certification) {
        setSpecialty(result.certification.specialty || '');
        setCertificationName(result.certification.certification_name || '');
        setExpiryDate(result.certification.expiry_date || '');
      }
    } catch (error: any) {
      Alert.alert('Could not load certificate', error?.friendlyMessage || 'Please try again.');
    } finally {
      setLoading(false);
    }
  }, [user?.auth_id]);

  useEffect(() => {
    loadCertification();
  }, [loadCertification]);

  const pickCertificate = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== 'granted') {
      Alert.alert('Permission required', 'Please allow photo access to upload your certificate.');
      return;
    }
    setPicking(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 0.8 });
      if (!result.canceled && result.assets?.[0]) setCertificateAsset(result.assets[0]);
    } finally {
      setPicking(false);
    }
  };

  const uploadCertificate = async () => {
    if (!user?.auth_id || !certificateAsset?.uri) throw new Error('Choose a certificate document first.');
    const response = await fetch(certificateAsset.uri);
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > 5 * 1024 * 1024) throw new Error('Please choose a certificate smaller than 5MB.');
    const path = `providers/${user.auth_id}/certificates/certificate-${Date.now()}.jpg`;
    const upload = await supabase.storage.from('profile-images').upload(path, buffer, { contentType: 'image/jpeg', upsert: true });
    if (upload.error) throw upload.error;
    return supabase.storage.from('profile-images').getPublicUrl(path).data.publicUrl;
  };

  const submit = async () => {
    if (!user?.auth_id) return;
    if (!specialty.trim() || !certificationName.trim()) {
      Alert.alert('Missing fields', 'Enter your specialty and certification name.');
      return;
    }
    if (!certificateAsset?.uri && !certification?.certificate_url) {
      Alert.alert('Certificate required', 'Upload your certificate document before submitting.');
      return;
    }
    setSaving(true);
    try {
      const certificateUrl = certificateAsset?.uri ? await uploadCertificate() : certification.certificate_url;
      const saved = await providerService.submitCertification(user.auth_id, {
        specialty: specialty.trim(),
        certification_name: certificationName.trim(),
        certificate_url: certificateUrl,
        expiry_date: expiryDate.trim() || undefined,
      });
      setCertification(saved);
      setStatus('pending');
      setCertificateAsset(null);
      Alert.alert('Submitted', 'Your certificate has been submitted for review.');
    } catch (error: any) {
      Alert.alert('Submission failed', error?.friendlyMessage || error?.message || 'Could not submit your certificate.');
    } finally {
      setSaving(false);
    }
  };

  const canEdit = status === 'not_submitted' || status === 'rejected' || status === 'expired';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back"><Ionicons name="arrow-back" size={24} color={colors.text} /></TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Verify Your Certificate</Text>
        <View style={{ width: 24 }} />
      </View>
      {loading ? <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View> : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={[styles.intro, { color: colors.textSecondary }]}>Professional Consultation requires an approved professional certification.</Text>
          <View style={[styles.statusCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.statusLabel, { color: colors.textSecondary }]}>Verification status</Text>
            <Text style={[styles.statusValue, { color: status === 'approved' ? colors.success : status === 'rejected' ? colors.error : colors.text }]}>{statusLabel[status] || status}</Text>
            {!!certification?.rejection_reason && status === 'rejected' && <Text style={[styles.reason, { color: colors.error }]}>{certification.rejection_reason}</Text>}
            {status === 'approved' && <Text style={[styles.detail, { color: colors.textSecondary }]}>Certification: {certification.certification_name}{'\n'}Specialty: {certification.specialty}{certification.expiry_date ? `\nExpires: ${certification.expiry_date}` : ''}</Text>}
          </View>
          {canEdit && <>
            <Text style={[styles.label, { color: colors.text }]}>Specialty</Text>
            <TextInput value={specialty} onChangeText={setSpecialty} placeholder="e.g. Dermatology" placeholderTextColor={colors.textMuted} style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]} />
            <Text style={[styles.label, { color: colors.text }]}>Certification name</Text>
            <TextInput value={certificationName} onChangeText={setCertificationName} placeholder="Enter certification name" placeholderTextColor={colors.textMuted} style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]} />
            <Text style={[styles.label, { color: colors.text }]}>Certificate document</Text>
            <TouchableOpacity onPress={pickCertificate} disabled={picking || saving} style={[styles.upload, { borderColor: colors.border, backgroundColor: colors.surface }]}>
              {certificateAsset?.uri ? <Image source={{ uri: certificateAsset.uri }} style={styles.preview} /> : <Ionicons name="cloud-upload-outline" size={28} color={colors.primary} />}
              <Text style={[styles.uploadText, { color: colors.text }]}>{picking ? 'Opening photos...' : certificateAsset?.fileName || certification?.certificate_url ? 'Replace certificate' : 'Upload Certificate'}</Text>
            </TouchableOpacity>
            <Text style={[styles.label, { color: colors.text }]}>Expiry date (optional)</Text>
            <TextInput value={expiryDate} onChangeText={setExpiryDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textMuted} style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]} />
            <Button title={saving ? 'Submitting...' : 'Submit for Verification'} onPress={submit} loading={saving} disabled={saving} fullWidth size="large" />
          </>}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  title: { fontSize: FontSizes.lg, fontWeight: '700' },
  content: { padding: Spacing.lg, gap: Spacing.sm },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  intro: { fontSize: FontSizes.sm, lineHeight: 21, marginBottom: Spacing.md },
  statusCard: { borderWidth: 1, borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: Spacing.md },
  statusLabel: { fontSize: FontSizes.xs },
  statusValue: { fontSize: FontSizes.md, fontWeight: '700', marginTop: 4 },
  reason: { fontSize: FontSizes.sm, marginTop: Spacing.sm },
  detail: { fontSize: FontSizes.sm, lineHeight: 21, marginTop: Spacing.sm },
  label: { fontSize: FontSizes.sm, fontWeight: '600', marginTop: Spacing.sm },
  input: { borderWidth: 1, borderRadius: BorderRadius.md, padding: Spacing.md, fontSize: FontSizes.sm },
  upload: { minHeight: 100, borderWidth: 1, borderStyle: 'dashed', borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, padding: Spacing.md },
  preview: { width: 72, height: 72, borderRadius: BorderRadius.md },
  uploadText: { fontSize: FontSizes.sm },
});
