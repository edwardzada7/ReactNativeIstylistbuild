import React from 'react';
import { Image, ImageStyle, StyleProp, ViewStyle } from 'react-native';
import { BrandAssets } from '../../constants/brand';

interface BrandLogoProps {
  size?: number;
  style?: StyleProp<ImageStyle>;
  containerStyle?: StyleProp<ViewStyle>;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({ size = 96, style, containerStyle }) => {
  return (
    <Image
      source={BrandAssets.logo}
      style={[{ width: size, height: size }, style]}
      resizeMode="contain"
    />
  );
};
