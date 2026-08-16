import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  Switch,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Colors, FontSizes, Spacing, BorderRadius } from '../../src/constants/theme';
import { useAuth } from '../../src/contexts/AuthContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { supabase } from '../../src/lib/supabase';
import { providerService } from '../../src/services/provider.service';
import staffService from '../../src/services/staff.service';
import { Service, StaffAvailabilityDay, StaffMember } from '../../src/types';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const blankWeekly = (): StaffAvailabilityDay[] =>
  DAYS.map((_, index) => ({
    day_of_week: index,
    is_available: false,
    start_time: '09:00',
    end_time: '17:00',
  }));

export default function ProviderManageStaff() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  const authId = user?.auth_id;
  const providerId = user?.id;

  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [profileVisible, setProfileVisible] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [profileForm, setProfileForm] = useState({
    name: '',
    role: '',
    photo_url: '',
    bio: '',
    is_active: true,
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [photoUploadLoading, setPhotoUploadLoading] = useState(false);
  const [photoPreviewUri, setPhotoPreviewUri] = useState<string | null>(null);

  const [servicesVisible, setServicesVisible] = useState(false);
  const [servicesEditing, setServicesEditing] = useState<StaffMember | null>(null);
  const [selectedServiceIds, setSelectedServiceIds] = useState<Record<string, boolean>>({});
  const [savingServices, setSavingServices] = useState(false);

  const [availabilityVisible, setAvailabilityVisible] = useState(false);
  const [availabilityEditing, setAvailabilityEditing] = useState<StaffMember | null>(null);
  const [weekly, setWeekly] = useState<StaffAvailabilityDay[]>(blankWeekly());
  const [savingAvailability, setSavingAvailability] = useState(false);

  const loadStaff = useCallback(async () => {
    if (!authId) return;
    try {
      const rows = await staffService.listMine(authId, true);
      setStaff(rows);
    } catch (err: any) {
      console.error('[staff] failed to load', err);
      setError(err?.friendlyMessage || 'Could not load staff.');
      setStaff([]);
    }
  }, [authId]);

  const loadServices = useCallback(async () => {
    if (!providerId) return;
    try {
      const list = await providerService.getProviderServices(providerId);
      setServices(list);
    } catch (err) {
      console.error('[staff] failed to load services', err);
      setServices([]);
    }
  }, [providerId]);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([loadStaff(), loadServices()]);
    } finally {
      setLoading(false);
    }
  }, [loadStaff, loadServices]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  const openCreateStaff = () => {
    setEditingStaff(null);
    setProfileForm({ name: '', role: '', photo_url: '', bio: '', is_active: true });
    setPhotoPreviewUri(null);
    setProfileVisible(true);
  };

  const openEditStaff = (member: StaffMember) => {
    setEditingStaff(member);
    setProfileForm({
      name: member.name || '',
      role: member.role || '',
      photo_url: member.photo_url || '',
      bio: member.bio || '',
      is_active: !!member.is_active,
    });
    setPhotoPreviewUri(member.photo_url || null);
    setProfileVisible(true);
  };

  const handleStaffPhotoPick = async (source: 'camera' | 'library') => {
    if (!user?.auth_id) {
      Alert.alert('Login required', 'Please sign in again to upload a staff photo.');
      return;
    }

    try {
      const permission =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (permission.status !== 'granted') {
        Alert.alert('Permission required', 'Please allow camera/photos access to upload a staff photo.');
        return;
      }

      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({
              allowsEditing: true,
              quality: 0.8,
              mediaTypes: ['images'],
            })
          : await ImagePicker.launchImageLibraryAsync({
              allowsEditing: true,
              quality: 0.8,
              mediaTypes: ['images'],
            });

      if (result.canceled || !result.assets?.[0]) {
        return;
      }

      const asset = result.assets[0];
      const assetUri = asset.uri;
      if (!assetUri) {
        Alert.alert('Invalid image', 'The selected image could not be read.');
        return;
      }

      const response = await fetch(assetUri);
      const arrayBuffer = await response.arrayBuffer();
      const fileSizeBytes = arrayBuffer.byteLength;

      if (!fileSizeBytes || fileSizeBytes <= 0) {
        Alert.alert('Invalid image', 'The selected image could not be processed.');
        return;
      }

      if (fileSizeBytes > 2 * 1024 * 1024) {
        Alert.alert('Image too large', 'Please choose an image smaller than 2 MB.');
        return;
      }

      const mimeType = asset.mimeType || 'image/jpeg';
      const extension = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg';
      const fileName = `${editingStaff?.id || 'new'}-${Date.now()}.${extension}`;
      const storagePath = `staff/${user.auth_id}/${fileName}`;

      setPhotoUploadLoading(true);
      const { error: uploadError } = await supabase.storage.from('profile-images').upload(storagePath, arrayBuffer, {
        contentType: mimeType,
        upsert: true,
      });

      if (uploadError) {
        throw uploadError;
      }

      const { data: publicUrlData } = supabase.storage.from('profile-images').getPublicUrl(storagePath);
      const publicUrl = publicUrlData?.publicUrl;

      if (!publicUrl) {
        throw new Error('No public URL returned for the uploaded image.');
      }

      setPhotoPreviewUri(publicUrl);
      setProfileForm((prev) => ({ ...prev, photo_url: publicUrl }));
    } catch (err: any) {
      console.error('[staff-photo] upload failed', err);
      Alert.alert('Upload failed', 'Could not upload the staff photo right now. Please try again.');
    } finally {
      setPhotoUploadLoading(false);
    }
  };

  const saveProfile = async () => {
    if (!authId) return;
    if (!profileForm.name.trim()) {
      Alert.alert('Missing info', 'Name is required.');
      return;
    }

    setSavingProfile(true);
    try {
      if (editingStaff) {
        await staffService.update(editingStaff.id, authId, profileForm);
      } else {
        await staffService.create(authId, profileForm);
      }
      setProfileVisible(false);
      await refreshAll();
    } catch (err: any) {
      Alert.alert('Error', err?.friendlyMessage || 'Could not save staff member.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleHide = async (member: StaffMember) => {
    if (!authId) return;
    Alert.alert('Hide staff member', `Hide ${member.name} from booking? This keeps history intact.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Hide',
        style: 'destructive',
        onPress: async () => {
          try {
            await staffService.update(member.id, authId, { is_active: false });
            await refreshAll();
          } catch (err: any) {
            Alert.alert('Error', err?.friendlyMessage || 'Could not hide staff member.');
          }
        },
      },
    ]);
  };

  const openServices = (member: StaffMember) => {
    const initial: Record<string, boolean> = {};
    (member.service_ids || []).forEach((id) => {
      initial[String(id)] = true;
    });
    setServicesEditing(member);
    setSelectedServiceIds(initial);
    setServicesVisible(true);
  };

  const saveServices = async () => {
    if (!authId || !servicesEditing) return;
    setSavingServices(true);
    try {
      const ids = Object.keys(selectedServiceIds)
        .filter((key) => selectedServiceIds[key])
        .map((key) => Number(key));
      await staffService.setServices(servicesEditing.id, authId, ids);
      setServicesVisible(false);
      await refreshAll();
    } catch (err: any) {
      Alert.alert('Error', err?.friendlyMessage || 'Could not assign services.');
    } finally {
      setSavingServices(false);
    }
  };

  const openAvailability = async (member: StaffMember) => {
    setAvailabilityEditing(member);
    try {
      const detail = await staffService.get(member.id);
      const map = new Map((detail.weekly || []).map((day) => [day.day_of_week, day]));
      const merged = blankWeekly().map((day) => {
        const existing = map.get(day.day_of_week);
        if (!existing) return day;
        return {
          ...day,
          is_available: !!existing.is_available,
          start_time: existing.start_time || '09:00',
          end_time: existing.end_time || '17:00',
        };
      });
      setWeekly(merged);
    } catch {
      setWeekly(blankWeekly());
    }
    setAvailabilityVisible(true);
  };

  const updateWeekly = (index: number, patch: Partial<StaffAvailabilityDay>) => {
    setWeekly((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  };

  const saveAvailability = async () => {
    if (!authId || !availabilityEditing) return;
    setSavingAvailability(true);
    try {
      await staffService.setAvailability(availabilityEditing.id, authId, weekly);
      setAvailabilityVisible(false);
      await refreshAll();
    } catch (err: any) {
      Alert.alert('Error', err?.friendlyMessage || 'Could not save availability.');
    } finally {
      setSavingAvailability(false);
    }
  };

  const cards = useMemo(() => staff, [staff]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={Colors.primary} />
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
        <Text style={[styles.title, { color: colors.text }]}>Manage Staff</Text>
        <TouchableOpacity style={[styles.addButton, { backgroundColor: colors.surface }]} onPress={openCreateStaff}>
          <Ionicons name="add" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      {error && (
        <View style={styles.errorBox}>
          <Text style={{ color: colors.error }}>{error}</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {cards.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={36} color={colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No staff yet</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Add stylists or team members so customers can pick a specific provider for their booking.</Text>
          </View>
        ) : (
          cards.map((member) => (
            <View key={member.id} style={[styles.card, { backgroundColor: colors.surface }]}> 
              <View style={styles.cardTop}>
                <View style={styles.avatarWrap}>
                  {member.photo_url ? (
                    <Image source={{ uri: member.photo_url }} style={styles.avatar} />
                  ) : (
                    <Ionicons name="person" size={26} color={Colors.primary} />
                  )}
                </View>
                <View style={styles.cardInfo}>
                  <View style={styles.nameRow}>
                    <Text style={[styles.name, { color: colors.text }]}>{member.name}</Text>
                    {!member.is_active && (
                      <View style={styles.hiddenBadge}><Text style={styles.hiddenBadgeText}>Hidden</Text></View>
                    )}
                  </View>
                  {member.role ? <Text style={[styles.role, { color: colors.textSecondary }]}>{member.role}</Text> : null}
                  <Text style={[styles.serviceMeta, { color: colors.textSecondary }]}>{(member.service_ids || []).length} services</Text>
                </View>
              </View>

              <View style={styles.actionsRow}>
                <TouchableOpacity style={[styles.actionButton, { borderColor: colors.border }]} onPress={() => openEditStaff(member)}>
                  <Ionicons name="create-outline" size={16} color={colors.text} />
                  <Text style={[styles.actionText, { color: colors.text }]}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionButton, { borderColor: colors.border }]} onPress={() => openServices(member)}>
                  <Ionicons name="list-outline" size={16} color={colors.text} />
                  <Text style={[styles.actionText, { color: colors.text }]}>Services</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionButton, { borderColor: colors.border }]} onPress={() => openAvailability(member)}>
                  <Ionicons name="calendar-outline" size={16} color={colors.text} />
                  <Text style={[styles.actionText, { color: colors.text }]}>Schedule</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionButton, { borderColor: colors.border }]} onPress={() => handleHide(member)}>
                  <Ionicons name="eye-off-outline" size={16} color={colors.text} />
                  <Text style={[styles.actionText, { color: colors.text }]}>Hide</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <Modal visible={profileVisible} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}> 
            <Text style={[styles.modalTitle, { color: colors.text }]}>{editingStaff ? 'Edit Staff' : 'Add Staff'}</Text>

            <TextInput
              placeholder="Name *"
              value={profileForm.name}
              onChangeText={(text) => setProfileForm((prev) => ({ ...prev, name: text }))}
              style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
            />
            <TextInput
              placeholder="Role (e.g. Senior Stylist)"
              value={profileForm.role}
              onChangeText={(text) => setProfileForm((prev) => ({ ...prev, role: text }))}
              style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
            />
            <View style={styles.photoSection}>
              <View style={[styles.photoFrame, { borderColor: colors.border, backgroundColor: colors.background }]}>
                {photoPreviewUri ? (
                  <Image source={{ uri: photoPreviewUri }} style={styles.photoPreview} />
                ) : (
                  <Ionicons name="person-circle-outline" size={46} color={colors.textSecondary} />
                )}
              </View>

              <View style={styles.photoActions}>
                <TouchableOpacity
                  style={[styles.photoButton, { backgroundColor: colors.background, borderColor: colors.border }]}
                  onPress={() => handleStaffPhotoPick('library')}
                  disabled={photoUploadLoading}
                >
                  <Ionicons name="images-outline" size={18} color={colors.text} />
                  <Text style={[styles.photoButtonText, { color: colors.text }]}>{photoUploadLoading ? 'Uploading...' : 'Choose from Photos'}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.photoButton, { backgroundColor: colors.background, borderColor: colors.border }]}
                  onPress={() => handleStaffPhotoPick('camera')}
                  disabled={photoUploadLoading}
                >
                  <Ionicons name="camera-outline" size={18} color={colors.text} />
                  <Text style={[styles.photoButtonText, { color: colors.text }]}>Take Photo</Text>
                </TouchableOpacity>
              </View>

              {photoUploadLoading && (
                <View style={styles.uploadingRow}>
                  <ActivityIndicator size="small" color={Colors.primary} />
                  <Text style={[styles.uploadingText, { color: colors.textSecondary }]}>Uploading photo...</Text>
                </View>
              )}
            </View>
            <TextInput
              placeholder="Bio"
              value={profileForm.bio}
              onChangeText={(text) => setProfileForm((prev) => ({ ...prev, bio: text }))}
              multiline
              style={[styles.textArea, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
            />

            <View style={styles.switchRow}>
              <Text style={[styles.switchText, { color: colors.text }]}>Visible to customers</Text>
              <Switch value={profileForm.is_active} onValueChange={(value) => setProfileForm((prev) => ({ ...prev, is_active: value }))} />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.secondaryButton, { borderColor: colors.border }]} onPress={() => setProfileVisible(false)}>
                <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.primaryButton]} onPress={saveProfile} disabled={savingProfile}>
                <Text style={styles.primaryButtonText}>{savingProfile ? 'Saving...' : editingStaff ? 'Save' : 'Add'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={servicesVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface, maxHeight: '75%' }]}> 
            <Text style={[styles.modalTitle, { color: colors.text }]}>Services for {servicesEditing?.name || ''}</Text>
            {services.length === 0 ? (
              <Text style={{ color: colors.textSecondary }}>Add services first, then assign them here.</Text>
            ) : (
              <ScrollView style={{ maxHeight: 360 }}>
                {services.map((service) => (
                  <TouchableOpacity
                    key={service.id}
                    style={[styles.serviceRow, { borderColor: colors.border }]}
                    onPress={() => setSelectedServiceIds((prev) => ({ ...prev, [String(service.id)]: !prev[String(service.id)] }))}
                  >
                    <View style={styles.checkbox}>
                      {selectedServiceIds[String(service.id)] && <Ionicons name="checkmark" size={16} color={Colors.primary} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.serviceRowText, { color: colors.text }]}>{service.name}</Text>
                      <Text style={{ color: colors.textSecondary }}>{service.duration} min</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.secondaryButton, { borderColor: colors.border }]} onPress={() => setServicesVisible(false)}>
                <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.primaryButton]} onPress={saveServices} disabled={savingServices || services.length === 0}>
                <Text style={styles.primaryButtonText}>{savingServices ? 'Saving...' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={availabilityVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface, maxHeight: '80%' }]}> 
            <Text style={[styles.modalTitle, { color: colors.text }]}>Schedule for {availabilityEditing?.name || ''}</Text>
            <ScrollView style={{ maxHeight: 440 }}>
              {weekly.map((day, index) => (
                <View key={day.day_of_week} style={[styles.dayRow, { borderColor: colors.border }]}> 
                  <View style={styles.dayHeader}>
                    <Text style={[styles.dayLabel, { color: colors.text }]}>{DAYS[day.day_of_week]}</Text>
                    <Switch value={day.is_available} onValueChange={(value) => updateWeekly(index, { is_available: value })} />
                  </View>
                  {day.is_available && (
                    <View style={styles.timeRow}>
                      <TextInput
                        value={day.start_time || '09:00'}
                        onChangeText={(text) => updateWeekly(index, { start_time: text })}
                        keyboardType="numbers-and-punctuation"
                        style={[styles.timeInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                      />
                      <Text style={{ color: colors.textSecondary }}>to</Text>
                      <TextInput
                        value={day.end_time || '17:00'}
                        onChangeText={(text) => updateWeekly(index, { end_time: text })}
                        keyboardType="numbers-and-punctuation"
                        style={[styles.timeInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                      />
                    </View>
                  )}
                </View>
              ))}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.secondaryButton, { borderColor: colors.border }]} onPress={() => setAvailabilityVisible(false)}>
                <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.primaryButton]} onPress={saveAvailability} disabled={savingAvailability}>
                <Text style={styles.primaryButtonText}>{savingAvailability ? 'Saving...' : 'Save'}</Text>
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
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: { fontSize: FontSizes.xl, fontWeight: '700' },
  addButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { padding: Spacing.md, paddingBottom: Spacing.xl },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorBox: { marginHorizontal: Spacing.md, marginTop: Spacing.md, padding: Spacing.sm, borderRadius: BorderRadius.md, backgroundColor: '#FEE2E2' },
  emptyState: { paddingVertical: Spacing.xxl, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: FontSizes.lg, fontWeight: '700', marginTop: Spacing.md },
  emptyText: { fontSize: FontSizes.md, textAlign: 'center', marginTop: Spacing.sm, maxWidth: 320 },
  card: { padding: Spacing.md, borderRadius: BorderRadius.lg, marginBottom: Spacing.md },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  avatarWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#F3E8FF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatar: { width: 52, height: 52, borderRadius: 26 },
  cardInfo: { flex: 1, marginLeft: Spacing.sm },
  nameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  name: { fontSize: FontSizes.lg, fontWeight: '700' },
  hiddenBadge: { backgroundColor: '#E5E7EB', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  hiddenBadgeText: { fontSize: 10, color: '#374151', fontWeight: '600' },
  role: { fontSize: FontSizes.sm, marginTop: 4 },
  serviceMeta: { fontSize: FontSizes.sm, marginTop: 6 },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: Spacing.md, gap: 8 },
  actionButton: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
    minWidth: 78,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 5,
  },
  actionText: { fontSize: 12, fontWeight: '600' },
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)', padding: Spacing.md },
  modalContent: { width: '100%', maxWidth: 480, borderRadius: BorderRadius.xl, padding: Spacing.lg },
  modalTitle: { fontSize: FontSizes.xl, fontWeight: '700', marginBottom: Spacing.md },
  input: { borderWidth: 1, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: 12, marginBottom: Spacing.sm },
  photoSection: { marginBottom: Spacing.sm },
  photoFrame: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    alignSelf: 'center',
    marginBottom: Spacing.sm,
  },
  photoPreview: { width: 96, height: 96, borderRadius: 48 },
  photoActions: { gap: 8 },
  photoButton: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingVertical: 10,
    paddingHorizontal: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  photoButtonText: { fontSize: FontSizes.sm, fontWeight: '600' },
  uploadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: Spacing.sm, gap: 8 },
  uploadingText: { fontSize: FontSizes.sm },
  textArea: { borderWidth: 1, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: 12, minHeight: 100, marginBottom: Spacing.sm, textAlignVertical: 'top' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: Spacing.sm },
  switchText: { fontSize: FontSizes.md, fontWeight: '600' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: Spacing.md, gap: 10 },
  primaryButton: { backgroundColor: Colors.primary, paddingHorizontal: Spacing.md, paddingVertical: 12, borderRadius: BorderRadius.md },
  primaryButtonText: { color: '#fff', fontSize: FontSizes.md, fontWeight: '700' },
  secondaryButton: { borderWidth: 1, paddingHorizontal: Spacing.md, paddingVertical: 12, borderRadius: BorderRadius.md },
  secondaryButtonText: { fontSize: FontSizes.md, fontWeight: '600' },
  serviceRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: BorderRadius.md, padding: Spacing.sm, marginBottom: Spacing.sm },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1, borderColor: Colors.primary, alignItems: 'center', justifyContent: 'center', marginRight: Spacing.sm },
  serviceRowText: { fontSize: FontSizes.md, fontWeight: '600' },
  dayRow: { borderWidth: 1, borderRadius: BorderRadius.md, padding: Spacing.sm, marginBottom: Spacing.sm },
  dayHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dayLabel: { fontSize: FontSizes.md, fontWeight: '600' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: Spacing.sm },
  timeInput: { flex: 1, borderWidth: 1, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.sm, paddingVertical: 10 },
});
