import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Colors, FontSizes, Spacing, BorderRadius } from '../../src/constants/theme';
import { useAuth } from '../../src/contexts/AuthContext';
import { providerService } from '../../src/services/provider.service';

const { width } = Dimensions.get('window');
const GAP = Spacing.sm;
const COLS = 3;
const TILE_SIZE = (width - Spacing.lg * 2 - GAP * (COLS - 1)) / COLS;
const MAX_IMAGES = 12;

/**
 * Provider Portfolio (Phase 3A). Reuses the existing `stylists.portfolio`
 * jsonb column directly via Supabase (RLS-verified: provider can read/write
 * only their own row). Images stored as base64 data URIs, per project
 * convention (no external storage/CDN wired up for this).
 */
export default function Portfolio() {
  const router = useRouter();
  const { user } = useAuth();
  const authId = user?.auth_id;

  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    if (!authId) return;
    try {
      const portfolio = await providerService.getPortfolio(authId);
      setImages(portfolio);
    } catch (err) {
      console.error('[portfolio] failed to load', err);
    } finally {
      setLoading(false);
    }
  }, [authId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleAddImage = async () => {
    if (images.length >= MAX_IMAGES) {
      Alert.alert('Limit reached', `You can add up to ${MAX_IMAGES} portfolio photos.`);
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo library access to add portfolio images.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.5,
      base64: true,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled || !result.assets?.[0]?.base64) return;

    const dataUri = `data:image/jpeg;base64,${result.assets[0].base64}`;
    const updated = [...images, dataUri];
    setImages(updated);
    await persist(updated);
  };

  const handleRemoveImage = (index: number) => {
    Alert.alert('Remove photo', 'Remove this photo from your portfolio?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const updated = images.filter((_, i) => i !== index);
          setImages(updated);
          await persist(updated);
        },
      },
    ]);
  };

  const persist = async (updated: string[]) => {
    if (!authId) return;
    setSaving(true);
    try {
      await providerService.updatePortfolio(authId, updated);
    } catch (err: any) {
      Alert.alert('Error', 'Could not save your portfolio. Please try again.');
      console.error('[portfolio] save failed', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Portfolio</Text>
        {saving ? <ActivityIndicator size="small" color={Colors.primary} /> : <View style={{ width: 24 }} />}
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.hint}>
            Showcase your best work. Customers see these photos on your public profile.
          </Text>
          <View style={styles.grid}>
            {images.map((img, index) => (
              <TouchableOpacity
                key={index}
                style={styles.tile}
                onLongPress={() => handleRemoveImage(index)}
                accessibilityRole="button"
                accessibilityLabel={`Portfolio photo ${index + 1}, long press to remove`}
              >
                <Image source={{ uri: img }} style={styles.tileImage} />
                <TouchableOpacity style={styles.removeBadge} onPress={() => handleRemoveImage(index)} accessibilityLabel="Remove photo">
                  <Ionicons name="close" size={14} color="#fff" />
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
            {images.length < MAX_IMAGES && (
              <TouchableOpacity style={styles.addTile} onPress={handleAddImage} accessibilityRole="button" accessibilityLabel="Add portfolio photo">
                <Ionicons name="add" size={28} color={Colors.primary} />
                <Text style={styles.addTileText}>Add Photo</Text>
              </TouchableOpacity>
            )}
          </View>
          {images.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="images-outline" size={32} color={Colors.textMuted} />
              <Text style={styles.emptyText}>No portfolio photos yet. Tap &quot;Add Photo&quot; to get started.</Text>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centerState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  title: { fontSize: FontSizes.lg, fontWeight: 'bold', color: Colors.text },
  content: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl },
  hint: { fontSize: FontSizes.sm, color: Colors.textSecondary, marginBottom: Spacing.lg, lineHeight: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  tile: { width: TILE_SIZE, height: TILE_SIZE, borderRadius: BorderRadius.md, overflow: 'hidden' },
  tileImage: { width: '100%', height: '100%' },
  removeBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addTile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  addTileText: { fontSize: FontSizes.xs, color: Colors.primary, fontWeight: '600' },
  emptyState: { alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.xxl },
  emptyText: { fontSize: FontSizes.sm, color: Colors.textSecondary, textAlign: 'center', paddingHorizontal: Spacing.xl },
});
