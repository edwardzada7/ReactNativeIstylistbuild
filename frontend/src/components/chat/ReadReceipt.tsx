import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ReadReceiptProps {
  isRead?: boolean;
}

export function ReadReceipt({ isRead = false }: ReadReceiptProps) {
  return (
    <View style={styles.container} accessibilityLabel={isRead ? 'Read' : 'Sent'}>
      <Ionicons name={isRead ? 'checkmark-done' : 'checkmark'} size={14} color={isRead ? '#2f80ed' : '#98a2b3'} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginLeft: 4 },
});
