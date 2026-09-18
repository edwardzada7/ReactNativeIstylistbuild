import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, FontSizes, Spacing, BorderRadius } from '../../src/constants/theme';
import { Button } from '../../src/components/common';
import { useAuth } from '../../src/contexts/AuthContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { providerService } from '../../src/services/provider.service';
import { DayAvailability } from '../../src/types';

const DEFAULT_DAYS: DayAvailability[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
].map((day) => ({
  day: day as DayAvailability['day'],
  is_open: !['saturday', 'sunday'].includes(day),
  open_time: '09:00',
  close_time: '18:00',
}));

export default function ProviderAvailability() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  const providerId = user?.id;

  const [days, setDays] = useState<DayAvailability[]>(DEFAULT_DAYS);
  const [blockedDateInput, setBlockedDateInput] = useState('');
  const [blockedDates, setBlockedDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    if (!providerId) return;
    try {
      const existing = await providerService.getProviderAvailability(providerId);
      if (existing && existing.days.length > 0) {
        setDays(existing.days);
        setBlockedDates(existing.blocked_dates || []);
      }
    } catch {
      // Fall back to defaults - the read endpoint isn't confirmed to exist.
    } finally {
      setLoading(false);
    }
  }, [providerId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const toggleDay = (day: string) => {
    setDays((prev) => prev.map((d) => (d.day === day ? { ...d, is_open: !d.is_open } : d)));
  };

  const updateTime = (day: string, field: 'open_time' | 'close_time', value: string) => {
    setDays((prev) => prev.map((d) => (d.day === day ? { ...d, [field]: value } : d)));
  };

  const addBlockedDate = () => {
    const value = blockedDateInput.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      Alert.alert('Invalid date', 'Please use YYYY-MM-DD format, e.g. 2025-08-25.');
      return;
    }
    if (blockedDates.includes(value)) return;
    setBlockedDates((prev) => [...prev, value]);
    setBlockedDateInput('');
  };

  const removeBlockedDate = (date: string) => {
    setBlockedDates((prev) => prev.filter((d) => d !== date));
  };

  const handleSave = async () => {
    if (!providerId) return;
    setSaving(true);
    try {
      await providerService.setProviderAvailability(providerId, { days, blocked_dates: blockedDates });
      Alert.alert('Saved', 'Your availability has been updated. Customers will see it immediately.');
    } catch (err: any) {
      Alert.alert('Error', err?.friendlyMessage || 'Could not save availability.');
    } finally {
      setSaving(false);
    }
  };

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
        <Text style={[styles.title, { color: colors.text }]}>Availability</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Working Days & Hours</Text>
        {days.map((d) => (
          <View key={d.day} style={[styles.dayRow, { backgroundColor: colors.surface }]}>
            <View style={styles.dayHeader}>
              <Text style={[styles.dayName, { color: colors.text }]}>
                {d.day.charAt(0).toUpperCase() + d.day.slice(1)}
              </Text>
              <Switch
                value={d.is_open}
                onValueChange={() => toggleDay(d.day)}
                trackColor={{ false: colors.border, true: Colors.primary }}
              />
            </View>
            {d.is_open && (
              <View style={styles.timeRow}>
                <View style={styles.timeInputWrap}>
                  <Text style={[styles.timeLabel, { color: colors.textSecondary }]}>Opens</Text>
                  <TextInput
                    style={[styles.timeInput, { backgroundColor: colors.surfaceLight, color: colors.text }]}
                    value={d.open_time}
                    onChangeText={(v) => updateTime(d.day, 'open_time', v)}
                    placeholder="09:00"
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>
                <View style={styles.timeInputWrap}>
                  <Text style={[styles.timeLabel, { color: colors.textSecondary }]}>Closes</Text>
                  <TextInput
                    style={[styles.timeInput, { backgroundColor: colors.surfaceLight, color: colors.text }]}
                    value={d.close_time}
                    onChangeText={(v) => updateTime(d.day, 'close_time', v)}
                    placeholder="18:00"
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>
              </View>
            )}
          </View>
        ))}

        <Text style={[styles.sectionTitle, { marginTop: Spacing.lg, color: colors.text }]}>Blocked Dates</Text>
        <View style={styles.blockedInputRow}>
          <TextInput
            style={[styles.blockedInput, { backgroundColor: colors.surfaceLight, color: colors.text }]}
            value={blockedDateInput}
            onChangeText={setBlockedDateInput}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.textSecondary}
          />
          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: colors.surface }]}
            onPress={addBlockedDate}
            accessibilityRole="button"
            accessibilityLabel="Add blocked date"
          >
            <Ionicons name="add" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>
        {blockedDates.length === 0 ? (
          <Text style={[styles.emptyInline, { color: colors.textSecondary }]}>No blocked dates yet.</Text>
        ) : (
          <View style={styles.blockedList}>
            {blockedDates.map((date) => (
              <View key={date} style={[styles.blockedChip, { backgroundColor: colors.surfaceLight }]}>
                <Text style={[styles.blockedChipText, { color: colors.text }]}>{date}</Text>
                <TouchableOpacity
                  onPress={() => removeBlockedDate(date)}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${date}`}
                >
                  <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <View style={{ height: Spacing.xl }} />
        <Button title="Save Availability" onPress={handleSave} loading={saving} fullWidth size="large" />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  title: { fontSize: FontSizes.xxl, fontWeight: 'bold' },
  content: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl },
  sectionTitle: { fontSize: FontSizes.md, fontWeight: '700', marginBottom: Spacing.sm },
  dayRow: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  dayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dayName: { fontSize: FontSizes.sm, fontWeight: '600' },
  timeRow: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.sm },
  timeInputWrap: { flex: 1 },
  timeLabel: { fontSize: FontSizes.xs, marginBottom: 4 },
  timeInput: {
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    fontSize: FontSizes.sm,
  },
  blockedInputRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
  blockedInput: {
    flex: 1,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: FontSizes.sm,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyInline: { fontSize: FontSizes.sm },
  blockedList: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  blockedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
  },
  blockedChipText: { fontSize: FontSizes.xs },
});
