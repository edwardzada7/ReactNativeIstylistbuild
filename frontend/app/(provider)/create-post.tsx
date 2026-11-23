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
import { MAX_PHOTOS, mediaService } from '../../src/services/media.service';

export default function CreatePost() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  const [caption, setCaption] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [videoUri, setVideoUri] = useState<string | null>(null);
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
      quality: 0.7,
      allowsMultipleSelection: true,
      selectionLimit: MAX_PHOTOS - images.length > 0 ? MAX_PHOTOS - images.length : 1,
      orderedSelection: true,
    });
    if (result.canceled || !result.assets?.length) return;
    const video = result.assets.find((a) => a.type === 'video');
    if (video) {
      const duration = video.duration ? video.duration / 1000 : null;
      if (!duration || duration <= 0 || duration > 10) {
        Alert.alert('Video too long', 'Feed videos must be between 1 and 10 seconds.');
        return;
      }
      setMediaType('video');
      setVideoDuration(duration);
      setVideoUri(video.uri);
      setImages([]);
      return;
    }
    setMediaType('photo');
    setVideoUri(null);
    setImages((current) => [...current, ...result.assets.map((a) => a.uri)].slice(0, MAX_PHOTOS));
  };

  const handleCreate = async () => {
    if (!images.length && !videoUri) {
      Alert.alert('Photo required', 'Please add at least one photo or a short video to your post.');
      return;
    }
    if (!user?.auth_id) {
      Alert.alert('Authentication required', 'Please log in to create a post.');
      return;
    }
    setSaving(true);
    try {
      if (videoUri) {
        const url = await mediaService.upload(videoUri, user.auth_id, 'posts', 'video');
        await feedService.createPost(caption.trim(), undefined, { type: 'video', url, durationSeconds: videoDuration || undefined });
      } else {
        const urls = await mediaService.uploadMany(images, user.auth_id, 'posts');
        await feedService.createPost(caption.trim(), urls[0], { type: 'photo', urls });
      }
      Alert.alert('Success', 'Your post has been published!', [
        { text: 'OK', onPress: () => router.replace('/(provider)/feed') },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err?.friendlyMessage || err?.message || 'Could not create post.');
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

      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.md }}>
            {images.map((uri, i) => (
              <View key={uri + i} style={{ marginRight: 10 }}>
                <Image source={{ uri }} style={{ width: 110, height: 110, borderRadius: BorderRadius.md }} />
                <TouchableOpacity
                  style={{ position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12 }}
                  onPress={() => setImages((c) => c.filter((_, idx) => idx !== i))}
                  accessibilityLabel="Remove photo"
                >
                  <Ionicons name="close" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
            {videoUri ? (
              <View style={[styles.imagePicker, { borderColor: colors.border, width: 150, height: 110, marginRight: 10 }]}>
                <Ionicons name="videocam" size={36} color={colors.primary} />
                <Text style={{ color: colors.textSecondary, marginTop: 4 }}>Video ready</Text>
                <TouchableOpacity style={{ position: 'absolute', top: 4, right: 4 }} onPress={() => { setVideoUri(null); setMediaType('photo'); }} accessibilityLabel="Remove video">
                  <Ionicons name="close-circle" size={22} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            ) : images.length < MAX_PHOTOS ? (
              <TouchableOpacity style={[styles.imagePicker, { borderColor: colors.border, width: 110, height: 110 }]} onPress={pickImage}>
                <Ionicons name="camera-outline" size={32} color={colors.primary} />
                <Text style={[styles.imagePickerText, { color: colors.primary, fontSize: 12 }]}>
                  {images.length ? `Add more (${images.length}/${MAX_PHOTOS})` : `Add photos (up to ${MAX_PHOTOS}) or a 10s video`}
                </Text>
              </TouchableOpacity>
            ) : null}
          </ScrollView>

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
