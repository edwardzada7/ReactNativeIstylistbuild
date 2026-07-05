import React, { useCallback, useEffect, useState } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSizes, Spacing, BorderRadius } from '../../src/constants/theme';
import { Button, Input } from '../../src/components/common';
import { useAuth } from '../../src/contexts/AuthContext';
import { providerService } from '../../src/services/provider.service';
import { formatCurrency } from '../../src/utils/currency';
import { Service } from '../../src/types';

export default function ProviderServices() {
  const { user } = useAuth();
  const providerId = user?.id;

  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({ name: '', description: '', price: '', duration: '' });

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

  useEffect(() => {
    loadServices();
  }, [loadServices]);

  const handleAddService = async () => {
    if (!providerId) return;
    if (!form.name.trim() || !form.price.trim() || !form.duration.trim()) {
      Alert.alert('Missing info', 'Please fill in name, price and duration.');
      return;
    }
    setSaving(true);
    try {
      const created = await providerService.createProviderService({
        provider_id: providerId,
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        price: Number(form.price),
        duration_minutes: Number(form.duration),
      });
      setServices((prev) => [...prev, created]);
      setModalVisible(false);
      setForm({ name: '', description: '', price: '', duration: '' });
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
          onPress={() => setModalVisible(true)}
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
              <Text style={styles.modalTitle}>Add Service</Text>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              <Input
                label="Service Name"
                placeholder="e.g. Bridal Makeup"
                value={form.name}
                onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
              />
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
});
