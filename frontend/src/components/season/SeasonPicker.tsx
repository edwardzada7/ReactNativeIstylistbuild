import React from 'react';
import { Switch, Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { useSeasonTheme } from '../../contexts/SeasonThemeContext';
import { useTheme } from '../../contexts/ThemeContext';
import { BorderRadius, Colors, FontSizes, Spacing } from '../../constants/theme';

/** Profile setting: Auto (follows the season) / Default / a specific theme, plus the animations switch. */
export function SeasonPicker() {
  const { colors } = useTheme();
  const { themes, choice, setChoice, effectsOn, setEffectsOn, theme } = useSeasonTheme();
  const options = [
    { key: 'auto', label: 'Auto' },
    { key: 'default', label: 'Default' },
    ...themes.map((t) => ({ key: t.key, label: `${t.emoji} ${t.name}` })),
  ];
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.title, { color: colors.text }]}>Seasonal theme</Text>
      <View style={styles.chips}>
        {options.map((o) => {
          const on = choice === o.key;
          return (
            <TouchableOpacity
              key={o.key}
              onPress={() => setChoice(o.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              style={[styles.chip, { borderColor: colors.border, backgroundColor: colors.background }, on && { backgroundColor: Colors.primary, borderColor: Colors.primary }]}
            >
              <Text style={[styles.chipText, { color: colors.text }, on && { color: '#fff' }]}>{o.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {choice === 'auto' && (
        <Text style={[styles.hint, { color: colors.textSecondary }]}>{theme ? `Showing: ${theme.name}` : 'No seasonal theme right now.'}</Text>
      )}
      <View style={styles.row}>
        <Text style={{ color: colors.text, fontSize: FontSizes.md }}>Festive animations</Text>
        <Switch value={effectsOn} onValueChange={setEffectsOn} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: Spacing.lg, marginBottom: Spacing.md, padding: Spacing.md, borderRadius: BorderRadius.lg, borderWidth: 1 },
  title: { fontSize: FontSizes.md, fontWeight: '700', marginBottom: Spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: FontSizes.sm, fontWeight: '600' },
  hint: { fontSize: FontSizes.sm, marginTop: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.md },
});
