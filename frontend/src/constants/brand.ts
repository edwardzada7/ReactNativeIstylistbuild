import { ImageSourcePropType } from 'react-native';

export const BrandColors = {
  primaryPink: '#F54FBF',
  primaryPurple: '#9B5CFF',
  accentCyan: '#26D7FF',
  backgroundWhite: '#FFFFFF',
  dark: '#111111',
  textPrimary: '#1A1A1A',
  textSecondary: '#6B7280',
  border: '#ECECEC',
};

export const BrandTypography = {
  heading: 'System',
  body: 'System',
};

export const BrandAssets = {
  logo: require('../../assets/images/logo.png') as ImageSourcePropType,
  appImage: require('../../assets/images/app-image.png') as ImageSourcePropType,
  appIcon: require('../../assets/images/app-icon.png') as ImageSourcePropType,
  splashImage: require('../../assets/images/splash-image.png') as ImageSourcePropType,
  splashLogo: require('../../assets/images/splash-logo.png') as ImageSourcePropType,
  favicon: require('../../assets/images/favicon.png') as ImageSourcePropType,
};

export const BrandTheme = {
  colors: BrandColors,
  radii: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    full: 9999,
  },
};
