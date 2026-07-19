import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, FontSizes, Spacing } from '../../src/constants/theme';
import { legalService } from '../../src/services/legal.service';

/**
 * Terms of Service (Phase 3A). Real content fetched from the production
 * `legal_pages` table via GET /api/legal/terms - no more static/hardcoded
 * copy.
 */
export default function Terms() {
  const router = useRouter();
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    legalService
      .getTerms()
      .then((page) => setContent(page.content.replace('{{TODAY}}', new Date().toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' }))))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Terms of Service</Text>
        <View style={{ width: 24 }} />
      </View>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.paragraph}>Could not load Terms of Service. Please try again later.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {content.split(/\r?\n/).map((line, i) => {
            if (!line.trim()) return null;
            if (line.startsWith('## ')) return <Text key={i} style={styles.heading2}>{line.replace('## ', '')}</Text>;
            if (line.startsWith('# ')) return <Text key={i} style={styles.heading1}>{line.replace('# ', '')}</Text>;
            if (line.startsWith('- ')) return <Text key={i} style={styles.bullet}>{'\u2022  '}{line.replace('- ', '')}</Text>;
            return <Text key={i} style={styles.paragraph}>{line.replace(/^_|_$/g, '')}</Text>;
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: Spacing.xl },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  title: { fontSize: FontSizes.lg, fontWeight: 'bold', color: Colors.text },
  content: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl },
  heading1: { fontSize: FontSizes.lg, fontWeight: '800', color: Colors.text, marginTop: Spacing.md, marginBottom: Spacing.sm },
  heading2: { fontSize: FontSizes.md, fontWeight: '700', color: Colors.text, marginTop: Spacing.lg, marginBottom: Spacing.sm },
  bullet: { fontSize: FontSizes.sm, color: Colors.textSecondary, lineHeight: 21, marginBottom: 4 },
  paragraph: { fontSize: FontSizes.sm, color: Colors.textSecondary, lineHeight: 21, marginBottom: Spacing.sm },
});
