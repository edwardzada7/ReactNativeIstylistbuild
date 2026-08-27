import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Colors, FontSizes, Spacing, BorderRadius } from '../../src/constants/theme';
import { useAuth } from '../../src/contexts/AuthContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { bookingService } from '../../src/services/booking.service';
import { resolveCurrentLocation } from '../../src/services/location.service';
import { supabase } from '../../src/lib/supabase';
import { Booking } from '../../src/types';
import { withCacheBuster } from '../../src/utils/display';
import { queryClient } from '../_layout';
import apiService from '../../src/services/api';

const comingSoon = (feature: string) =>
  Alert.alert('Coming soon', `${feature} is being wired up in a later phase.`);

const menuSections = (router: ReturnType<typeof useRouter>, isDark: boolean, toggleTheme: () => void) => [
  {
    section: 'Account',
    items: [
      { icon: 'person-outline', label: 'Edit Profile', onPress: () => router.push('/settings/edit-profile') },
      { icon: 'wallet-outline', label: 'Wallet', onPress: () => router.push('/(tabs)/wallet') },
      { icon: 'star-outline', label: 'My Reviews', onPress: () => router.push('/settings/my-reviews') },
    ],
  },
  {
    section: 'Appearance',
    items: [
      { 
        icon: 'moon-outline', 
        label: 'Dark Mode', 
        onPress: () => {}, 
        isToggle: true, 
        value: isDark,
        onToggle: toggleTheme 
      },
    ],
  },
  {
    section: 'Provider',
    items: [{ icon: 'briefcase-outline', label: 'Become a Provider', onPress: () => comingSoon('Become a Provider') }],
  },
  {
    section: 'Support',
    items: [
      { icon: 'help-circle-outline', label: 'Help Center', onPress: () => router.push('/settings/help') },
      { icon: 'document-text-outline', label: 'Terms & Privacy', onPress: () => router.push('/settings/terms') },
    ],
  },
  {
    section: 'Settings',
    items: [
      { icon: 'notifications-outline', label: 'Notifications', onPress: () => router.push('/notifications') },
      { icon: 'settings-outline', label: 'App Settings', onPress: () => router.push('/settings') },
    ],
  },
];

export default function Profile() {
  const router = useRouter();
  const { user, logout, refreshUser, updateUser } = useAuth();
  const { colors, isDark, toggleTheme } = useTheme();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationStatus, setLocationStatus] = useState<'idle' | 'detecting' | 'updated' | 'permission-required' | 'unavailable'>('idle');
  const [locationLabel, setLocationLabel] = useState('');

  useEffect(() => {
    setAvatarUrl(withCacheBuster(user?.profile_image_url || user?.avatar));
    const nextLocation = user?.location_address || [user?.city, user?.state, user?.country].filter(Boolean).join(', ') || '';
    setLocationLabel(nextLocation);
    setLocationStatus(nextLocation ? 'updated' : 'idle');
  }, [user?.profile_image_url, user?.avatar, user?.location_address, user?.city, user?.state, user?.country]);

  const loadStats = useCallback(async () => {
    try {
      const list = await bookingService.getBookings({ role: 'customer' });
      setBookings(list);
    } catch (err) {
      // Non-fatal: the profile screen should still render without stats.
      console.error('[profile] failed to load booking stats', err);
      setBookings([]);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useFocusEffect(
    useCallback(() => {
      const refreshProfileData = async () => {
        if (!user?.auth_id) return;
        try {
          const { data, error } = await supabase
            .from('users')
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
          console.error('[profile] failed to refresh profile data', err);
        }
      };
      refreshProfileData();
    }, [user?.auth_id, updateUser])
  );

  const { totalBookings, upcomingCount, completedCount } = useMemo(() => {
    const totalBookings = bookings.length;
    const upcomingCount = bookings.filter((b) =>
      ['pending', 'confirmed', 'arrived'].includes(b.status)
    ).length;
    const completedCount = bookings.filter((b) => b.status === 'completed').length;
    return { totalBookings, upcomingCount, completedCount };
  }, [bookings]);

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
      const path = `customers/${user.auth_id}/profile-${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage.from('profile-images').upload(path, arrayBuffer, {
        contentType: mimeType,
        upsert: true,
      });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from('profile-images').getPublicUrl(path);
      const publicUrl = publicUrlData.publicUrl;

      const { error: updateError } = await supabase.from('users').update({ profile_image_url: publicUrl }).eq('auth_id', user.auth_id);
      if (updateError) throw updateError;
      await apiService.put(`/users/${user.id}`, { profile_image_url: publicUrl });

      const refreshedUrl = withCacheBuster(publicUrl) as string;
      setAvatarUrl(refreshedUrl);
      updateUser({ profile_image_url: refreshedUrl, avatar: refreshedUrl });
        await queryClient.invalidateQueries({ queryKey: ['currentUser'] });
        await queryClient.invalidateQueries({ queryKey: ['providers'] });
        await queryClient.invalidateQueries({ queryKey: ['featuredProviders'] });
        await queryClient.invalidateQueries({ queryKey: ['conversations'] });
      await refreshUser();
      updateUser({ profile_image_url: refreshedUrl, avatar: refreshedUrl });
      Alert.alert('Success', 'Your profile image has been updated.');
    } catch (err) {
      console.error('[profile-avatar] upload failed', err);
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
      const { error } = await supabase.from('users').update({
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
      setLocationStatus('updated');
      Alert.alert('Location updated', 'Your current location has been saved to your profile.');
    } catch (err) {
      console.error('[profile-location] detect failed', err);
      setLocationStatus('unavailable');
      Alert.alert('Location unavailable', 'We could not detect your current location right now.');
    } finally {
      setLocationLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
            } catch (err) {
              console.error('[profile] logout failed', err);
            } finally {
              router.replace('/(auth)/login');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.backHeader}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.backHeaderTitle, { color: colors.text }]}>Profile</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <TouchableOpacity onPress={handleAvatarPress} accessibilityRole="button" accessibilityLabel="Update profile image">
            <View style={[styles.avatarContainer, { backgroundColor: colors.surface }]}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
              ) : (
                <Ionicons name="person-circle-outline" size={56} color={colors.primary} />
              )}
            </View>
          </TouchableOpacity>
          <Text style={[styles.userName, { color: colors.text }]}>{user?.full_name || 'Guest User'}</Text>
          <Text style={[styles.userEmail, { color: colors.textSecondary }]}>{user?.email || 'guest@example.com'}</Text>
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

        {/* Stats - customer-relevant only (booking activity, not provider metrics) */}
        <View style={[styles.statsContainer, { backgroundColor: colors.surface }]}>
          {loadingStats ? (
            <ActivityIndicator color={colors.primary} style={{ paddingVertical: Spacing.sm }} />
          ) : (
            <>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.text }]}>{totalBookings}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total Bookings</Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: colors.border, height: 40 }]} />
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.text }]}>{upcomingCount}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Upcoming</Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: colors.border, height: 40 }]} />
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.text }]}>{completedCount}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Completed</Text>
              </View>
            </>
          )}
        </View>

        {/* Menu Sections */}
        {menuSections(router, isDark, toggleTheme).map((section, index) => (
          <View key={index} style={styles.menuSection}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{section.section}</Text>
            <View style={[styles.menuItems, { backgroundColor: colors.surface }]}>
              {section.items.map((item, itemIndex) => (
                <TouchableOpacity
                  key={itemIndex}
                  style={[styles.menuItem, { borderBottomColor: colors.border }]}
                  onPress={item.onPress}
                  accessibilityRole="button"
                  accessibilityLabel={item.label}
                >
                  <View style={styles.menuItemLeft}>
                    <Ionicons name={item.icon as any} size={22} color={colors.text} />
                    <Text style={[styles.menuItemLabel, { color: colors.text }]}>{item.label}</Text>
                  </View>
                  {'isToggle' in item && item.isToggle ? (
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
          </View>
        ))}

        {/* Logout Button */}
        <TouchableOpacity
          style={[styles.logoutButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={handleLogout}
          accessibilityRole="button"
          accessibilityLabel="Logout"
        >
          <Ionicons name="log-out-outline" size={22} color={colors.error} />
          <Text style={[styles.logoutText, { color: colors.error }]}>Logout</Text>
        </TouchableOpacity>

        <Text style={[styles.version, { color: colors.textMuted }]}>Version 1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Spacing.xl,
  },
  backHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  backHeaderTitle: { fontSize: FontSizes.lg, fontWeight: 'bold' },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
  },
  avatarContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },
  avatarImage: {
    width: 96,
    height: 96,
  },
  avatarText: {
    fontSize: 48,
  },
  userName: {
    fontSize: FontSizes.xl,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: FontSizes.md,
  },
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
  badgeText: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
  },
  statsContainer: {
    flexDirection: 'row',
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 40,
  },
  statValue: {
    fontSize: FontSizes.xl,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: FontSizes.sm,
  },
  menuSection: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
  },
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
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  menuItemLabel: {
    fontSize: FontSizes.md,
  },
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
  logoutText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  version: {
    fontSize: FontSizes.xs,
    textAlign: 'center',
    marginTop: Spacing.lg,
  },
});