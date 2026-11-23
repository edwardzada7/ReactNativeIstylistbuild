import React, { useEffect, useState } from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, FontSizes, Spacing } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import { fetchAreas, ServiceArea } from '../../services/location.service';

let areaCache: ServiceArea[] | null = null;

/** Shows the user's current area; tapping opens their profile with the area picker ready. */
export function LocationChip({ target }: { target: '/(tabs)/profile' | '/(provider)/profile' }) {
  const router = useRouter();
  const { user } = useAuth();
  const [areas, setAreas] = useState<ServiceArea[]>(areaCache || []);
  const areaId = (user as any)?.area_id ?? null;

  useEffect(() => {
    if (areaCache) return;
    fetchAreas()
      .then((list) => {
        areaCache = list;
        setAreas(list);
      })
      .catch(() => {});
  }, []);

  const area = areaId ? areas.find((a) => String(a.id) === String(areaId)) : null;
  const label = area ? `${area.name}, ${area.city}` : areaId ? 'Your location' : 'Set your location';
  const unset = !areaId;

  return (
    <TouchableOpacity
      onPress={() => router.push({ pathname: target, params: { pickArea: '1' } })}
      accessibilityRole="button"
      accessibilityLabel="Change your location"
      style={[styles.chip, unset ? styles.unset : styles.set]}
    >
      <Ionicons name="location" size={14} color={unset ? Colors.warning : Colors.primary} />
      <Text numberOfLines={1} style={[styles.text, { color: unset ? Colors.warning : Colors.primary }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4, paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: 999, borderWidth: 1, marginTop: 4, maxWidth: 240 },
  set: { borderColor: `${Colors.primary}40`, backgroundColor: `${Colors.primary}10` },
  unset: { borderColor: `${Colors.warning}60`, backgroundColor: `${Colors.warning}15` },
  text: { fontSize: FontSizes.xs ?? 12, fontWeight: '600', flexShrink: 1 },
});
