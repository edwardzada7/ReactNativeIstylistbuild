import React, { useState } from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BorderRadius, FontSizes, Spacing } from '../../constants/theme';
import { useTheme } from '../../contexts/ThemeContext';
import { supportService } from '../../services/support.service';

export type ReportTargetType = 'POST' | 'PRODUCT';

interface ReportModalProps {
  visible: boolean;
  targetId: string | number | null;
  targetType: ReportTargetType;
  onClose: () => void;
  onSubmitted?: () => void;
}

const REASONS = ['Spam', 'Harassment', 'Inappropriate content', 'Scam or fraud', 'Other'];

export function ReportModal({ visible, targetId, targetType, onClose, onSubmitted }: ReportModalProps) {
  const { colors } = useTheme();
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setReason('');
    setDescription('');
  };

  const handleClose = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (!targetId || !reason || submitting) return;
    setSubmitting(true);
    try {
      await supportService.createReport({
        target_id: String(targetId),
        target_type: targetType,
        reason,
        description: description.trim(),
      });
      reset();
      onSubmitted?.();
      onClose();
    } catch (error) {
      console.error('[report] submission failed', error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>Report {targetType === 'POST' ? 'post' : 'product'}</Text>
            <TouchableOpacity onPress={handleClose} accessibilityRole="button" accessibilityLabel="Close report modal">
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Why are you reporting this?</Text>
          <View style={styles.reasonList}>
            {REASONS.map((option) => (
              <TouchableOpacity
                key={option}
                style={[styles.reason, { borderColor: colors.border }, reason === option && { backgroundColor: `${colors.primary}18`, borderColor: colors.primary }]}
                onPress={() => setReason(option)}
                accessibilityRole="radio"
                accessibilityState={{ selected: reason === option }}
              >
                <Ionicons name={reason === option ? 'radio-button-on' : 'radio-button-off'} size={20} color={reason === option ? colors.primary : colors.textMuted} />
                <Text style={[styles.reasonText, { color: colors.text }]}>{option}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Add details (optional)"
            placeholderTextColor={colors.textMuted}
            multiline
            style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          />
          <View style={styles.actions}>
            <TouchableOpacity style={[styles.cancelButton, { borderColor: colors.border }]} onPress={handleClose} disabled={submitting}>
              <Text style={[styles.cancelText, { color: colors.text }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.submitButton, { backgroundColor: colors.primary }, !reason && styles.disabled]} onPress={handleSubmit} disabled={!reason || submitting}>
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Submit report</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', padding: Spacing.lg, backgroundColor: 'rgba(0,0,0,0.45)' },
  card: { borderRadius: BorderRadius.lg, padding: Spacing.lg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
  title: { fontSize: FontSizes.lg, fontWeight: '700' },
  label: { fontSize: FontSizes.sm, marginBottom: Spacing.sm },
  reasonList: { gap: Spacing.sm },
  reason: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, borderWidth: 1, borderRadius: BorderRadius.md, padding: Spacing.sm },
  reasonText: { fontSize: FontSizes.sm },
  input: { minHeight: 72, marginTop: Spacing.md, borderWidth: 1, borderRadius: BorderRadius.md, padding: Spacing.sm, textAlignVertical: 'top' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.sm, marginTop: Spacing.lg },
  cancelButton: { borderWidth: 1, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  cancelText: { fontSize: FontSizes.sm, fontWeight: '600' },
  submitButton: { minWidth: 120, alignItems: 'center', borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  submitText: { color: '#fff', fontSize: FontSizes.sm, fontWeight: '700' },
  disabled: { opacity: 0.5 },
});
