import React, { useEffect, useState } from 'react';
import { View, Image, StyleSheet, ViewStyle } from 'react-native';
import { withCacheBuster } from '../../utils/display';

interface ProfileAvatarProps {
  uri?: string | null;
  name?: string;
  size?: number;
  style?: ViewStyle;
  type?: 'customer' | 'provider';
}

const PLACEHOLDER_AVATAR = 'https://via.placeholder.com/150';

export const ProfileAvatar: React.FC<ProfileAvatarProps> = ({
  uri,
  name,
  size = 48,
  style,
}) => {
  const [imageUri, setImageUri] = useState<string>(() => withCacheBuster(uri || PLACEHOLDER_AVATAR) || PLACEHOLDER_AVATAR);

  useEffect(() => {
    setImageUri(withCacheBuster(uri || PLACEHOLDER_AVATAR) || PLACEHOLDER_AVATAR);
  }, [uri]);

  return (
    <View style={[styles.container, { width: size, height: size, borderRadius: size / 2 }, style]}>
      <Image
        source={{ uri: imageUri || PLACEHOLDER_AVATAR }}
        style={[styles.image, { width: size, height: size, borderRadius: size / 2 }]}
        onError={() => setImageUri(PLACEHOLDER_AVATAR)}
      />
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
