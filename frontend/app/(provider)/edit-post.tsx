import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors, FontSizes, Spacing, BorderRadius } from '../../src/constants/theme';
import { feedService } from '../../src/services/feed.service';
import { useAuth } from '../../src/contexts/AuthContext';
import { useTheme } from '../../src/contexts/ThemeContext';

export default function EditPost() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { colors } = useTheme();
  const [caption, setCaption] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // For now, we'll just initialize with empty state
    // In a real implementation, we'd fetch the post details
    setLoading(false);
  }, [id]);

  const handleUpdate = async () => {
    if (!image) {
      Alert.alert('Image required', 'Please add an image to your post.');
      return;
    }
    if (!user?.auth_id) {
      Alert.alert('Authentication required', 'Please log in to edit a post.');
      return;
    }
    setSaving(true);
    try {
      await feedService.updatePost(id, caption.trim(), image);
      Alert.alert('Success', 'Your post has been updated!', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err?.friendlyMessage || 'Could not update post.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Edit Post</Text>
        <TouchableOpacity
          onPress={handleUpdate}
          style={[styles.postButton, { backgroundColor: colors.primary }, (!image || saving) && { backgroundColor: colors.textMuted }]}
          disabled={!image || saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color={colors.text} />
          ) : (
            <Text style={[styles.postButtonText, { color: colors.text }]}>Update</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={styles.imageContainer}>
          {image ? (
            <Image source={{ uri: image }} style={styles.image} />
          ) : (
            <TouchableOpacity style={[styles.imagePlaceholder, { backgroundColor: colors.surface }]} onPress={() => {}}>
              <Ionicons name="image-outline" size={48} color={colors.textMuted} />
              <Text style={[styles.placeholderText, { color: colors.textMuted }]}>Add Photo</Text>
            </TouchableOpacity>
          )}
        </View>

        <TextInput
          style={[styles.captionInput, { color: colors.text }]}
          placeholder="Write a caption..."
          placeholderTextColor={colors.textMuted}
          multiline
          value={caption}
          onChangeText={setCaption}
          maxLength={2000}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: Spacing.sm,
  },
  headerTitle: {
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
  },
  postButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  postButtonText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: Spacing.lg,
  },
  imageContainer: {
    marginBottom: Spacing.lg,
  },
  image: {
    width: '100%',
    height: 300,
    borderRadius: BorderRadius.lg,
  },
  imagePlaceholder: {
    width: '100%',
    height: 300,
    borderRadius: BorderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  placeholderText: {
    fontSize: FontSizes.sm,
  },
  captionInput: {
    fontSize: FontSizes.md,
    minHeight: 100,
    textAlignVertical: 'top',
  },
});
