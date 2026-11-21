import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { withCacheBuster } from '../../utils/display';

interface ProfileAvatarProps {
  uri?: string | null;
  name?: string;
  size?: number;
  style?: ViewStyle;
  type?: 'customer' | 'provider';
}

const AVATAR_COLORS = ['#7c5cfc', '#f43fa5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
const initialsOf = (name?: string) => {
  const parts = (name || '').trim().split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w));
  if (!parts.length) return '';
  const letters = (parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[1][0]).replace(/[^A-Za-z0-9]/g, '');
  return letters.toUpperCase();
};
const colorFor = (name?: string) => {
  let hash = 0;
  for (const ch of name || '') hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
};

// expo-image caches to memory + disk and decodes off the UI thread, so lists of
// avatars scroll smoothly and photos are not re-downloaded on every mount (the
// plain react-native Image re-fetched and re-decoded them each time).
export const ProfileAvatar: React.FC<ProfileAvatarProps> = ({
  uri,
  name,
  size = 48,
  style,
}) => {
  const [imageUri, setImageUri] = useState<string | null>(() => withCacheBuster(uri));
  const [imageError, setImageError] = useState(!uri);

  useEffect(() => {
    setImageUri(withCacheBuster(uri));
    setImageError(!uri);
  }, [uri]);

  return (
    <View style={[styles.container, { width: size, height: size, borderRadius: size / 2 }, style]}>
      {imageError || !imageUri ? (
        <View style={[styles.fallbackIcon, { position: 'relative', width: size, height: size, borderRadius: size / 2, backgroundColor: initialsOf(name) ? colorFor(name) : '#7c5cfc' }]}>
          {initialsOf(name) ? (
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: size * 0.38 }}>{initialsOf(name)}</Text>
          ) : (
            <Ionicons name="person" size={size * 0.48} color="#ffffff" />
          )}
        </View>
      ) : (
        <Image
          source={{ uri: imageUri }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          contentFit="cover"
          cachePolicy="memory-disk"
          recyclingKey={imageUri}
          transition={120}
          onError={() => setImageError(true)}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  fallbackIcon: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#7c5cfc',
  },
});
