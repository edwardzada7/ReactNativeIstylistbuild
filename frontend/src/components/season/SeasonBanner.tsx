import React, { useEffect, useState } from 'react';
import { Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useSeasonTheme } from '../../contexts/SeasonThemeContext';
import { BorderRadius, FontSizes, Spacing } from '../../constants/theme';

/** Festive greeting card for the home screens (dismissible for the day). */
export function SeasonBanner() {
  const { theme } = useSeasonTheme();
  const [hidden, setHidden] = useState(false);
  const key = theme ? `@season_banner_${theme.key}_${new Date().toISOString().slice(0, 10)}` : '';

  useEffect(() => {
    if (!key) return;
    AsyncStorage.getItem(key).then((v) => setHidden(v === '1')).catch(() => {});
  }, [key]);

  if (!theme || hidden) return null;
  const a = theme.primary['600'] || '#9B5CFF';
  const b = theme.secondary['600'] || '#F54FBF';
  return (
    <LinearGradient colors={[a, b]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
      <TouchableOpacity
        style={styles.close}
        onPress={() => { setHidden(true); void AsyncStorage.setItem(key, '1'); }}
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
      >
        <Ionicons name="close" size={16} color="#fff" />
      </TouchableOpacity>
      <View style={{ paddingRight: 28 }}>
        <Text style={styles.title}>{theme.banner_title}</Text>
        <Text style={styles.text}>{theme.banner_text}</Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: Spacing.lg, marginVertical: Spacing.md, borderRadius: BorderRadius.lg, padding: Spacing.md },
  close: { position: 'absolute', top: 8, right: 8, width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  title: { color: '#fff', fontSize: FontSizes.md, fontWeight: '700' },
  text: { color: '#fff', fontSize: FontSizes.sm, marginTop: 4, opacity: 0.95 },
});
