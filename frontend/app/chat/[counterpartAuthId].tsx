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
import { chatService, ChatMessage } from '../../src/services/chat.service';

/**
 * Chat thread (Phase 3A - Priority 5). Real data via chatService, which
 * reads the EXISTING `chats` table directly via Supabase (RLS-verified: a
 * user only ever sees messages where they are sender or receiver) and
 * sends via the local backend's `/api/chat/messages` bridge (RLS blocks a
 * direct client insert into `chats`, verified 42501). Reached from a
 * booking's details screen ("Message" button) - one thread per
 * counterpart, matching the real table's shape (sender/receiver pair, no
 * separate "conversation" concept exists in the schema).
 */
export default function ChatThread() {
  const router = useRouter();
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

  const loadData = useCallback(async () => {
    if (!counterpartAuthId) return;
    try {
      setMessages(await chatService.getThread(counterpartAuthId));
    } catch (err) {
      console.error('[chat] failed to load thread', err);
    } finally {
      setLoading(false);
    }
  }, [counterpartAuthId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleSend = async () => {
    if (!text.trim() || !counterpartAuthId) return;
    const body = text.trim();
    setText('');
    setSending(true);
    try {
      const sent = await chatService.sendMessage(counterpartAuthId, body, bookingId ? Number(bookingId) : undefined);
      setMessages((prev) => [...prev, sent]);
    } catch (err) {
      console.error('[chat] failed to send', err);
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{counterpartName || 'Chat'}</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        {loading ? (
          <View style={styles.centerState}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : (
          <FlatList
            data={messages}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <View style={styles.centerState}>
                <Ionicons name="chatbubble-outline" size={28} color={Colors.textMuted} />
                <Text style={styles.emptyText}>Say hello to get the conversation started.</Text>
              </View>
            }
            renderItem={({ item }) => {
              const isMine = item.sender_auth_id === user?.auth_id;
              return (
                <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
                  <Text style={[styles.bubbleText, isMine && styles.bubbleTextMine]}>{item.message}</Text>
                </View>
              );
            }}
          />
        )}
        <View style={styles.inputRow}>
          <View style={{ flex: 1 }}>
            <Input value={text} onChangeText={setText} placeholder="Type a message..." />
          </View>
          <TouchableOpacity style={styles.sendBtn} onPress={handleSend} disabled={sending || !text.trim()} accessibilityRole="button" accessibilityLabel="Send message">
            {sending ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="send" size={18} color="#fff" />}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  title: { fontSize: FontSizes.lg, fontWeight: 'bold', color: Colors.text },
  centerState: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.sm, paddingTop: Spacing.xxl },
  emptyText: { fontSize: FontSizes.sm, color: Colors.textSecondary },
  list: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.md, flexGrow: 1 },
  bubble: { maxWidth: '78%', borderRadius: BorderRadius.md, padding: Spacing.sm, marginBottom: Spacing.sm },
  bubbleMine: { backgroundColor: Colors.primary, alignSelf: 'flex-end' },
  bubbleTheirs: { backgroundColor: Colors.surface, alignSelf: 'flex-start' },
  bubbleText: { fontSize: FontSizes.sm, color: Colors.text },
  bubbleTextMine: { color: '#fff' },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
});
