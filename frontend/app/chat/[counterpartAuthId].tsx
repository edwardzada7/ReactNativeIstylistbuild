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
  Image,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Colors, FontSizes, Spacing, BorderRadius } from '../../src/constants/theme';
import { Button, Input } from '../../src/components/common';
import { useAuth } from '../../src/contexts/AuthContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { chatService, ChatMessage } from '../../src/services/chat.service';
import apiService from '../../src/services/api';
import { LocationCard } from '../../src/components/chat/LocationCard';
import { InvoiceCard } from '../../src/components/chat/InvoiceCard';
import { ProviderRecommendationCard } from '../../src/components/chat/ProviderRecommendationCard';
import { ReadReceipt } from '../../src/components/chat/ReadReceipt';
import { providerService } from '../../src/services/provider.service';
import { useCartStore } from '../../src/store/cartStore';

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
  const { counterpartAuthId, counterpartName, bookingId: legacyBookingId, conversationId, conversationType } = useLocalSearchParams<{
    counterpartAuthId: string;
    counterpartName?: string;
    bookingId?: string;
    conversationId?: string;
    conversationType?: 'booking' | 'inquiry' | 'consultation';
  }>();
  const isSharedConversation = Boolean(
    conversationId && (conversationType === 'inquiry' || conversationType === 'consultation')
  );
  const activeChatId = isSharedConversation ? conversationId : legacyBookingId;
  const { user } = useAuth();
  const addItem = useCartStore((state) => state.addItem);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationTipVisible, setLocationTipVisible] = useState(true);
  const [resolvedCounterpartName, setResolvedCounterpartName] = useState<string | undefined>(counterpartName);
  const [recommendationVisible, setRecommendationVisible] = useState(false);
  const [providers, setProviders] = useState<any[]>([]);
  const [providerSearch, setProviderSearch] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<any | null>(null);
  const [recommendationMessage, setRecommendationMessage] = useState('');
  const [recommendationLoading, setRecommendationLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const openRecommendation = async () => {
    if (!isSharedConversation || !conversationId || !user?.auth_id) return;
    setRecommendationVisible(true);
    setSelectedProvider(null);
    setRecommendationMessage('');
    try {
      const list = await providerService.getProvidersWithServices();
      setProviders(list.filter((provider) => provider.user_id !== user.auth_id));
    } catch (err) {
      Alert.alert('Could not load providers', 'Please try again.');
    }
  };

  const sendRecommendation = async () => {
    if (!selectedProvider || !conversationId || !counterpartAuthId) return;
    setRecommendationLoading(true);
    try {
      const category = typeof selectedProvider.category === 'string' ? selectedProvider.category : selectedProvider.category?.name;
      const sent = await chatService.sendProviderRecommendation(Number(conversationId), counterpartAuthId, {
        recommended_provider_auth_id: selectedProvider.user_id,
        provider_id: selectedProvider.id,
        provider_name: selectedProvider.business_name,
        provider_image: selectedProvider.avatarUrl || selectedProvider.profile_image_url || selectedProvider.avatar || null,
        provider_bio: selectedProvider.bio || null,
        provider_category: category || null,
        message: recommendationMessage.trim(),
      });
      setMessages((prev) => [...prev, sent]);
      setRecommendationVisible(false);
    } catch (err: any) {
      Alert.alert('Could not send recommendation', err?.friendlyMessage || 'Please try again.');
    } finally {
      setRecommendationLoading(false);
    }
  };

  const loadData = useCallback(async (isPullToRefresh = false) => {
    if (!counterpartAuthId || !activeChatId) {
      setLoadError('This chat link is incomplete. Please return to Messages and try again.');
      setLoading(false);
      return;
    }
    if (isPullToRefresh) setRefreshing(true);
    setLoadError(null);
    try {
      if (isSharedConversation) {
        const result = await chatService.getConversationThread(Number(conversationId));
        setMessages(result.messages || []);
      } else {
        setMessages(await chatService.getThread(Number(legacyBookingId)));
        await chatService.markRead(Number(legacyBookingId));
      }
      
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
      setLoadError('Could not load messages. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeChatId, conversationId, counterpartAuthId, conversationType, isSharedConversation, legacyBookingId, resolvedCounterpartName]);

  const handleRefresh = () => loadData(true);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleSend = async () => {
    if (!text.trim() || !activeChatId) return;
    const body = text.trim();
    if (containsBlockedContactInfo(body)) {
      Alert.alert(CONTACT_SHARING_WARNING);
      return;
    }
    setText('');
    setSending(true);
    try {
      const sent = isSharedConversation
        ? await chatService.sendConversationMessage(Number(conversationId), counterpartAuthId, body)
        : await chatService.sendMessage(Number(legacyBookingId), body);
      setMessages((prev) => [...prev, sent]);
    } catch (err) {
      console.error('[chat] failed to send', err);
    } finally {
      setSending(false);
    }
  };

  const openInvoiceMenu = () => {
    if (!isSharedConversation || user?.role !== 'provider' || !conversationId) return;
    Alert.alert('Create invoice', 'Choose an invoice type.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Service Invoice', onPress: () => router.push({ pathname: '/invoice/service' as any, params: { conversationId, customerAuthId: counterpartAuthId } }) },
      { text: 'Product Invoice', onPress: () => router.push({ pathname: '/invoice/product' as any, params: { conversationId, customerAuthId: counterpartAuthId } }) },
    ]);
  };

  const handlePayInvoice = (invoice: NonNullable<ChatMessage['invoice_data']>) => {
    if (invoice.invoice_type === 'product') {
      (invoice.items || []).forEach((item) => addItem({
        productId: Number(item.product_id), name: item.name || `Product #${item.product_id}`,
        price: Number(item.price || 0), image: item.image || null,
        stylistAuthId: item.stylist_auth_id || counterpartAuthId,
      }, item.quantity));
      router.push({ pathname: '/shop/cart', params: { invoiceId: String(invoice.invoice_id || '') } });
      return;
    }
    router.push({ pathname: '/invoice/service-payment' as any, params: { invoiceId: String(invoice.invoice_id || '') } });
  };

  const handleSharePhoto = async () => {
    if (!isSharedConversation || !conversationId) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6, base64: true });
    const asset = result.assets?.[0];
    if (result.canceled || !asset?.base64) return;
    try {
      const sent = await chatService.sendConversationMessage(Number(conversationId), counterpartAuthId, `data:image/jpeg;base64,${asset.base64}`, 'IMAGE');
      setMessages((prev) => [...prev, sent]);
    } catch (err) {
      console.error('[chat] failed to send photo', err);
    }
  };

  const handleShareLocation = async () => {
    setLocationLoading(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted' || !activeChatId) return;

      const position = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = position.coords;
      const addressName = 'Shared Location';
      const messagePayload = {
        conversationId: Number(activeChatId),
        type: 'LOCATION' as const,
        content: `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`,
        latitude,
        longitude,
        addressName,
      };

      const sent = isSharedConversation
        ? await chatService.sendConversationMessage(Number(conversationId), counterpartAuthId, messagePayload.content)
        : await chatService.sendMessage(messagePayload);
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
        <View style={styles.headerTitle}>
          <Text style={[styles.title, { color: colors.text }]}>{resolvedCounterpartName || 'Stylist'}</Text>
          {conversationType && conversationType !== 'booking' && <Text style={[styles.context, { color: colors.textSecondary }]}>{conversationType === 'consultation' ? 'Consultation' : 'Inquiry'}</Text>}
        </View>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        {loading ? (
          <View style={styles.centerState}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : loadError ? (
          <View style={styles.centerState}>
            <Ionicons name="alert-circle-outline" size={28} color={colors.error} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{loadError}</Text>
            <Button title="Retry" onPress={() => loadData()} variant="outline" />
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
              let recommendationData = item.recommendation_data;
              if (!recommendationData && item.message_type === 'PROVIDER_RECOMMENDATION') {
                try { recommendationData = JSON.parse(item.message); } catch { recommendationData = null; }
              }
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
                    ) : item.message_type === 'IMAGE' && messageContent.startsWith('data:image') ? (
                      <Image source={{ uri: messageContent }} style={styles.messageImage} />
                    ) : item.message_type === 'CUSTOM_INVOICE' && item.invoice_data ? (
                      <InvoiceCard {...item.invoice_data} onPay={item.sender_auth_id !== user?.auth_id && item.invoice_data.status !== 'paid' ? () => handlePayInvoice(item.invoice_data!) : undefined} />
                    ) : item.message_type === 'PROVIDER_RECOMMENDATION' && recommendationData ? (
                      <>
                        <ProviderRecommendationCard
                          providerName={recommendationData.provider_name}
                          providerImage={recommendationData.provider_image}
                          providerBio={recommendationData.provider_bio}
                          providerCategory={recommendationData.provider_category}
                          onViewProfile={() => router.push({ pathname: '/provider/[id]', params: { id: recommendationData?.provider_id || '' } })}
                        />
                        {!!recommendationData.message && <Text style={[styles.recommendationMessage, { color: isMine ? '#fff' : colors.text }]}>{recommendationData.message}</Text>}
                      </>
                    ) : (
                      <Text style={[styles.bubbleText, { color: isMine ? '#fff' : colors.text }]}>{messageContent}</Text>
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
          {isSharedConversation && <TouchableOpacity onPress={openRecommendation} accessibilityRole="button" accessibilityLabel="Recommend provider"><Ionicons name="person-add-outline" size={22} color={colors.primary} /></TouchableOpacity>}
          {isSharedConversation && user?.role === 'provider' && <TouchableOpacity onPress={openInvoiceMenu} accessibilityRole="button" accessibilityLabel="Create invoice"><Ionicons name="add-circle-outline" size={23} color={colors.primary} /></TouchableOpacity>}
          {isSharedConversation && <TouchableOpacity onPress={handleSharePhoto} accessibilityRole="button" accessibilityLabel="Attach photo"><Ionicons name="image-outline" size={22} color={colors.primary} /></TouchableOpacity>}
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
            <TouchableOpacity onPress={handleShareLocation} disabled={locationLoading || !activeChatId} accessibilityRole="button" accessibilityLabel="Share location">
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
      <Modal visible={recommendationVisible} transparent animationType="slide" onRequestClose={() => setRecommendationVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.recommendationSheet, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Recommend Provider</Text>
              <TouchableOpacity onPress={() => setRecommendationVisible(false)} accessibilityRole="button" accessibilityLabel="Close recommendation picker"><Ionicons name="close" size={24} color={colors.text} /></TouchableOpacity>
            </View>
            <TextInput value={providerSearch} onChangeText={setProviderSearch} placeholder="Search providers" placeholderTextColor={colors.textSecondary} style={[styles.searchInput, { borderColor: colors.border, color: colors.text }]} />
            <FlatList
              data={providers.filter((provider) => `${provider.business_name} ${provider.bio || ''}`.toLowerCase().includes(providerSearch.toLowerCase()))}
              keyExtractor={(provider) => String(provider.id)}
              style={styles.providerList}
              renderItem={({ item: provider }) => <TouchableOpacity style={[styles.providerOption, { borderColor: selectedProvider?.id === provider.id ? colors.primary : colors.border }]} onPress={() => setSelectedProvider(provider)}><Text style={[styles.providerName, { color: colors.text }]}>{provider.business_name}</Text><Text style={[styles.providerBio, { color: colors.textSecondary }]} numberOfLines={1}>{provider.bio || 'iStylist provider'}</Text></TouchableOpacity>}
              ListEmptyComponent={<Text style={[styles.emptyText, { color: colors.textSecondary }]}>No providers found.</Text>}
            />
            {selectedProvider && <TextInput value={recommendationMessage} onChangeText={(value) => setRecommendationMessage(value.slice(0, 240))} placeholder="Add a short reason (optional)" placeholderTextColor={colors.textSecondary} style={[styles.reasonInput, { borderColor: colors.border, color: colors.text }]} maxLength={240} />}
            <Button title={recommendationLoading ? 'Sending...' : 'Send Recommendation'} onPress={sendRecommendation} disabled={!selectedProvider || recommendationLoading} fullWidth />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  title: { fontSize: FontSizes.lg, fontWeight: 'bold' },
  headerTitle: { alignItems: 'center' },
  context: { fontSize: FontSizes.xs, textTransform: 'capitalize' },
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
  messageImage: { width: 220, height: 220, borderRadius: BorderRadius.md },
  recommendationMessage: { marginTop: Spacing.sm, fontSize: FontSizes.sm },
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
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(17,24,39,0.45)' },
  recommendationSheet: { maxHeight: '85%', borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl, padding: Spacing.lg, paddingBottom: Spacing.xl },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalTitle: { fontSize: FontSizes.lg, fontWeight: '800' },
  searchInput: { borderWidth: 1, borderRadius: BorderRadius.md, padding: Spacing.sm, marginTop: Spacing.md },
  providerList: { marginVertical: Spacing.md },
  providerOption: { padding: Spacing.sm, borderWidth: 1, borderRadius: BorderRadius.md, marginBottom: Spacing.sm },
  providerName: { fontSize: FontSizes.sm, fontWeight: '700' },
  providerBio: { fontSize: FontSizes.xs, marginTop: 3 },
  reasonInput: { borderWidth: 1, borderRadius: BorderRadius.md, padding: Spacing.sm, minHeight: 70, textAlignVertical: 'top', marginBottom: Spacing.md },
});
