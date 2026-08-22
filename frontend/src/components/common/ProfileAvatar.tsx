import React, { useEffect, useState } from 'react';
import { View, Image, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { withCacheBuster } from '../../utils/display';

interface ProfileAvatarProps {
  uri?: string | null;
  name?: string;
  size?: number;
  style?: ViewStyle;
  type?: 'customer' | 'provider';
}

export const ProfileAvatar: React.FC<ProfileAvatarProps> = ({
  uri,
  name,
  size = 48,
  style,
  type = 'customer',
}) => {
  const { colors } = useTheme();
  const iconName = type === 'provider' ? 'storefront' : 'person-circle-outline';
  const iconSize = size * 0.6;
  const [imageUri, setImageUri] = useState<string | null>(() => withCacheBuster(uri));

  useEffect(() => {
    setImageUri(withCacheBuster(uri));
  }, [uri]);

  return (
    <View style={[styles.container, { width: size, height: size, borderRadius: size / 2 }, style]}>
      {imageUri ? (
        <Image
          source={{ uri: imageUri }}
          style={[styles.image, { width: size, height: size, borderRadius: size / 2 }]}
          onError={() => {
            // Image loading failed - will show fallback
          }}
        />
      ) : (
        <Ionicons name={iconName as any} size={iconSize} color={colors.primary} />
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
  image: {
    resizeMode: 'cover',
  },
});
