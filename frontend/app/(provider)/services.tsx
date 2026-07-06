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
import { Colors, FontSizes, Spacing, BorderRadius } from '../../src/constants/theme';
import { Button, Input } from '../../src/components/common';
import { useAuth } from '../../src/contexts/AuthContext';
import { providerService } from '../../src/services/provider.service';
import { formatCurrency } from '../../src/utils/currency';
import { Service } from '../../src/types';

type ModalStep = 'pick' | 'details';

export default function ProviderServices() {
  const { user } = useAuth();
  const providerId = user?.id;

  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Service catalog (Priority 8): providers must pick from the master
  // catalog instead of typing arbitrary service names, so search/discovery
  // stays consistent across the app.
  const [catalog, setCatalog] = useState<Service[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogSearch, setCatalogSearch] = useState('');

  const [modalVisible, setModalVisible] = useState(false);
  const [modalStep, setModalStep] = useState<ModalStep>('pick');
  const [selectedCatalogItem, setSelectedCatalogItem] = useState<Service | null>(null);
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
      const list = await providerService.getCatalogServices();
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
    setCatalogSearch('');
    setForm({ description: '', price: '', duration: '' });
    setModalVisible(true);
    if (catalog.length === 0) loadCatalog();
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
        (c.category || '').toLowerCase().includes(query)
      );
    });
  }, [catalog, catalogSearch, existingNames]);

  const handlePickCatalogItem = (item: Service) => {
    setSelectedCatalogItem(item);
    setForm({ description: item.description || '', price: '', duration: '' });
    setModalStep('details');
  };

  const handleAddService = async () => {
    if (!providerId || !selectedCatalogItem) return;
    if (!form.price.trim() || !form.duration.trim()) {
      Alert.alert('Missing info', 'Please fill in price and duration.');
      return;
    }
    setSaving(true);
    try {
      const created = await providerService.createProviderService({
        provider_id: providerId,
        name: selectedCatalogItem.name,
        description: form.description.trim() || undefined,
        price: Number(form.price),
        duration_minutes: Number(form.duration),
      });
      setServices((prev) => [...prev, created]);
      setModalVisible(false);
      setSelectedCatalogItem(null);
      setForm({ description: '', price: '', duration: '' });
    } catch (err: any) {
      Alert.alert('Error', err?.friendlyMessage || 'Could not add this service.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>My Services</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={openAddModal}
          accessibilityRole="button"
          accessibilityLabel="Add service"
        >
          <Ionicons name="add" size={24} color={Colors.text} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {error && <Text style={styles.errorText}>{error}</Text>}
          {services.length === 0 ? (
            <View style={styles.centerState}>
              <Ionicons name="cut-outline" size={32} color={Colors.textMuted} />
              <Text style={styles.emptyText}>No services yet. Tap + to add your first one.</Text>
            </View>
          ) : (
            services.map((service) => (
              <View key={service.id} style={styles.serviceCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.serviceName}>{service.name}</Text>
                  {!!service.description && (
                    <Text style={styles.serviceDescription} numberOfLines={2}>
                      {service.description}
                    </Text>
                  )}
                  <Text style={styles.serviceMeta}>{service.duration} min</Text>
                </View>
                <Text style={styles.servicePrice}>{formatCurrency(service.price)}</Text>
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
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              {modalStep === 'details' ? (
                <TouchableOpacity
                  onPress={() => setModalStep('pick')}
                  accessibilityRole="button"
                  accessibilityLabel="Back to catalog"
                  style={styles.modalBackButton}
                >
                  <Ionicons name="arrow-back" size={22} color={Colors.text} />
                </TouchableOpacity>
              ) : (
                <View style={styles.modalBackButton} />
              )}
              <Text style={styles.modalTitle}>
                {modalStep === 'pick' ? 'Choose a Service' : 'Set Price & Duration'}
              </Text>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            {modalStep === 'pick' ? (
              <View style={styles.pickStep}>
                <Text style={styles.pickHint}>
                  Select a service from our catalog. This keeps search accurate for customers.
                </Text>
                <View style={styles.catalogSearchBar}>
                  <Ionicons name="search" size={18} color={Colors.textMuted} />
                  <TextInput
                    style={styles.catalogSearchInput}
                    placeholder="Search services..."
                    placeholderTextColor={Colors.textMuted}
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
                    <Text style={styles.emptyText}>{catalogError}</Text>
                    <Button title="Retry" onPress={loadCatalog} variant="outline" />
                  </View>
                ) : filteredCatalog.length === 0 ? (
                  <View style={styles.catalogCenterState}>
                    <Ionicons name="search-outline" size={28} color={Colors.textMuted} />
                    <Text style={styles.emptyText}>
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
                        style={styles.catalogRow}
                        onPress={() => handlePickCatalogItem(item)}
                        accessibilityRole="button"
                        accessibilityLabel={`Select ${item.name}`}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.catalogRowName}>{item.name}</Text>
                          {!!item.category && (
                            <Text style={styles.catalogRowCategory}>{item.category}</Text>
                          )}
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </View>
            ) : (
              <ScrollView>
                <View style={styles.selectedServiceBanner}>
                  <Ionicons name="checkmark-circle" size={18} color={Colors.primary} />
                  <Text style={styles.selectedServiceName}>{selectedCatalogItem?.name}</Text>
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
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  title: { fontSize: FontSizes.xxl, fontWeight: 'bold', color: Colors.text },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerState: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.sm, paddingTop: Spacing.xxl },
  emptyText: { fontSize: FontSizes.sm, color: Colors.textSecondary, textAlign: 'center', paddingHorizontal: Spacing.xl },
  errorText: { fontSize: FontSizes.sm, color: Colors.error, marginBottom: Spacing.md },
  list: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl },
  serviceCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  serviceName: { fontSize: FontSizes.sm, fontWeight: '700', color: Colors.text },
  serviceDescription: { fontSize: FontSizes.xs, color: Colors.textSecondary, marginTop: 2 },
  serviceMeta: { fontSize: FontSizes.xs, color: Colors.textMuted, marginTop: 2 },
  servicePrice: { fontSize: FontSizes.md, fontWeight: '700', color: Colors.primary },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: {
    backgroundColor: Colors.background,
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
  modalTitle: { fontSize: FontSizes.lg, fontWeight: '700', color: Colors.text },
  modalBackButton: { width: 28 },
  pickStep: { flex: 1, minHeight: 300 },
  pickHint: { fontSize: FontSizes.xs, color: Colors.textSecondary, marginBottom: Spacing.md },
  catalogSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  catalogSearchInput: { flex: 1, fontSize: FontSizes.sm, color: Colors.text, paddingVertical: 4 },
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
    borderBottomColor: Colors.border,
  },
  catalogRowName: { fontSize: FontSizes.sm, fontWeight: '600', color: Colors.text },
  catalogRowCategory: { fontSize: FontSizes.xs, color: Colors.textSecondary, marginTop: 2 },
  selectedServiceBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: `${Colors.primary}15`,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  selectedServiceName: { fontSize: FontSizes.md, fontWeight: '700', color: Colors.text },
});
