import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { BorderRadius, FontSizes, Spacing } from '../src/constants/theme';
import { FavoriteButton, ProfileAvatar, RatingStars, VerifiedBadge, isVerifiedProfile } from '../src/components/common';
import { useTheme } from '../src/contexts/ThemeContext';
import { useFavorites } from '../src/hooks/useFavorites';
import { providerService } from '../src/services/provider.service';
import { screenCache } from '../src/utils/screenCache';
import { Provider } from '../src/types';

/** Saved providers (favourites). Shows the cached provider list at once and refreshes behind it. */
export default function Favorites() {
  const router = useRouter();
  const { colors } = useTheme();
  const { ids, signedIn } = useFavorites();
  const [providers, setProviders] = useState<Provider[]>(() => screenCache.get<Provider[]>('home-providers') || []);
  const [loading, setLoading] = useState(() => !screenCache.get('home-providers'));
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    providerService
      .getProvidersWithServices()
      .then((list) => { if (active) { setProviders(screenCache.set('home-providers', list)); setFailed(false); } })
      .catch(() => { if (active) setFailed(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const saved = useMemo(() => providers.filter((p) => p.user_id && ids.has(String(p.user_id))), [providers, ids]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Go back" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Saved Providers</Text>
        <View style={{ width: 24 }} />
      </View>

      {!signedIn ? (
        <View style={styles.center}>
          <Ionicons name="heart-outline" size={48} color={colors.textMuted} />
          <Text style={[styles.empty, { color: colors.textSecondary }]}>Sign in to save your favourite providers.</Text>
          <TouchableOpacity style={[styles.btn, { backgroundColor: colors.primary }]} onPress={() => router.push('/(auth)/login')}>
            <Text style={styles.btnText}>Sign in</Text>
          </TouchableOpacity>
        </View>
      ) : loading && saved.length === 0 ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : saved.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name={failed ? 'cloud-offline-outline' : 'heart-outline'} size={48} color={colors.textMuted} />
          <Text style={[styles.empty, { color: colors.textSecondary }]}>
            {failed ? "Couldn't load your saved providers. Check your connection." : 'No saved providers yet. Tap the heart on a provider to save them here.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={saved}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ padding: Spacing.md }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.row, { backgroundColor: colors.surface }]}
              onPress={() => router.push(`/provider/${item.id}`)}
              accessibilityRole="button"
              accessibilityLabel={item.business_name}
            >
              <ProfileAvatar uri={item.avatarUrl || item.profile_image_url || (item as any).avatar} name={item.business_name} size={56} type="provider" />
              <View style={{ flex: 1, marginLeft: Spacing.md }}>
                <View style={styles.nameRow}>
                  <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{item.business_name}</Text>
                  <VerifiedBadge verified={isVerifiedProfile(item)} size={14} />
                </View>
                <RatingStars rating={item.rating} count={(item as any).review_count ?? (item as any).ratingCount} size={12} />
              </View>
              <FavoriteButton providerAuthId={item.user_id} />
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingVertical: Spacing.md },
  title: { fontSize: FontSizes.xl, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  empty: { marginTop: Spacing.md, textAlign: 'center', fontSize: FontSizes.md },
  btn: { marginTop: Spacing.lg, paddingHorizontal: 28, paddingVertical: 12, borderRadius: BorderRadius.full ?? 24 },
  btnText: { color: '#fff', fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, borderRadius: BorderRadius.lg, marginBottom: Spacing.sm },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  name: { fontSize: FontSizes.lg, fontWeight: '600', flexShrink: 1 },
});
