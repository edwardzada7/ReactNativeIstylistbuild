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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Colors, FontSizes, Spacing, BorderRadius } from '../../src/constants/theme';
import { Input } from '../../src/components/common';
import { useAuth } from '../../src/contexts/AuthContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { chatService, ChatMessage } from '../../src/services/chat.service';
import apiService from '../../src/services/api';

/**
 * Chat thread using booking-based endpoints to match web implementation.
 * Chat is tied to bookings - accessed via booking_id with counterpart information.
 */
export default function ChatThread() {
  const router = useRouter();
  const { colors } = useTheme();
  const { counterpartAuthId, counterpartName, bookingId } = useLocalSearchParams<{
    counterpartAuthId: string;
    counterpartName?: string;
    bookingId?: string;
  }>();
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [resolvedCounterpartName, setResolvedCounterpartName] = useState<string | undefined>(counterpartName);

  const loadData = useCallback(async () => {
    if (!bookingId) return;
    try {
      setMessages(await chatService.getThread(Number(bookingId)));
      
      // Fetch counterpart's actual name if not provided or if it's "Unknown"
      if (!resolvedCounterpartName || resolvedCounterpartName === 'Unknown' || resolvedCounterpartName === 'Chat') {
        try {
          // First try to get as provider (stylist)
          const stylistProfile = await apiService.get(`/stylists/by-auth/${counterpartAuthId}`).catch(() => null);
          let name = 'Unknown';
          if (stylistProfile) {
            // Provider: prioritize business_name, then salon_name, then user name
            name = stylistProfile?.business_name || stylistProfile?.salon_name || stylistProfile?.name || 'Unknown';
          } else {
            // Fallback to user table for customers
            const userProfile = await apiService.get(`/users/by-auth/${counterpartAuthId}`);
            name = userProfile?.name || userProfile?.full_name || 'Unknown';
          }
          setResolvedCounterpartName(name);
        } catch (err) {
          console.warn('[chat] failed to load counterpart profile', err);
        }
      }
    } catch (err) {
      console.error('[chat] failed to load thread', err);
    } finally {
      setLoading(false);
    }
  }, [bookingId, counterpartAuthId, resolvedCounterpartName]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleSend = async () => {
    if (!text.trim() || !bookingId) return;
    const body = text.trim();
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
        <Text style={[styles.title, { color: colors.text }]}>{resolvedCounterpartName || 'Chat'}</Text>
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
              return (
                <View style={[styles.bubbleWrapper, isMine ? styles.bubbleWrapperMine : styles.bubbleWrapperTheirs]}>
                  <View style={[styles.bubble, isMine ? styles.bubbleMine : { backgroundColor: colors.surface }]}>
                    <Text style={[styles.bubbleText, { color: isMine ? '#fff' : colors.text }]}>{item.message}</Text>
                    <Text style={[styles.timestamp, { color: colors.textSecondary }]}>
                      {formatTime(item.created_at)}
                    </Text>
                  </View>
                </View>
              );
            }}
          />
        )}
        <View style={[styles.inputRow, { borderTopColor: colors.border }]}>
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
  bubbleMine: { backgroundColor: Colors.primary },
  bubbleText: { fontSize: FontSizes.sm },
  timestamp: { fontSize: 10, marginTop: 4, textAlign: 'right' },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderTopWidth: 1 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
});
