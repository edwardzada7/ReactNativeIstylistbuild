import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
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

const FALLBACK_AVATAR = require('../../../assets/images/app-icon.png');

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
        <>
          <Image
            source={FALLBACK_AVATAR}
            style={{ width: size, height: size, borderRadius: size / 2 }}
            contentFit="cover"
          />
          <View style={[styles.fallbackIcon, { width: size, height: size, borderRadius: size / 2 }]}>
            <Ionicons name="person" size={size * 0.48} color="#ffffff" />
          </View>
        </>
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
