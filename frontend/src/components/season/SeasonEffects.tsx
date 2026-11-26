import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Dimensions, Easing, StyleSheet, View } from 'react-native';
import { useSeasonTheme } from '../../contexts/SeasonThemeContext';

const GLYPHS: Record<string, string[]> = {
  snow: ['❄', '❅', '❆'],
  hearts: ['💖', '💕', '❤'],
  confetti: ['🎉', '✨', '🎊'],
  stars: ['✨', '🌙', '⭐'],
};
const COUNT = 8;

function Particle({ glyph, left, size, duration, delay, height }: { glyph: string; left: number; size: number; duration: number; delay: number; height: number }) {
  const y = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(y, { toValue: 1, duration, easing: Easing.linear, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [y, duration, delay]);
  const translateY = y.interpolate({ inputRange: [0, 1], outputRange: [-30, height + 30] });
  const opacity = y.interpolate({ inputRange: [0, 0.1, 0.9, 1], outputRange: [0, 0.8, 0.8, 0] });
  return (
    <Animated.Text style={{ position: 'absolute', top: 0, left: `${left}%`, fontSize: size, opacity, transform: [{ translateY }] }}>
      {glyph}
    </Animated.Text>
  );
}

/** Light falling decorations over the whole app. Never blocks touches. */
export function SeasonEffects() {
  const { theme, effectsOn } = useSeasonTheme();
  const height = Dimensions.get('window').height;
  const items = useMemo(() => {
    const g = theme?.effect ? GLYPHS[theme.effect] : null;
    if (!g) return [];
    return Array.from({ length: COUNT }, (_, i) => ({
      id: i, glyph: g[i % g.length], left: (i * 97) % 92, size: 12 + ((i * 7) % 10),
      duration: 12000 + ((i * 3) % 9) * 1000, delay: (i * 1300) % 9000,
    }));
  }, [theme]);

  if (!theme || !effectsOn || items.length === 0) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {items.map((it) => <Particle key={it.id} {...it} height={height} />)}
    </View>
  );
}
