import React from 'react';
import { Alert, TouchableOpacity, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFavorites } from '../../hooks/useFavorites';
import { favoritesService } from '../../services/favorites.service';
import { Colors } from '../../constants/theme';

/** Heart that saves a provider to the user's favourites. Guests are sent to sign in. */
export function FavoriteButton({ providerAuthId, size = 22, style }: { providerAuthId?: string | null; size?: number; style?: ViewStyle }) {
  const router = useRouter();
  const { isFavorite, toggle, signedIn } = useFavorites();
  if (!favoritesService.isValidId(providerAuthId)) return null;
  const saved = isFavorite(providerAuthId);
  return (
    <TouchableOpacity
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      style={style}
      accessibilityRole="button"
      accessibilityLabel={saved ? 'Remove from favourites' : 'Save to favourites'}
      onPress={(e) => {
        e?.stopPropagation?.();
        if (!signedIn) { router.push('/(auth)/login'); return; }
        toggle(String(providerAuthId)).catch(() => Alert.alert('Could not update favourites', 'Please try again.'));
      }}
    >
      <Ionicons name={saved ? 'heart' : 'heart-outline'} size={size} color={saved ? Colors.error ?? '#E5484D' : '#9CA3AF'} />
    </TouchableOpacity>
  );
}
