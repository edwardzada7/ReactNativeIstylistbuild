import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BorderRadius, FontSizes, Spacing } from '../../constants/theme';
import { useTheme } from '../../contexts/ThemeContext';
import { feedService } from '../../services/feed.service';
import { Comment } from '../../types';

export function FeedCommentsModal({
  visible,
  postId,
  onClose,
  onCommentAdded,
}: {
  visible: boolean;
  postId: string | null;
  onClose: () => void;
  onCommentAdded?: () => void;
}) {
  const { colors } = useTheme();
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !postId) return;
    let active = true;
    setLoading(true);
    setError(null);
    feedService
      .getComments(postId, { page: 1, per_page: 50 })
      .then((response: any) => {
        if (!active) return;
        const list = Array.isArray(response) ? response : response?.data || response?.comments || [];
        setComments(list);
      })
      .catch((err: any) => {
        if (active) setError(err?.friendlyMessage || err?.message || 'Could not load comments.');
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [visible, postId]);

  const submitComment = async () => {
    const content = commentText.trim();
    if (!postId || !content || submitting) return;
    setSubmitting(true);
    try {
      const created = await feedService.addComment(postId, content);
      setComments((current) => [...current, created]);
      setCommentText('');
      onCommentAdded?.();
    } catch (err: any) {
      setError(err?.friendlyMessage || err?.message || 'Could not add comment.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.sheet, { backgroundColor: colors.background }]}>
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Text style={[styles.title, { color: colors.text }]}>Comments</Text>
            <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Close comments">
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          {loading ? (
            <ActivityIndicator style={styles.loader} color={colors.primary} />
          ) : error ? (
            <Text style={[styles.error, { color: colors.error }]}>{error}</Text>
          ) : comments.length === 0 ? (
            <Text style={[styles.empty, { color: colors.textSecondary }]}>No comments yet.</Text>
          ) : (
            <FlatList
              data={comments}
              keyExtractor={(item, index) => String(item.id || index)}
              contentContainerStyle={styles.list}
              renderItem={({ item }) => (
                <View style={[styles.comment, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.author, { color: colors.text }]}>{item.user?.full_name || item.user?.name || 'User'}</Text>
                  <Text style={[styles.content, { color: colors.textSecondary }]}>{item.content}</Text>
                </View>
              )}
            />
          )}
          <View style={[styles.inputRow, { borderTopColor: colors.border }]}>
            <TextInput
              style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
              value={commentText}
              onChangeText={setCommentText}
              placeholder="Add a comment..."
              placeholderTextColor={colors.textMuted}
              editable={!submitting}
              returnKeyType="send"
              onSubmitEditing={submitComment}
            />
            <TouchableOpacity
              style={[styles.sendButton, { backgroundColor: colors.primary }, (!commentText.trim() || submitting) && styles.disabled]}
              onPress={submitComment}
              disabled={!commentText.trim() || submitting}
              accessibilityRole="button"
              accessibilityLabel="Post comment"
            >
              {submitting ? <ActivityIndicator color={colors.background} size="small" /> : <Ionicons name="send" size={18} color={colors.background} />}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { height: '72%', borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.lg, borderBottomWidth: 1 },
  title: { fontSize: FontSizes.lg, fontWeight: '700' },
  loader: { marginTop: Spacing.xl },
  error: { padding: Spacing.lg, textAlign: 'center' },
  empty: { flex: 1, textAlign: 'center', paddingTop: Spacing.xl },
  list: { padding: Spacing.lg },
  comment: { paddingVertical: Spacing.sm, borderBottomWidth: 1 },
  author: { fontSize: FontSizes.sm, fontWeight: '700' },
  content: { marginTop: 4, fontSize: FontSizes.sm, lineHeight: 20 },
  inputRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center', padding: Spacing.md, borderTopWidth: 1 },
  input: { flex: 1, minHeight: 42, maxHeight: 100, borderWidth: 1, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  sendButton: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center' },
  disabled: { opacity: 0.5 },
});
