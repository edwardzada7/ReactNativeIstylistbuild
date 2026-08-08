import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, FlatList, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Colors, FontSizes, Spacing, BorderRadius } from '../../src/constants/theme';
import { useAuth } from '../../src/contexts/AuthContext';
import { providerService } from '../../src/services/provider.service';
import { feedService } from '../../src/services/feed.service';
import { resolveCurrentLocation } from '../../src/services/location.service';
import { supabase } from '../../src/lib/supabase';
import { Provider, Post } from '../../src/types';

export default function ProviderProfile() {
  const router = useRouter();
  const { user, logout, refreshUser } = useAuth();
  const [profile, setProfile] = useState<Provider | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationStatus, setLocationStatus] = useState<'idle' | 'detecting' | 'updated' | 'permission-required' | 'unavailable'>('idle');
  const [locationLabel, setLocationLabel] = useState('');

  const loadProfile = useCallback(async () => {
    if (!user?.id) return;
    try {
      const data = await providerService.getProviderFullProfile(user.id);
      setProfile(data);
      const nextLocation = data.location_address || data.location || '';
      setLocationLabel(nextLocation);
      setLocationStatus(nextLocation ? 'updated' : 'idle');
    } catch (err) {
      console.error('[provider-profile-tab] failed to load', err);
    }
  }, [user?.id]);

  const loadPosts = useCallback(async () => {
    if (!user?.id) return;
    setLoadingPosts(true);
    try {
      const response = await feedService.getFeed({ page: 1, per_page: 100 });
      console.log('[provider-profile] user.id:', user.id, 'user.auth_id:', user.auth_id);
      console.log('[provider-profile] total posts from API:', response.data?.length);
      // Filter posts by this provider - try multiple possible fields
      const providerPosts = (response.data || []).filter(
        (post: Post) => {
          const matches = 
            post.provider_auth_id === user.auth_id ||
            post.provider?.id === user.id ||
            post.user_id === user.auth_id ||
            post.provider?.auth_id === user.auth_id;
          if (matches) {
            console.log('[provider-profile] matched post:', post.id, 'provider_auth_id:', post.provider_auth_id, 'provider.id:', post.provider?.id);
          }
          return matches;
        }
      );
      console.log('[provider-profile] filtered posts:', providerPosts.length);
      setPosts(providerPosts);
    } catch (err) {
      console.error('[provider-profile] failed to load posts', err);
      setPosts([]);
    } finally {
      setLoadingPosts(false);
    }
  }, [user?.id, user?.auth_id]);

  useEffect(() => {
    setAvatarUrl(user?.profile_image_url || user?.avatar || null);
    const nextLocation = user?.location_address || [user?.city, user?.state, user?.country].filter(Boolean).join(', ') || '';
    setLocationLabel(nextLocation);
    setLocationStatus(nextLocation ? 'updated' : 'idle');
    loadProfile();
    loadPosts();
  }, [loadProfile, loadPosts, user?.profile_image_url, user?.avatar, user?.location_address, user?.city, user?.state, user?.country]);

  const handlePickAvatar = async (source: 'camera' | 'library') => {
    if (!user?.auth_id) return;

    try {
      const permission =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (permission.status !== 'granted') {
        Alert.alert('Permission required', 'Please allow access to your photos to update your profile image.');
        return;
      }

      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.8, mediaTypes: ['images'] })
          : await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, quality: 0.8, mediaTypes: ['images'] });

      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      const response = await fetch(asset.uri);
      const arrayBuffer = await response.arrayBuffer();
      if (arrayBuffer.byteLength > 2 * 1024 * 1024) {
        Alert.alert('Image too large', 'Please choose an image smaller than 2 MB.');
        return;
      }
      const mimeType = 'image/jpeg';
      const path = `providers/${user.auth_id}/profile.jpg`;

      const { error: uploadError } = await supabase.storage.from('profile-images').upload(path, arrayBuffer, {
        contentType: mimeType,
        upsert: true,
      });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from('profile-images').getPublicUrl(path);
      const publicUrl = publicUrlData.publicUrl;

      const { error: updateError } = await supabase.from('stylists').update({ profile_image_url: publicUrl }).eq('auth_id', user.auth_id);
      if (updateError) throw updateError;

      setAvatarUrl(publicUrl);
      await refreshUser();
      Alert.alert('Success', 'Your profile image has been updated.');
    } catch (err) {
      console.error('[provider-avatar] upload failed', err);
      Alert.alert('Upload failed', 'Could not update your profile image right now.');
    }
  };

  const handleAvatarPress = () => {
    Alert.alert('Profile photo', 'Choose how you want to update your profile image.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Take Photo', onPress: () => handlePickAvatar('camera') },
      { text: 'Choose from Gallery', onPress: () => handlePickAvatar('library') },
    ]);
  };

  const handleDetectLocation = async () => {
    if (!user?.auth_id) return;

    setLocationLoading(true);
    setLocationStatus('detecting');
    try {
      const result = await resolveCurrentLocation();
      if (!result.success) {
        setLocationStatus(result.error === 'permission-denied' ? 'permission-required' : 'unavailable');
        setLocationLabel('');
        Alert.alert('Location unavailable', result.message || 'We could not determine your location right now.');
        return;
      }

      const nextLocationLabel = result.location_address || 'Location updated';
      setLocationLabel(nextLocationLabel);
      const { error } = await supabase.from('stylists').update({
        location_address: result.location_address || null,
        latitude: result.latitude ?? null,
        longitude: result.longitude ?? null,
      }).eq('auth_id', user.auth_id);

      if (error) throw error;

      await refreshUser();
      await loadProfile();
      setLocationStatus('updated');
      Alert.alert('Location updated', 'Your current location has been saved to your profile.');
    } catch (err) {
      console.error('[provider-location] detect failed', err);
      setLocationStatus('unavailable');
      Alert.alert('Location unavailable', 'We could not detect your current location right now.');
    } finally {
      setLocationLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const menuItems = [
    { icon: 'cut-outline', label: 'My Services', onPress: () => router.push('/(provider)/services') },
    { icon: 'time-outline', label: 'Availability', onPress: () => router.push('/(provider)/availability') },
    { icon: 'calendar-outline', label: 'Bookings', onPress: () => router.push('/(provider)/bookings') },
    { icon: 'star-outline', label: 'Reviews', onPress: () => router.push('/(provider)/reviews') },
    {
      icon: 'wallet-outline',
      label: 'Wallet',
      onPress: () => router.push('/(provider)/wallet'),
    },
    { icon: 'settings-outline', label: 'Settings', onPress: () => router.push('/settings') },
    { icon: 'help-circle-outline', label: 'Help Center', onPress: () => router.push('/settings/help') },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.backHeader}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.backHeaderTitle}>Profile</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.profileHeader}>
          <TouchableOpacity onPress={handleAvatarPress} accessibilityRole="button" accessibilityLabel="Update profile image">
            <View style={styles.avatarContainer}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
              ) : (
                <Ionicons name="storefront" size={40} color={Colors.primary} />
              )}
            </View>
          </TouchableOpacity>
          <Text style={styles.userName}>{user?.full_name || profile?.business_name || 'Provider'}</Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
          <View style={styles.badge}>
            <Ionicons name="briefcase" size={14} color={Colors.primary} />
            <Text style={styles.badgeText}>Service Provider</Text>
          </View>
        </View>

        <View style={styles.locationCard}>
          <Text style={styles.sectionTitle}>Your Location</Text>
          <Text style={styles.locationSummary} numberOfLines={2}>
            {locationLabel || 'Location not provided'}
          </Text>
          <Text style={styles.locationStatusText}>
            {locationLoading
              ? 'Detecting location...'
              : locationStatus === 'updated'
                ? 'Location updated'
                : locationStatus === 'permission-required'
                  ? 'Permission required'
                  : locationStatus === 'unavailable'
                    ? 'Unable to determine location'
                    : 'Use your current location to add it to your profile'}
          </Text>
          <TouchableOpacity style={styles.locationButton} onPress={handleDetectLocation} disabled={locationLoading}>
            {locationLoading ? <ActivityIndicator color={Colors.primary} /> : <Ionicons name="locate-outline" size={18} color={Colors.primary} />}
            <Text style={styles.locationButtonText}>{locationLoading ? 'Detecting...' : locationStatus === 'permission-required' || locationStatus === 'unavailable' ? 'Retry' : 'Use My Current Location'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{profile?.rating ? profile.rating.toFixed(1) : 'New'}</Text>
            <Text style={styles.statLabel}>Rating</Text>
          </View>
          <View style={styles.statDivider} />
          <TouchableOpacity
            style={styles.statItem}
            onPress={() => router.push('/(provider)/reviews')}
            accessibilityRole="button"
            accessibilityLabel="View reviews"
          >
            <Text style={styles.statValue}>{profile?.review_count ?? 0}</Text>
            <Text style={styles.statLabel}>Reviews</Text>
          </TouchableOpacity>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{profile?.services.length ?? 0}</Text>
            <Text style={styles.statLabel}>Services</Text>
          </View>
        </View>

        {/* Posts Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Posts</Text>
        </View>
        {loadingPosts ? (
          <View style={styles.centerState}>
            <ActivityIndicator size="small" color={Colors.primary} />
          </View>
        ) : posts.length === 0 ? (
          <View style={styles.emptyPosts}>
            <Ionicons name="images-outline" size={32} color={Colors.textMuted} />
            <Text style={styles.emptyText}>No posts yet</Text>
          </View>
        ) : (
          <FlatList
            data={posts}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.postCard}
                accessibilityRole="button"
                accessibilityLabel="View post"
              >
                {item.image_url && (
                  <Image source={{ uri: item.image_url }} style={styles.postImage} />
                )}
                <View style={styles.postMeta}>
                  <Ionicons name="heart" size={14} color={Colors.error} />
                  <Text style={styles.postMetaText}>{item.likes_count || 0}</Text>
                </View>
              </TouchableOpacity>
            )}
            contentContainerStyle={styles.postsList}
          />
        )}

        <View style={styles.menuItems}>
          {menuItems.map((item) => (
            <TouchableOpacity
              key={item.label}
              style={styles.menuItem}
              onPress={item.onPress}
              accessibilityRole="button"
              accessibilityLabel={item.label}
            >
              <View style={styles.menuItemLeft}>
                <Ionicons name={item.icon as any} size={22} color={Colors.text} />
                <Text style={styles.menuItemLabel}>{item.label}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          accessibilityRole="button"
          accessibilityLabel="Logout"
        >
          <Ionicons name="log-out-outline" size={22} color={Colors.error} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { paddingBottom: Spacing.xl },
  backHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  backHeaderTitle: { fontSize: FontSizes.lg, fontWeight: 'bold', color: Colors.text },
  profileHeader: { alignItems: 'center', paddingVertical: Spacing.xl, paddingHorizontal: Spacing.lg },
  avatarContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },
  avatarImage: {
    width: 88,
    height: 88,
  },
  userName: { fontSize: FontSizes.xl, fontWeight: 'bold', color: Colors.text, marginBottom: 4 },
  userEmail: { fontSize: FontSizes.md, color: Colors.textSecondary },
  locationCard: {
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.primary,
    marginTop: Spacing.sm,
  },
  locationButtonText: {
    fontSize: FontSizes.sm,
    color: Colors.primary,
    fontWeight: '600',
  },
  locationSummary: {
    fontSize: FontSizes.md,
    color: Colors.text,
    marginTop: Spacing.xs,
    fontWeight: '600',
  },
  locationStatusText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    backgroundColor: `${Colors.primary}20`,
    borderRadius: BorderRadius.full,
  },
  badgeText: { fontSize: FontSizes.xs, fontWeight: '600', color: Colors.primary },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, backgroundColor: Colors.border },
  statValue: { fontSize: FontSizes.xl, fontWeight: 'bold', color: Colors.text, marginBottom: 4 },
  statLabel: { fontSize: FontSizes.sm, color: Colors.textSecondary },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  sectionTitle: { fontSize: FontSizes.md, fontWeight: '700', color: Colors.text },
  addPostButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
  },
  emptyPosts: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xl,
    marginHorizontal: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
  },
  emptyText: { fontSize: FontSizes.sm, color: Colors.textSecondary, marginTop: Spacing.sm },
  postsList: { paddingHorizontal: Spacing.lg, gap: Spacing.sm },
  postCard: {
    width: 120,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
  },
  postImage: { width: '100%', height: 120 },
  postMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  postMetaText: { fontSize: FontSizes.xs, color: Colors.textSecondary },
  menuItems: {
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  menuItemLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  menuItemLabel: { fontSize: FontSizes.md, color: Colors.text },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: `${Colors.error}20`,
    borderRadius: BorderRadius.md,
  },
  logoutText: { fontSize: FontSizes.md, fontWeight: '600', color: Colors.error },
});
