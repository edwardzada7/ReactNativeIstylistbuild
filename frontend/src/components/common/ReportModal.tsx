import React, { useState } from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BorderRadius, FontSizes, Spacing } from '../../constants/theme';
import { useTheme } from '../../contexts/ThemeContext';
import { feedService } from '../../services/feed.service';
import { supportService } from '../../services/support.service';

export type ReportTargetType = 'POST' | 'PRODUCT' | 'FEED_POST';

interface ReportModalProps {
  visible: boolean;
  targetId: string | number | null;
  targetType: ReportTargetType;
  onClose: () => void;
  onSubmitted?: () => void;
}

// label -> backend REPORT_REASONS value
const REASONS: { label: string; value: string }[] = [
  { label: 'Spam', value: 'spam' },
  { label: 'Harassment', value: 'harassment' },
  { label: 'Inappropriate content', value: 'inappropriate_content' },
  { label: 'Scam or fraud', value: 'scam_fraud' },
  { label: 'Other', value: 'other' },
];

export function ReportModal({ visible, targetId, targetType, onClose, onSubmitted }: ReportModalProps) {
  const { colors } = useTheme();
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [validationMessage, setValidationMessage] = useState('');

  const reset = () => {
    setReason('');
    setDescription('');
    setValidationMessage('');
  };

  const handleClose = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  const handleSubmitReport = async () => {
    if (submitting) return;
    if (!targetId || !reason) {
      setValidationMessage('Select a reason before submitting your report.');
      return;
    }
    setValidationMessage('');
    setSubmitting(true);
    try {
      if (targetType === 'FEED_POST') {
        await feedService.reportPost(String(targetId), reason, description);
      } else {
        await supportService.createReport({
          target_id: String(targetId),
          target_type: targetType,
          reason: REASONS.find((r) => r.value === reason)?.label || reason,
          description: description.trim(),
        });
      }
      reset();
      onSubmitted?.();
      onClose();
    } catch (error: any) {
      console.error('[report] submission failed', error);
      setValidationMessage(error?.friendlyMessage || error?.message || 'Could not submit report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>Report {targetType === 'PRODUCT' ? 'product' : 'post'}</Text>
            <TouchableOpacity onPress={handleClose} accessibilityRole="button" accessibilityLabel="Close report modal">
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Why are you reporting this?</Text>
          <View style={styles.reasonList}>
            {REASONS.map(({ label, value }) => (
              <TouchableOpacity
                key={value}
                testID={`report-reason-${value}`}
                style={[styles.reason, { borderColor: colors.border }, reason === value && { backgroundColor: `${colors.primary}18`, borderColor: colors.primary }]}
                onPress={() => setReason(value)}
                accessibilityRole="radio"
                accessibilityState={{ selected: reason === value }}
              >
                <Ionicons name={reason === value ? 'radio-button-on' : 'radio-button-off'} size={20} color={reason === value ? colors.primary : colors.textMuted} />
                <Text style={[styles.reasonText, { color: colors.text }]} textBreakStrategy="simple">{label}</Text>
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
          {validationMessage ? <Text style={[styles.validationMessage, { color: colors.error }]}>{validationMessage}</Text> : null}
          <View style={styles.actions}>
            <TouchableOpacity style={[styles.cancelButton, { borderColor: colors.border }]} onPress={handleClose} disabled={submitting}>
              <Text style={[styles.cancelText, { color: colors.text }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.submitButton, { backgroundColor: colors.primary }, submitting && styles.disabled]} onPress={handleSubmitReport} disabled={submitting}>
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
  reasonText: { fontSize: FontSizes.sm, flex: 1, paddingRight: 4 },
  input: { minHeight: 72, marginTop: Spacing.md, borderWidth: 1, borderRadius: BorderRadius.md, padding: Spacing.sm, textAlignVertical: 'top' },
  validationMessage: { fontSize: FontSizes.xs, marginTop: Spacing.xs },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.sm, marginTop: Spacing.lg },
  cancelButton: { borderWidth: 1, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  cancelText: { fontSize: FontSizes.sm, fontWeight: '600' },
  submitButton: { minWidth: 120, alignItems: 'center', borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  submitText: { color: '#fff', fontSize: FontSizes.sm, fontWeight: '700' },
  disabled: { opacity: 0.5 },
});
