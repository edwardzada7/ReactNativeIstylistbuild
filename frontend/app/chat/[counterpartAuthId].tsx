import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Colors, FontSizes, Spacing, BorderRadius } from '../../src/constants/theme';
import { Input } from '../../src/components/common';
import { useAuth } from '../../src/contexts/AuthContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { chatService, ChatMessage } from '../../src/services/chat.service';
import apiService from '../../src/services/api';
import { LocationCard } from '../../src/components/chat/LocationCard';
import { InvoiceCard } from '../../src/components/chat/InvoiceCard';
import { ReadReceipt } from '../../src/components/chat/ReadReceipt';

const PHONE_REGEX = /(?:\+?234|0)[789][01]\d{8}/g;
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const SOCIAL_REGEX = /(instagram|ig|whatsapp|snapchat|tiktok|twitter|telegram|call me|add me|contact me)/gi;
const CONTACT_SHARING_WARNING = 'Security Notice: Sharing phone numbers, emails, or off-platform social handles is against policy. Please keep transactions within iStylist.';

function containsBlockedContactInfo(value: string) {
  return [PHONE_REGEX, EMAIL_REGEX, SOCIAL_REGEX].some((pattern) => {
    pattern.lastIndex = 0;
    const matched = pattern.test(value);
    pattern.lastIndex = 0;
    return matched;
  });
}

/**
 * Chat thread using booking-based endpoints to match web implementation.
 * Chat is tied to bookings - accessed via booking_id with counterpart information.
 */
export default function ChatThread() {
  const router = useRouter();
  const { colors } = useTheme();
  const { counterpartAuthId, counterpartName, bookingId: legacyBookingId, conversationId } = useLocalSearchParams<{
    counterpartAuthId: string;
    counterpartName?: string;
    bookingId?: string;
    conversationId?: string;
  }>();
  const bookingId = conversationId || legacyBookingId;
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationTipVisible, setLocationTipVisible] = useState(true);
  const [resolvedCounterpartName, setResolvedCounterpartName] = useState<string | undefined>(counterpartName);

  const loadData = useCallback(async (isPullToRefresh = false) => {
    if (!bookingId) return;
    if (isPullToRefresh) setRefreshing(true);
    try {
      setMessages(await chatService.getThread(Number(bookingId)));
      await chatService.markRead(Number(bookingId));
      
      // Fetch counterpart's actual name if not provided or if it's "Unknown"
      if (!resolvedCounterpartName || resolvedCounterpartName === 'Chat') {
        try {
          // First try to get as provider (stylist)
          const stylistProfile = await apiService.get(`/stylists/by-auth/${counterpartAuthId}`).catch(() => null);
          let name: string | undefined;
          if (stylistProfile) {
            // Provider: prioritize business_name, then salon_name, then user name
            name = stylistProfile?.businessName || stylistProfile?.business_name || stylistProfile?.firstName || stylistProfile?.first_name || stylistProfile?.salon_name || stylistProfile?.name;
          } else {
            // Fallback to user table for customers
            const userProfile = await apiService.get(`/users/by-auth/${counterpartAuthId}`);
            name = [userProfile?.firstName || userProfile?.first_name, userProfile?.lastName || userProfile?.last_name].filter(Boolean).join(' ').trim() || userProfile?.name || userProfile?.full_name;
          }
          if (name) setResolvedCounterpartName(name);
        } catch (err) {
          console.warn('[chat] failed to load counterpart profile', err);
        }
      }
    } catch (err) {
      console.error('[chat] failed to load thread', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [bookingId, counterpartAuthId, resolvedCounterpartName]);

  const handleRefresh = () => loadData(true);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleSend = async () => {
    if (!text.trim() || !bookingId) return;
    const body = text.trim();
    if (containsBlockedContactInfo(body)) {
      Alert.alert(CONTACT_SHARING_WARNING);
      return;
    }
    setText('');
    setSending(true);
    try {
      const sent = await chatService.sendMessage(Number(bookingId), body);
      setMessages((prev) => [...prev, sent]);
    } catch (err) {
      console.error('[chat] failed to send', err);
    } finally {
      setSending(false);
    }
  };

  const handleShareLocation = async () => {
    setLocationLoading(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted' || !bookingId) return;

      const position = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = position.coords;
      const addressName = 'Shared Location';
      const messagePayload = {
        conversationId: Number(bookingId),
        type: 'LOCATION' as const,
        content: `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`,
        latitude,
        longitude,
        addressName,
      };

      const sent = await chatService.sendMessage(messagePayload);
      setMessages((prev) => [...prev, sent]);
    } catch (err) {
      console.error('[chat] failed to share location', err);
    } finally {
      setLocationLoading(false);
    }
  };

  const formatTime = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>{resolvedCounterpartName || 'Stylist'}</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        {loading ? (
          <View style={styles.centerState}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <FlatList
            data={messages}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <View style={styles.centerState}>
                <Ionicons name="chatbubble-outline" size={28} color={colors.textMuted} />
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Say hello to get the conversation started.</Text>
              </View>
            }
            renderItem={({ item }) => {
              const isMine = item.sender_auth_id === user?.auth_id;
              const isSystemAlert = item.message_type === 'SYSTEM_ALERT';
              const messageContent = item.content || item.message || '';
              const isLocation = item.message_type === 'LOCATION' || item.type === 'LOCATION' || messageContent.includes('google.com/maps');
              return (
                <View style={[styles.bubbleWrapper, isMine ? styles.bubbleWrapperMine : styles.bubbleWrapperTheirs]}>
                  <View style={[styles.bubble, isMine ? styles.bubbleMine : { backgroundColor: colors.surface }, isSystemAlert && styles.systemBubble]}>
                    {isLocation ? (
                      <LocationCard
                        latitude={item.location_data?.latitude}
                        longitude={item.location_data?.longitude}
                        addressName={item.location_data?.addressName}
                        mapUrl={messageContent}
                      />
                    ) : item.message_type === 'CUSTOM_INVOICE' && item.invoice_data ? (
                      <InvoiceCard {...item.invoice_data} />
                    ) : (
                      <Text style={[styles.bubbleText, { color: isMine ? '#fff' : colors.text }]}>{item.message}</Text>
                    )}
                    <View style={styles.timestampRow}>
                      <Text style={[styles.timestamp, { color: colors.textSecondary }]}>{formatTime(item.created_at)}</Text>
                      {isMine && <ReadReceipt isRead={item.is_read ?? item.read} />}
                    </View>
                  </View>
                </View>
              );
            }}
          />
        )}
        <View style={[styles.inputRow, { borderTopColor: colors.border }]}>
          <View style={styles.locationButtonWrap}>
            {locationTipVisible && (
              <View style={[styles.locationTooltip, { backgroundColor: colors.primary }]}>
                <Text style={styles.locationTooltipText}>Tap to share location.</Text>
                <TouchableOpacity onPress={() => setLocationTipVisible(false)} accessibilityRole="button" accessibilityLabel="Close location tip">
                  <Ionicons name="close" size={16} color="#fff" />
                </TouchableOpacity>
                <View style={[styles.locationTooltipArrow, { borderTopColor: colors.primary }]} />
              </View>
            )}
            <TouchableOpacity onPress={handleShareLocation} disabled={locationLoading || !bookingId} accessibilityRole="button" accessibilityLabel="Share location">
              {locationLoading ? <ActivityIndicator size="small" color={colors.primary} /> : <Ionicons name="location-outline" size={22} color={colors.primary} />}
            </TouchableOpacity>
          </View>
          <View style={{ flex: 1 }}>
            <Input value={text} onChangeText={setText} placeholder="Type a message..." />
          </View>
          <TouchableOpacity style={[styles.sendBtn, { backgroundColor: colors.primary }]} onPress={handleSend} disabled={sending || !text.trim()} accessibilityRole="button" accessibilityLabel="Send message">
            {sending ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="send" size={18} color="#fff" />}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  title: { fontSize: FontSizes.lg, fontWeight: 'bold' },
  centerState: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.sm, paddingTop: Spacing.xxl },
  emptyText: { fontSize: FontSizes.sm },
  list: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.md, flexGrow: 1 },
  bubbleWrapper: { marginBottom: Spacing.sm },
  bubbleWrapperMine: { alignItems: 'flex-end' },
  bubbleWrapperTheirs: { alignItems: 'flex-start' },
  bubble: { maxWidth: '78%', borderRadius: BorderRadius.md, padding: Spacing.sm },
  systemBubble: { alignSelf: 'center', maxWidth: '92%' },
  bubbleMine: { backgroundColor: Colors.primary },
  bubbleText: { fontSize: FontSizes.sm },
  timestamp: { fontSize: 10, marginTop: 4, textAlign: 'right' },
  timestampRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },
  locationButtonWrap: { position: 'relative', zIndex: 2 },
  locationTooltip: {
    position: 'absolute',
    bottom: 38,
    left: -8,
    width: 190,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    zIndex: 3,
  },
  locationTooltipText: { color: '#fff', fontSize: FontSizes.xs, fontWeight: '600', flex: 1 },
  locationTooltipArrow: {
    position: 'absolute',
    bottom: -6,
    left: 12,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderTopWidth: 1 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
});
