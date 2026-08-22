import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useUnreadMessages } from '../../contexts/UnreadMessagesContext';

interface ChatIconWithBadgeProps {
  color: string;
  size: number;
}

export function ChatIconWithBadge({ color, size }: ChatIconWithBadgeProps) {
  const { unreadCount } = useUnreadMessages();
  return (
    <View style={styles.container}>
      <Ionicons name="chatbubble-outline" size={size} color={color} />
      {unreadCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'relative' },
  badge: { position: 'absolute', right: -10, top: -8, minWidth: 16, height: 16, paddingHorizontal: 3, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#d92d20' },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },
});
