import React, { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, FlatList, Image as RNImage, ActivityIndicator, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { FontSizes, Spacing, BorderRadius } from '../../src/constants/theme';
import { useAuth } from '../../src/contexts/AuthContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { providerService } from '../../src/services/provider.service';
import { feedService } from '../../src/services/feed.service';
import { resolveCurrentLocation } from '../../src/services/location.service';
import { supabase } from '../../src/lib/supabase';
import { Provider, Post, Review } from '../../src/types';
import apiService from '../../src/services/api';
import { withCacheBuster } from '../../src/utils/display';

export default function ProviderProfile() {
  const router = useRouter();
  const { user, logout, refreshUser, updateUser } = useAuth();
  const { colors, isDark, toggleTheme } = useTheme();
  const [profile, setProfile] = useState<Provider | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationStatus, setLocationStatus] = useState<'idle' | 'detecting' | 'updated' | 'permission-required' | 'unavailable'>('idle');
  const [locationLabel, setLocationLabel] = useState('');
  const [accountType, setAccountType] = useState<'individual' | 'business'>('individual');
  const [kycStatus, setKycStatus] = useState<'not_submitted' | 'pending' | 'verified' | 'rejected'>('not_submitted');

  const loadProfile = useCallback(async () => {
    if (!user?.id) return;
    try {
      const data = await providerService.getProviderFullProfile(user.id);
      setProfile(data);
      const nextLocation = data.location_address || data.location || '';
      setLocationLabel(nextLocation);
      setLocationStatus(nextLocation ? 'updated' : 'idle');
      if (data.profile_image_url || data.avatar) {
        setAvatarUrl(withCacheBuster(data.profile_image_url || data.avatar));
      }
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

  const loadReviews = useCallback(async () => {
    if (!user?.id) return;
    setReviews(await providerService.getProviderReviews(user.id));
  }, [user?.id]);

  useEffect(() => {
    setAvatarUrl(withCacheBuster(user?.profile_image_url || user?.avatar));
    const nextLocation = user?.location_address || [user?.city, user?.state, user?.country].filter(Boolean).join(', ') || '';
    setLocationLabel(nextLocation);
    setLocationStatus(nextLocation ? 'updated' : 'idle');
    loadProfile();
    loadPosts();
    loadReviews();
    loadAccountType();
    loadKycStatus();
  }, [loadProfile, loadPosts, loadReviews, user?.id, user?.profile_image_url, user?.avatar, user?.location_address, user?.city, user?.state, user?.country]);

  useFocusEffect(
    useCallback(() => {
      const refreshProfileData = async () => {
        if (!user?.auth_id) return;
        try {
          const { data, error } = await supabase
            .from('stylists')
            .select('profile_image_url, location_address, latitude, longitude')
            .eq('auth_id', user.auth_id)
            .single();
          if (!error && data) {
            updateUser({
              profile_image_url: data.profile_image_url,
              location_address: data.location_address,
              latitude: data.latitude,
              longitude: data.longitude,
            });
          }
        } catch (err) {
          console.error('[provider-profile] failed to refresh profile data', err);
        }
      };
      refreshProfileData();
    }, [user?.auth_id, updateUser])
  );

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
      const path = `providers/${user.auth_id}/profile-${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage.from('profile-images').upload(path, arrayBuffer, {
        contentType: mimeType,
        upsert: true,
      });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from('profile-images').getPublicUrl(path);
      const publicUrl = publicUrlData.publicUrl;

      const { error: updateError } = await supabase.from('stylists').update({ profile_image_url: publicUrl }).eq('auth_id', user.auth_id);
      if (updateError) throw updateError;

      const refreshedUrl = withCacheBuster(publicUrl) as string;
      setAvatarUrl(refreshedUrl);
      updateUser({ profile_image_url: refreshedUrl, avatar: refreshedUrl });
      await refreshUser();
      updateUser({ profile_image_url: refreshedUrl, avatar: refreshedUrl });
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

      updateUser({
        location_address: result.location_address || null,
        latitude: result.latitude ?? null,
        longitude: result.longitude ?? null,
      });
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
          try {
            await logout();
          } catch (err) {
            console.error('[provider-profile] logout failed', err);
          } finally {
            router.replace('/(auth)/login');
          }
        },
      },
    ]);
  };

  const loadAccountType = async () => {
    if (!user?.auth_id) return;
    try {
      const res = await apiService.get<{ account_type?: string }>(`/users/by-auth/${user.auth_id}`);
      setAccountType((res?.account_type as 'individual' | 'business') || 'individual');
    } catch (err) {
      console.error('[provider-profile] failed to load account type', err);
    }
  };

  const loadKycStatus = async () => {
    if (!user?.auth_id) return;
    try {
      const res = await apiService.get<{ status: string }>(`/kyc/me?auth_id=${encodeURIComponent(user.auth_id)}`);
      setKycStatus((res?.status as 'not_submitted' | 'pending' | 'verified' | 'rejected') || 'not_submitted');
    } catch (err) {
      console.error('[provider-profile] failed to load KYC status', err);
    }
  };

  const handleAccountTypeChange = async (newType: 'individual' | 'business') => {
    if (!user?.auth_id) return;

    const token = await apiService.getAccessToken();
    console.log('[provider-profile] updating account type', {
      authId: user.auth_id,
      payload: { account_type: newType },
      hasAccessToken: Boolean(token),
    });

    try {
      await apiService.patch(`/users/by-auth/${user.auth_id}`, { account_type: newType });
      setAccountType(newType);
      // Refresh user data to ensure persistence
      await refreshUser();
      // Reload account type from server to confirm persistence
      await loadAccountType();
      Alert.alert('Success', `Account type updated to ${newType}`);
    } catch (err: any) {
      console.error('[provider-profile] failed to update account type', {
        message: err?.message,
        status: err?.response?.status,
        data: err?.response?.data,
        friendlyMessage: err?.friendlyMessage,
      });
      Alert.alert('Error', err?.friendlyMessage || 'Failed to update account type');
    }
  };

  const averageRating = reviews.length
    ? (reviews.reduce((total, review) => total + Number(review.rating || 0), 0) / reviews.length).toFixed(1)
    : 'New';

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
    { icon: 'shield-checkmark-outline', label: 'KYC Verification', onPress: () => router.push('/(provider)/kyc') },
    { icon: 'settings-outline', label: 'Settings', onPress: () => router.push('/settings') },
    { icon: 'help-circle-outline', label: 'Help Center', onPress: () => router.push('/settings/help') },
  ];

  const appearanceItems = [
    { 
      icon: 'moon-outline', 
      label: 'Dark Mode', 
      onPress: () => {}, 
      isToggle: true, 
      value: isDark,
      onToggle: toggleTheme 
    },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.backHeader}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.backHeaderTitle, { color: colors.text }]}>Profile</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.profileHeader}>
          <TouchableOpacity onPress={handleAvatarPress} accessibilityRole="button" accessibilityLabel="Update profile image">
            <View style={[styles.avatarContainer, { backgroundColor: colors.surface }]}>
              {avatarUrl ? (
                <RNImage source={{ uri: avatarUrl }} style={styles.avatarImage} />
              ) : (
                <Ionicons name="storefront" size={40} color={colors.primary} />
              )}
            </View>
          </TouchableOpacity>
          <Text style={[styles.userName, { color: colors.text }]}>{user?.full_name || profile?.business_name || 'Provider'}</Text>
          <Text style={[styles.userEmail, { color: colors.textSecondary }]}>{user?.email}</Text>
          <View style={[styles.badge, { backgroundColor: `${colors.primary}20` }]}>
            <Ionicons name="briefcase" size={14} color={colors.primary} />
            <Text style={[styles.badgeText, { color: colors.primary }]}>Service Provider</Text>
          </View>
        </View>

        <View style={[styles.locationCard, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Your Location</Text>
          <Text style={[styles.locationSummary, { color: colors.textSecondary }]} numberOfLines={2}>
            {locationLabel || 'Location not provided'}
          </Text>
          <Text style={[styles.locationStatusText, { color: colors.textSecondary }]}>
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
          <TouchableOpacity style={[styles.locationButton, { borderColor: colors.primary }]} onPress={handleDetectLocation} disabled={locationLoading}>
            {locationLoading ? <ActivityIndicator color={colors.primary} /> : <Ionicons name="locate-outline" size={18} color={colors.primary} />}
            <Text style={[styles.locationButtonText, { color: colors.primary }]}>{locationLoading ? 'Detecting...' : locationStatus === 'permission-required' || locationStatus === 'unavailable' ? 'Retry' : 'Use My Current Location'}</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.statsContainer, { backgroundColor: colors.surface }]}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.text }]}>{averageRating}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Rating</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border, height: 40 }]} />
          <TouchableOpacity
            style={styles.statItem}
            onPress={() => router.push('/(provider)/reviews')}
            accessibilityRole="button"
            accessibilityLabel="View reviews"
          >
            <Text style={[styles.statValue, { color: colors.text }]}>{profile?.review_count ?? 0}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Reviews</Text>
          </TouchableOpacity>
          <View style={[styles.statDivider, { backgroundColor: colors.border, height: 40 }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.text }]}>{profile?.services.length ?? 0}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Services</Text>
          </View>
        </View>

        {/* Account Type Section */}
        <View style={[styles.menuItems, { backgroundColor: colors.surface }]}>
          <View style={[styles.menuItem, { borderBottomColor: colors.border }]}>
            <View style={styles.menuItemLeft}>
              <Ionicons name="business-outline" size={22} color={colors.text} />
              <Text style={[styles.menuItemLabel, { color: colors.text }]}>Account Type</Text>
            </View>
            <View style={styles.accountTypeRow}>
              <TouchableOpacity
                style={[
                  styles.accountTypeButton,
                  { backgroundColor: accountType === 'individual' ? colors.primary : colors.background, borderColor: colors.border },
                ]}
                onPress={() => handleAccountTypeChange('individual')}
              >
                <Text style={[styles.accountTypeText, { color: accountType === 'individual' ? '#fff' : colors.text }]}>
                  Individual
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.accountTypeButton,
                  { backgroundColor: accountType === 'business' ? colors.primary : colors.background, borderColor: colors.border },
                ]}
                onPress={() => handleAccountTypeChange('business')}
              >
                <Text style={[styles.accountTypeText, { color: accountType === 'business' ? '#fff' : colors.text }]}>
                  Business
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={[styles.menuItem, { borderBottomColor: colors.border }]}>
            <View style={styles.menuItemLeft}>
              <Ionicons name="shield-checkmark-outline" size={22} color={colors.text} />
              <Text style={[styles.menuItemLabel, { color: colors.text }]}>KYC Status</Text>
            </View>
            <View style={[
              styles.kycBadge,
              {
                backgroundColor: kycStatus === 'verified' ? `${colors.success}20` :
                               kycStatus === 'pending' ? `${colors.warning}20` :
                               kycStatus === 'rejected' ? `${colors.error}20` : `${colors.textMuted}20`,
                borderColor: kycStatus === 'verified' ? colors.success :
                              kycStatus === 'pending' ? colors.warning :
                              kycStatus === 'rejected' ? colors.error : colors.textMuted
              }
            ]}>
              <Text style={[
                styles.kycBadgeText,
                { color: kycStatus === 'verified' ? colors.success :
                        kycStatus === 'pending' ? colors.warning :
                        kycStatus === 'rejected' ? colors.error : colors.textMuted }
              ]}>
                {kycStatus === 'not_submitted' ? 'Not Submitted' :
                 kycStatus === 'pending' ? 'Pending' :
                 kycStatus === 'verified' ? 'Verified' : 'Rejected'}
              </Text>
            </View>
          </View>
        </View>

        {/* Posts Section */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Posts</Text>
        </View>
        {loadingPosts ? (
          <View style={styles.centerState}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : posts.length === 0 ? (
          <View style={styles.emptyPosts}>
            <Ionicons name="images-outline" size={32} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No posts yet</Text>
          </View>
        ) : (
          <FlatList
            data={posts}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.postCard, { backgroundColor: colors.surface }]}
                accessibilityRole="button"
                accessibilityLabel="View post"
              >
                {item.image_url && (
                  <RNImage source={{ uri: item.image_url }} style={styles.postImage} />
                )}
                <View style={styles.postMeta}>
                  <Ionicons name="heart" size={14} color={colors.error} />
                  <Text style={[styles.postMetaText, { color: colors.textSecondary }]}>{item.likes_count || 0}</Text>
                </View>
              </TouchableOpacity>
            )}
            contentContainerStyle={styles.postsList}
          />
        )}

        {/* Appearance Section */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Appearance</Text>
        </View>
        <View style={[styles.menuItems, { backgroundColor: colors.surface }]}>
          {appearanceItems.map((item) => (
            <TouchableOpacity
              key={item.label}
              style={[styles.menuItem, { borderBottomColor: colors.border }]}
              onPress={item.onPress}
              accessibilityRole="button"
              accessibilityLabel={item.label}
            >
              <View style={styles.menuItemLeft}>
                <Ionicons name={item.icon as any} size={22} color={colors.text} />
                <Text style={[styles.menuItemLabel, { color: colors.text }]}>{item.label}</Text>
              </View>
              {item.isToggle ? (
                <Switch
                  value={item.value}
                  onValueChange={item.onToggle}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={item.value ? colors.primary : colors.textMuted}
                />
              ) : (
                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
              )}
            </TouchableOpacity>
          ))}
        </View>

        <View style={[styles.menuItems, { backgroundColor: colors.surface }]}>
          {menuItems.map((item) => (
            <TouchableOpacity
              key={item.label}
              style={[styles.menuItem, { borderBottomColor: colors.border }]}
              onPress={item.onPress}
              accessibilityRole="button"
              accessibilityLabel={item.label}
            >
              <View style={styles.menuItemLeft}>
                <Ionicons name={item.icon as any} size={22} color={colors.text} />
                <Text style={[styles.menuItemLabel, { color: colors.text }]}>{item.label}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.logoutButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={handleLogout}
          accessibilityRole="button"
          accessibilityLabel="Logout"
        >
          <Ionicons name="log-out-outline" size={22} color={colors.error} />
          <Text style={[styles.logoutText, { color: colors.error }]}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: Spacing.xl },
  backHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  backHeaderTitle: { fontSize: FontSizes.lg, fontWeight: 'bold' },
  profileHeader: { alignItems: 'center', paddingVertical: Spacing.xl, paddingHorizontal: Spacing.lg },
  avatarContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },
  avatarImage: {
    width: 88,
    height: 88,
  },
  userName: { fontSize: FontSizes.xl, fontWeight: 'bold', marginBottom: 4 },
  userEmail: { fontSize: FontSizes.md },
  locationCard: {
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
    marginTop: Spacing.sm,
  },
  locationButtonText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  locationSummary: {
    fontSize: FontSizes.md,
    marginTop: Spacing.xs,
    fontWeight: '600',
  },
  locationStatusText: {
    fontSize: FontSizes.sm,
    marginTop: Spacing.xs,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  badgeText: { fontSize: FontSizes.xs, fontWeight: '600' },
  statsContainer: {
    flexDirection: 'row',
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1 },
  statValue: { fontSize: FontSizes.xl, fontWeight: 'bold', marginBottom: 4 },
  statLabel: { fontSize: FontSizes.sm },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  sectionTitle: { fontSize: FontSizes.md, fontWeight: '700' },
  addPostButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
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
    borderRadius: BorderRadius.lg,
  },
  emptyText: { fontSize: FontSizes.sm, marginTop: Spacing.sm },
  postsList: { paddingHorizontal: Spacing.lg, gap: Spacing.sm },
  postCard: {
    width: 120,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  postImage: { width: '100%', height: 120 },
  postMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  postMetaText: { fontSize: FontSizes.xs },
  menuItems: {
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
  },
  menuItemLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  menuItemLabel: { fontSize: FontSizes.md },
  accountTypeRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  accountTypeButton: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  accountTypeText: { fontSize: FontSizes.xs, fontWeight: '600' },
  kycBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  kycBadgeText: { fontSize: FontSizes.xs, fontWeight: '600' },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  logoutText: { fontSize: FontSizes.md, fontWeight: '600' },
});
