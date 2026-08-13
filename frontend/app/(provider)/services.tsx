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
  KeyboardAvoidingView,
  Platform,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, FontSizes, Spacing, BorderRadius } from '../../src/constants/theme';
import { Button, Input } from '../../src/components/common';
import { useAuth } from '../../src/contexts/AuthContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { providerService } from '../../src/services/provider.service';
import { formatCurrency } from '../../src/utils/currency';
import { Service, CatalogSubService } from '../../src/types';

type ModalStep = 'pick' | 'details';

export default function ProviderServices() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  const providerId = user?.id;

  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Service catalog (Priority 8 / 3.2 fix): providers must pick from the
  // master catalog instead of typing arbitrary service names. Uses
  // /catalog/sub-services (the real, granular, bookable items) - NOT
  // /catalog/services, which only returns broad service *types*
  // ("Barbers", "Makeup Artists") with no price/duration data.
  const [catalog, setCatalog] = useState<CatalogSubService[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogSearch, setCatalogSearch] = useState('');

  const [modalVisible, setModalVisible] = useState(false);
  const [modalStep, setModalStep] = useState<ModalStep>('pick');
  const [selectedCatalogItem, setSelectedCatalogItem] = useState<CatalogSubService | null>(null);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [form, setForm] = useState({ description: '', price: '', duration: '' });

  const loadServices = useCallback(async () => {
    if (!providerId) return;
    try {
      setError(null);
      const list = await providerService.getProviderServices(providerId);
      setServices(list);
    } catch (err: any) {
      console.error('[provider-services] failed to load', err);
      setError(err?.friendlyMessage || 'Could not load your services.');
    } finally {
      setLoading(false);
    }
  }, [providerId]);

  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true);
    setCatalogError(null);
    try {
      const list = await providerService.getCatalogSubServices();
      setCatalog(list);
    } catch (err: any) {
      console.error('[provider-services] failed to load catalog', err);
      setCatalogError(err?.friendlyMessage || 'Could not load the service catalog.');
      setCatalog([]);
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  useEffect(() => {
    loadServices();
  }, [loadServices]);

  const openAddModal = () => {
    setModalStep('pick');
    setSelectedCatalogItem(null);
    setEditingService(null);
    setCatalogSearch('');
    setForm({ description: '', price: '', duration: '' });
    setModalVisible(true);
    if (catalog.length === 0) loadCatalog();
  };

  const openEditModal = (service: Service) => {
    setEditingService(service);
    setForm({
      description: service.description || '',
      price: String(service.price),
      duration: String(service.duration_minutes),
    });
    setModalStep('details');
    setModalVisible(true);
  };

  const existingNames = useMemo(
    () => new Set(services.map((s) => s.name.trim().toLowerCase())),
    [services]
  );

  const filteredCatalog = useMemo(() => {
    const query = catalogSearch.trim().toLowerCase();
    return catalog.filter((c) => {
      if (existingNames.has(c.name.trim().toLowerCase())) return false; // avoid duplicates
      if (!query) return true;
      return (
        c.name.toLowerCase().includes(query) ||
        (c.category_name || '').toLowerCase().includes(query)
      );
    });
  }, [catalog, catalogSearch, existingNames]);

  const handlePickCatalogItem = (item: CatalogSubService) => {
    setSelectedCatalogItem(item);
    setForm({ description: '', price: '', duration: '' });
    setModalStep('details');
  };

  const handleAddService = async () => {
    if (!providerId) return;
    if (!form.price.trim() || !form.duration.trim()) {
      Alert.alert('Missing info', 'Please fill in price and duration.');
      return;
    }
    setSaving(true);
    try {
      if (editingService) {
        // Update existing service
        const updated = await providerService.updateProviderService(editingService.id, {
          description: form.description.trim() || undefined,
          price: Number(form.price),
          duration_minutes: Number(form.duration),
        });
        setServices((prev) => prev.map((s) => (s.id === editingService.id ? { ...s, ...updated } : s)));
      } else if (selectedCatalogItem) {
        // Create new service from catalog
        const created = await providerService.createProviderService({
          provider_id: providerId,
          sub_service_id: selectedCatalogItem.id,
          sub_service_name: selectedCatalogItem.name,
          service_id: selectedCatalogItem.service_id,
          category_id: selectedCatalogItem.category_id,
          description: form.description.trim() || undefined,
          price: Number(form.price),
          duration_minutes: Number(form.duration),
        });
        setServices((prev) => [...prev, created]);
      }
      setModalVisible(false);
      setSelectedCatalogItem(null);
      setEditingService(null);
      setForm({ description: '', price: '', duration: '' });
    } catch (err: any) {
      Alert.alert('Error', err?.friendlyMessage || 'Could not save this service.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteService = (service: Service) => {
    Alert.alert('Delete Service', `Remove "${service.name}" from your services?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await providerService.deleteProviderService(service.id);
            setServices((prev) => prev.filter((s) => s.id !== service.id));
          } catch (err: any) {
            Alert.alert('Error', err?.friendlyMessage || 'Could not delete this service.');
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>My Services</Text>
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: colors.surface }]}
          onPress={openAddModal}
          accessibilityRole="button"
          accessibilityLabel="Add service"
        >
          <Ionicons name="add" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {error && <Text style={[styles.errorText, { color: colors.text }]}>{error}</Text>}
          {services.length === 0 ? (
            <View style={styles.centerState}>
              <Ionicons name="cut-outline" size={32} color={colors.textSecondary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No services yet. Tap + to add your first one.</Text>
            </View>
          ) : (
            services.map((service) => (
              <View key={service.id} style={[styles.serviceCard, { backgroundColor: colors.surface }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.serviceName, { color: colors.text }]}>{service.name}</Text>
                  {!!service.description && (
                    <Text style={[styles.serviceDescription, { color: colors.textSecondary }]} numberOfLines={2}>
                      {service.description}
                    </Text>
                  )}
                  <Text style={[styles.serviceMeta, { color: colors.textSecondary }]}>{service.duration} min</Text>
                </View>
                <View style={styles.serviceActions}>
                  <TouchableOpacity onPress={() => openEditModal(service)} accessibilityLabel="Edit service">
                    <Ionicons name="create-outline" size={20} color={Colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDeleteService(service)} accessibilityLabel="Delete service">
                    <Ionicons name="trash-outline" size={20} color={Colors.error} />
                  </TouchableOpacity>
                </View>
                <Text style={[styles.servicePrice, { color: colors.text }]}>{formatCurrency(service.price)}</Text>
              </View>
            ))
          )}
        </ScrollView>
      )}

      <Modal visible={modalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              {modalStep === 'details' ? (
                <TouchableOpacity
                  onPress={() => setModalStep('pick')}
                  accessibilityRole="button"
                  accessibilityLabel="Back to catalog"
                  style={styles.modalBackButton}
                >
                  <Ionicons name="arrow-back" size={22} color={colors.text} />
                </TouchableOpacity>
              ) : (
                <View style={styles.modalBackButton} />
              )}
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {editingService ? 'Edit Service' : modalStep === 'pick' ? 'Choose a Service' : 'Set Price & Duration'}
              </Text>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {modalStep === 'pick' ? (
              <View style={styles.pickStep}>
                <Text style={[styles.pickHint, { color: colors.textSecondary }]}>
                  Select a service from our catalog. This keeps search accurate for customers.
                </Text>
                <View style={[styles.catalogSearchBar, { backgroundColor: colors.surfaceLight }]}>
                  <Ionicons name="search" size={18} color={colors.textSecondary} />
                  <TextInput
                    style={[styles.catalogSearchInput, { color: colors.text }]}
                    placeholder="Search services..."
                    placeholderTextColor={colors.textSecondary}
                    value={catalogSearch}
                    onChangeText={setCatalogSearch}
                  />
                </View>

                {catalogLoading ? (
                  <View style={styles.catalogCenterState}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                  </View>
                ) : catalogError ? (
                  <View style={styles.catalogCenterState}>
                    <Ionicons name="alert-circle-outline" size={28} color={Colors.error} />
                    <Text style={[styles.emptyText, { color: colors.text }]}>{catalogError}</Text>
                    <Button title="Retry" onPress={loadCatalog} variant="outline" />
                  </View>
                ) : filteredCatalog.length === 0 ? (
                  <View style={styles.catalogCenterState}>
                    <Ionicons name="search-outline" size={28} color={colors.textSecondary} />
                    <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                      {catalogSearch
                        ? 'No matching services found.'
                        : 'No more catalog services to add.'}
                    </Text>
                  </View>
                ) : (
                  <ScrollView style={styles.catalogList} showsVerticalScrollIndicator={false}>
                    {filteredCatalog.map((item) => (
                      <TouchableOpacity
                        key={item.id || item.name}
                        style={[styles.catalogRow, { borderBottomColor: colors.border }]}
                        onPress={() => handlePickCatalogItem(item)}
                        accessibilityRole="button"
                        accessibilityLabel={`Select ${item.name}`}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.catalogRowName, { color: colors.text }]}>{item.name}</Text>
                          {!!item.category_name && (
                            <Text style={[styles.catalogRowCategory, { color: colors.textSecondary }]}>{item.category_name}</Text>
                          )}
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </View>
            ) : (
              <ScrollView>
                <View style={[styles.selectedServiceBanner, { backgroundColor: colors.surfaceLight }]}>
                  <Ionicons name="checkmark-circle" size={18} color={Colors.primary} />
                  <Text style={[styles.selectedServiceName, { color: colors.text }]}>{selectedCatalogItem?.name}</Text>
                </View>
                <Input
                  label="Description (optional)"
                  placeholder="Brief description"
                  value={form.description}
                  onChangeText={(v) => setForm((f) => ({ ...f, description: v }))}
                />
                <Input
                  label="Price (NGN)"
                  placeholder="e.g. 15000"
                  keyboardType="numeric"
                  value={form.price}
                  onChangeText={(v) => setForm((f) => ({ ...f, price: v }))}
                />
                <Input
                  label="Duration (minutes)"
                  placeholder="e.g. 60"
                  keyboardType="numeric"
                  value={form.duration}
                  onChangeText={(v) => setForm((f) => ({ ...f, duration: v }))}
                />
                <Button title="Add Service" onPress={handleAddService} loading={saving} fullWidth size="large" />
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  title: { fontSize: FontSizes.xxl, fontWeight: 'bold' },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerState: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.sm, paddingTop: Spacing.xxl },
  emptyText: { fontSize: FontSizes.sm, textAlign: 'center', paddingHorizontal: Spacing.xl },
  errorText: { fontSize: FontSizes.sm, marginBottom: Spacing.md },
  list: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl },
  serviceCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  serviceName: { fontSize: FontSizes.sm, fontWeight: '700' },
  serviceDescription: { fontSize: FontSizes.xs, marginTop: 2 },
  serviceMeta: { fontSize: FontSizes.xs, marginTop: 2 },
  serviceActions: { flexDirection: 'row', gap: Spacing.sm, marginRight: Spacing.sm },
  servicePrice: { fontSize: FontSizes.md, fontWeight: '700' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: {
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    padding: Spacing.lg,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  modalTitle: { fontSize: FontSizes.lg, fontWeight: '700' },
  modalBackButton: { width: 28 },
  pickStep: { flex: 1, minHeight: 300 },
  pickHint: { fontSize: FontSizes.xs, marginBottom: Spacing.md },
  catalogSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  catalogSearchInput: { flex: 1, fontSize: FontSizes.sm, paddingVertical: 4 },
  catalogCenterState: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xxl,
  },
  catalogList: { maxHeight: 380 },
  catalogRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderBottomWidth: 1,
  },
  catalogRowName: { fontSize: FontSizes.sm, fontWeight: '600' },
  catalogRowCategory: { fontSize: FontSizes.xs, marginTop: 2 },
  selectedServiceBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  selectedServiceName: { fontSize: FontSizes.md, fontWeight: '700' },
});
