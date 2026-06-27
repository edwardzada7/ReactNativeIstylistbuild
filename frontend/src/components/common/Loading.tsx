import React from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { Colors, FontSizes } from '../../constants/theme';

interface LoadingProps {
  text?: string;
  fullScreen?: boolean;
}

export const Loading: React.FC<LoadingProps> = ({ text, fullScreen = true }) => {
  return (
    <View style={[styles.container, fullScreen && styles.fullScreen]}>
      <ActivityIndicator size="large" color={Colors.primary} />
      {text && <Text style={styles.text}>{text}</Text>}
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