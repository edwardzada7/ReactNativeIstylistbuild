import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, FontSizes, Spacing, BorderRadius } from '../../constants/theme';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { promoService, SponsoredItem } from '../../services/promo.service';
import { formatCurrency } from '../../utils/currency';
import { ProBadge } from './ProBadge';

/** Boosted profiles, services or products. Always labelled "Sponsored"; renders nothing when there are none. */
export function SponsoredStrip({ types, title = 'Sponsored' }: { types: string; title?: string }) {
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuth();
  const [items, setItems] = useState<SponsoredItem[]>([]);
  const areaId = Number((user as any)?.area_id) || null;

  useEffect(() => {
    let cancelled = false;
    promoService.getSponsored(types, 6, areaId).then((list) => !cancelled && setItems(list));
    return () => {
      cancelled = true;
    };
  }, [types, areaId]);

  if (!items.length) return null;

  const open = (i: SponsoredItem) => {
    if (i.type === 'product') router.push(`/shop/${i.target_id}` as any);
    else if (i.type === 'post') router.push('/(tabs)/feed' as any);
    else router.push(`/provider/${i.provider_id}` as any);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.titleRow}>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.ad, { color: colors.textSecondary, backgroundColor: colors.surface }]}>Ad</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: Spacing.lg, gap: Spacing.sm }}>
        {items.map((i) => (
          <TouchableOpacity
            key={String(i.promotion_id)}
            onPress={() => open(i)}
            accessibilityRole="button"
            accessibilityLabel={`Sponsored: ${i.title || i.provider_name || ''}`}
            style={[styles.card, { backgroundColor: colors.surface }]}
          >
            {i.image ? (
              <Image source={{ uri: i.image }} style={styles.image} />
            ) : (
              <View style={[styles.image, { backgroundColor: colors.border }]} />
            )}
            <View style={{ padding: Spacing.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text numberOfLines={1} style={[styles.name, { color: colors.text, flexShrink: 1 }]}>{i.title || i.provider_name}</Text>
                <ProBadge pro={i.is_pro} />
              </View>
              <Text numberOfLines={1} style={[styles.sub, { color: colors.textSecondary }]}>
                {i.type === 'service' || i.type === 'product'
                  ? `${i.price != null ? `${formatCurrency(Number(i.price))} · ` : ''}${i.provider_name || ''}`
                  : i.city || 'Provider'}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: Spacing.lg },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: Spacing.lg, marginBottom: Spacing.sm },
  title: { fontSize: FontSizes.lg ?? 18, fontWeight: '700' },
  ad: { fontSize: 10, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden', textTransform: 'uppercase' },
  card: { width: 160, borderRadius: BorderRadius.lg, overflow: 'hidden' },
  image: { width: 160, height: 96 },
  name: { fontSize: FontSizes.sm ?? 14, fontWeight: '600' },
  sub: { fontSize: FontSizes.xs ?? 12, marginTop: 2 },
});
