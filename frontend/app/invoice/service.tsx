import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, FontSizes, Spacing, BorderRadius } from '../../src/constants/theme';
import { useAuth } from '../../src/contexts/AuthContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { providerService } from '../../src/services/provider.service';
import { chatService } from '../../src/services/chat.service';
import apiService from '../../src/services/api';
import { Service, StaffMember } from '../../src/types';
import { formatCurrency } from '../../src/utils/currency';

export default function ServiceInvoice() {
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuth();
  const { conversationId, customerAuthId } = useLocalSearchParams<{ conversationId: string; customerAuthId: string }>();
  const [services, setServices] = useState<Service[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [providerId, setProviderId] = useState('');
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [slots, setSlots] = useState<string[]>([]);
  const [selectedTime, setSelectedTime] = useState('');
  const [selectedStaff, setSelectedStaff] = useState<string | null>(null);
  const [location, setLocation] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const dates = useMemo(() => Array.from({ length: 14 }, (_, index) => { const date = new Date(); date.setDate(date.getDate() + index); return date; }), []);

  useEffect(() => {
    if (!user?.auth_id) return;
    (async () => {
      try {
        const profile = await apiService.get<any>(`/stylists/by-auth/${user.auth_id}`);
        const id = String(profile?.id || profile?.stylist_id || '');
        setProviderId(id);
        const [serviceList, staffList] = await Promise.all([
          providerService.getProviderServices(id),
          id ? providerService.getProviderStaff(id, true) : Promise.resolve([]),
        ]);
        setServices(serviceList.filter((item) => item.is_active !== false));
        setStaff(staffList);
        setSelectedService(serviceList.find((item) => item.is_active !== false) || null);
      } catch (error) { Alert.alert('Could not load services', 'Please try again.'); }
      finally { setLoading(false); }
    })();
  }, [user?.auth_id]);

  useEffect(() => {
    if (!providerId || !selectedService) return;
    setSelectedTime('');
    providerService.getAvailableSlots(providerId, selectedDate.toISOString().slice(0, 10), selectedService.duration || 30).then(setSlots).catch(() => setSlots([]));
  }, [providerId, selectedDate, selectedService]);

  const eligibleStaff = staff.filter((member) => (member.service_ids || []).map(String).includes(String(selectedService?.id)));
  const submit = async () => {
    if (!user?.auth_id || !conversationId || !customerAuthId || !selectedService || !selectedTime) {
      Alert.alert('Incomplete invoice', 'Choose a service, date, and available time.'); return;
    }
    setSaving(true);
    try {
      const invoice = await chatService.createInvoice({
        conversation_id: Number(conversationId), customer_auth_id: customerAuthId, provider_auth_id: user.auth_id,
        invoice_type: 'service', amount: Number(selectedService.price), service_date: selectedDate.toISOString().slice(0, 10),
        service_time: selectedTime, location: location.trim() || undefined, service_type: location.trim() || undefined,
        staff_id: selectedStaff ? Number(selectedStaff) : undefined, note: note.trim() || undefined,
        items: [{ service_id: Number(selectedService.id), quantity: 1 }],
      });
      await chatService.sendInvoiceMessage(Number(conversationId), customerAuthId, {
        invoice_id: invoice.id, invoice_type: 'service', amount: Number(selectedService.price), service: selectedService.name,
        date: selectedDate.toISOString().slice(0, 10), time: selectedTime, location: location.trim() || undefined,
        staff: eligibleStaff.find((member) => String(member.id) === selectedStaff)?.name, status: 'pending',
      });
      router.back();
    } catch (error: any) { Alert.alert('Invoice failed', error?.friendlyMessage || error?.message || 'Could not create invoice.'); }
    finally { setSaving(false); }
  };

  if (loading) return <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}><ActivityIndicator style={styles.loader} color={colors.primary} /></SafeAreaView>;
  return <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
    <View style={styles.header}><TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color={colors.text} /></TouchableOpacity><Text style={[styles.title, { color: colors.text }]}>Service Invoice</Text><View style={{ width: 24 }} /></View>
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>Service</Text>
      <View style={styles.wrap}>{services.map((item) => <TouchableOpacity key={item.id} style={[styles.choice, { borderColor: selectedService?.id === item.id ? colors.primary : colors.border, backgroundColor: selectedService?.id === item.id ? `${colors.primary}18` : colors.surface }]} onPress={() => { setSelectedService(item); setSelectedStaff(null); }}><Text style={{ color: colors.text }}>{item.name}</Text><Text style={{ color: colors.textSecondary }}>{formatCurrency(item.price)}</Text></TouchableOpacity>)}</View>
      <Text style={[styles.label, { color: colors.textSecondary }]}>Date</Text><ScrollView horizontal showsHorizontalScrollIndicator={false}>{dates.map((date) => <TouchableOpacity key={date.toISOString()} style={[styles.date, { backgroundColor: date.toDateString() === selectedDate.toDateString() ? colors.primary : colors.surface }]} onPress={() => setSelectedDate(date)}><Text style={{ color: date.toDateString() === selectedDate.toDateString() ? '#fff' : colors.text }}>{date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' })}</Text></TouchableOpacity>)}</ScrollView>
      <Text style={[styles.label, { color: colors.textSecondary }]}>Available time</Text><View style={styles.wrap}>{slots.map((slot) => <TouchableOpacity key={slot} style={[styles.smallChoice, { backgroundColor: selectedTime === slot ? colors.primary : colors.surface, borderColor: colors.border }]} onPress={() => setSelectedTime(slot)}><Text style={{ color: selectedTime === slot ? '#fff' : colors.text }}>{slot}</Text></TouchableOpacity>)}</View>
      {eligibleStaff.length > 0 && <><Text style={[styles.label, { color: colors.textSecondary }]}>Staff (optional)</Text><View style={styles.wrap}>{eligibleStaff.map((member) => <TouchableOpacity key={member.id} style={[styles.choice, { borderColor: selectedStaff === member.id ? colors.primary : colors.border, backgroundColor: colors.surface }]} onPress={() => setSelectedStaff(String(member.id))}><Text style={{ color: colors.text }}>{member.name}</Text></TouchableOpacity>)}</View></>}
      <TextInput placeholder="Location or service type (optional)" placeholderTextColor={colors.textSecondary} value={location} onChangeText={setLocation} style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]} />
      <TextInput placeholder="Note (optional)" placeholderTextColor={colors.textSecondary} value={note} onChangeText={setNote} style={[styles.input, styles.note, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]} multiline />
      <TouchableOpacity style={[styles.button, { backgroundColor: colors.primary }]} onPress={submit} disabled={saving}><Text style={styles.buttonText}>{saving ? 'Creating...' : selectedService ? `Create ${formatCurrency(selectedService.price)} Invoice` : 'Create Invoice'}</Text></TouchableOpacity>
    </ScrollView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({ container: { flex: 1 }, loader: { flex: 1 }, header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.lg }, title: { fontSize: FontSizes.lg, fontWeight: '700' }, content: { padding: Spacing.lg, gap: Spacing.sm }, label: { fontSize: FontSizes.sm, fontWeight: '700', marginTop: Spacing.sm }, wrap: { gap: Spacing.sm }, choice: { flexDirection: 'row', justifyContent: 'space-between', padding: Spacing.md, borderWidth: 1, borderRadius: BorderRadius.md }, smallChoice: { padding: Spacing.sm, borderWidth: 1, borderRadius: BorderRadius.md }, date: { padding: Spacing.sm, borderRadius: BorderRadius.md, marginRight: Spacing.sm }, input: { borderWidth: 1, borderRadius: BorderRadius.md, padding: Spacing.md, marginTop: Spacing.sm }, note: { minHeight: 80, textAlignVertical: 'top' }, button: { padding: Spacing.md, borderRadius: BorderRadius.md, alignItems: 'center', marginTop: Spacing.md }, buttonText: { color: '#fff', fontWeight: '700' } });
