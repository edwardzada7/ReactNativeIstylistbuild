import React from 'react';
import { View, ActivityIndicator, StyleSheet, Text, Image } from 'react-native';
import { Colors, FontSizes, Spacing } from '../../constants/theme';
import { BrandAssets } from '../../constants/brand';

interface LoadingProps {
  text?: string;
  fullScreen?: boolean;
}

export const Loading: React.FC<LoadingProps> = ({ text, fullScreen = true }) => {
  return (
    <View style={[styles.container, fullScreen && styles.fullScreen]}>
      <Image source={BrandAssets.logo} style={styles.logo} resizeMode="contain" />
      <ActivityIndicator size="large" color={Colors.primary} />
      {text ? <Text style={styles.text}>{text}</Text> : <Text style={styles.text}>Loading iStylist</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  fullScreen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  text: {
    marginTop: 16,
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
  },
});