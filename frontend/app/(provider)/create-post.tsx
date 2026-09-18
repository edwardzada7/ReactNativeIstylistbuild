import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Colors, FontSizes, Spacing, BorderRadius } from '../../src/constants/theme';
import { Button, Input } from '../../src/components/common';
import { useAuth } from '../../src/contexts/AuthContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { feedService } from '../../src/services/feed.service';

export default function CreatePost() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  const [caption, setCaption] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'photo' | 'video'>('photo');
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo library access to add media.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      quality: 0.8,
      base64: true,
      allowsEditing: true,
      aspect: [1, 1],
    });
    const asset = result.assets?.[0];
    if (result.canceled || !asset?.base64) return;
    const selectedType = asset.type === 'video' ? 'video' : 'photo';
    const duration = asset.duration ? asset.duration / 1000 : null;
    if (selectedType === 'video' && (!duration || duration <= 0 || duration > 10)) {
      Alert.alert('Video too long', 'Feed videos must be between 1 and 10 seconds.');
      return;
    }
    setMediaType(selectedType);
    setVideoDuration(duration);
    setImage(`data:${selectedType === 'video' ? 'video/mp4' : 'image/jpeg'};base64,${asset.base64}`);
  };

  const handleCreate = async () => {
    if (!image) {
      Alert.alert('Photo required', 'Please add a photo to your post.');
      return;
    }
    if (!user?.auth_id) {
      Alert.alert('Authentication required', 'Please log in to create a post.');
      return;
    }
    setSaving(true);
    try {
      await feedService.createPost(caption.trim(), image, { type: mediaType, url: image, durationSeconds: videoDuration || undefined });
      Alert.alert('Success', 'Your post has been published!', [
        { text: 'OK', onPress: () => {
          // Navigate back to Provider Feed
          router.replace('/(provider)/feed');
        }},
      ]);
    } catch (err: any) {
      Alert.alert('Error', err?.friendlyMessage || 'Could not create post.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Create Post</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <TouchableOpacity style={[styles.imagePicker, { borderColor: colors.border }]} onPress={pickImage}>
            {image ? (
              <Image source={{ uri: image }} style={styles.imagePreview} />
            ) : (
              <>
                <Ionicons name="camera-outline" size={48} color={colors.primary} />
                <Text style={[styles.imagePickerText, { color: colors.primary }]}>Add Photo</Text>
              </>
            )}
          </TouchableOpacity>

          <Input
            label="Caption (optional)"
            value={caption}
            onChangeText={setCaption}
            placeholder="Share your work with the community..."
            multiline
            numberOfLines={4}
            style={{ minHeight: 100, textAlignVertical: 'top' }}
          />

          <Button
            title="Publish Post"
            onPress={handleCreate}
            loading={saving}
            fullWidth
            size="large"
            style={{ marginTop: Spacing.md }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  title: { fontSize: FontSizes.lg, fontWeight: 'bold' },
  content: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl },
  imagePicker: {
    width: '100%',
    height: 300,
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    overflow: 'hidden',
  },
  imagePreview: { width: '100%', height: '100%' },
  imagePickerText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    marginTop: Spacing.sm,
  },
});
