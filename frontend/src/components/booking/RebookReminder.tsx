import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { storage } from '@/src/utils/storage';
import { Colors, FontSizes, Spacing, BorderRadius } from '../../constants/theme';
import { useTheme } from '../../contexts/ThemeContext';
import { ProfileAvatar } from '../common/ProfileAvatar';
import { Booking } from '../../types';

const DISMISSED_KEY = 'rebook_reminders_dismissed';
const REMIND_AFTER_DAYS = 21;
const DAY_MS = 24 * 60 * 60 * 1000;
const ACTIVE = ['pending_payment', 'pending', 'confirmed'];

/**
 * In-app nudge: "It's been N weeks since your visit with X - rebook?"
 * Shows for the most recent completed booking older than 3 weeks when the
 * customer has nothing upcoming with that stylist. Dismissal is remembered
 * per booking on the device.
 */
export function RebookReminder({ bookings }: { bookings: Booking[] }) {
  const router = useRouter();
  const { colors } = useTheme();
  const [dismissed, setDismissed] = useState<string[] | null>(null);

  useEffect(() => {
    storage.getItem(DISMISSED_KEY, '[]').then((saved) => {
      try {
        const parsed = JSON.parse(String(saved ?? '[]'));
        setDismissed(Array.isArray(parsed) ? parsed.map(String) : []);
      } catch {
        setDismissed([]);
      }
    });
  }, []);

  const candidate = useMemo(() => {
    if (!dismissed) return null;
    const now = Date.now();
    const visitTime = (b: Booking) => new Date(b.scheduled_at || b.date || b.created_at).getTime();
    return [...bookings]
      .filter((b) => b.status === 'completed' && b.provider_id && !dismissed.includes(String(b.id)))
      .sort((a, b) => visitTime(b) - visitTime(a))
      .find((b) => {
        const age = now - visitTime(b);
        if (!Number.isFinite(age) || age < REMIND_AFTER_DAYS * DAY_MS) return false;
        return !bookings.some((o) => String(o.provider_id) === String(b.provider_id) && ACTIVE.includes(o.status));
      }) || null;
  }, [bookings, dismissed]);

  if (!candidate) return null;

  const weeks = Math.max(3, Math.floor((Date.now() - new Date(candidate.scheduled_at || candidate.date).getTime()) / (7 * DAY_MS)));

  const dismiss = () => {
    const next = [...(dismissed || []), String(candidate.id)];
    setDismissed(next);
    storage.setItem(DISMISSED_KEY, JSON.stringify(next)).catch(() => undefined);
  };

  const rebook = () =>
    router.push({
      pathname: '/booking/[providerId]',
      params: candidate.service_id
        ? { providerId: String(candidate.provider_id), serviceId: String(candidate.service_id) }
        : { providerId: String(candidate.provider_id) },
    });

  return (
    <View testID="rebook-reminder" style={[styles.card, { backgroundColor: colors.surface, borderColor: `${Colors.primary}40` }]}>
      <ProfileAvatar uri={candidate.provider_avatar} name={candidate.provider_name} size={48} type="provider" />
      <View style={styles.body}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>Time for a refresh?</Text>
        <Text style={[styles.text, { color: colors.textSecondary }]} numberOfLines={2}>
          It's been {weeks} weeks since your {candidate.service_name || 'visit'} with {candidate.provider_name}.
        </Text>
        <TouchableOpacity testID="rebook-reminder-book" style={[styles.cta, { backgroundColor: Colors.primary }]} onPress={rebook} accessibilityRole="button">
          <Ionicons name="refresh" size={14} color="#fff" />
          <Text style={styles.ctaText}>Rebook now</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity testID="rebook-reminder-dismiss" onPress={dismiss} style={styles.close} accessibilityRole="button" accessibilityLabel="Dismiss reminder">
        <Ionicons name="close" size={18} color={colors.textSecondary} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', gap: Spacing.md, marginHorizontal: Spacing.lg, marginBottom: Spacing.lg, padding: Spacing.md, borderRadius: BorderRadius.lg, borderWidth: 1 },
  body: { flex: 1 },
  title: { fontSize: FontSizes.md, fontWeight: '700' },
  text: { fontSize: FontSizes.sm, marginTop: 2, lineHeight: 18 },
  cta: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, marginTop: Spacing.sm, height: 36, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.full },
  ctaText: { color: '#fff', fontSize: FontSizes.sm, fontWeight: '700' },
  close: { padding: 4, alignSelf: 'flex-start' },
});
