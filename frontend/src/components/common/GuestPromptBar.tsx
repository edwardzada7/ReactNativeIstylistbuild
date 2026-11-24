import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, FontSizes, Spacing, BorderRadius } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';

/** "Sign up or sign in for more" banner for guests. Hidden once signed in, or dismissed for this session. */
export function GuestPromptBar() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [hidden, setHidden] = useState(false);
  if (isAuthenticated || hidden) return null;
  return (
    <View style={styles.bar} testID="guest-prompt-bar">
      <View style={{ flex: 1 }}>
        <Text style={styles.text}>Sign up or sign in for more: book stylists, chat, save favourites & more.</Text>
        <View style={styles.row}>
          <TouchableOpacity style={styles.btn} onPress={() => router.push('/(auth)/signup')}><Text style={[styles.btnText, { color: Colors.primary }]}>Sign up</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.outline]} onPress={() => router.push('/(auth)/login')}><Text style={[styles.btnText, { color: '#fff' }]}>Sign in</Text></TouchableOpacity>
        </View>
      </View>
      <TouchableOpacity onPress={() => setHidden(true)} accessibilityLabel="Dismiss" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Ionicons name="close" size={18} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, backgroundColor: Colors.primary, borderRadius: BorderRadius.md, padding: Spacing.sm, marginHorizontal: Spacing.lg, marginTop: Spacing.sm },
  text: { color: '#fff', fontSize: FontSizes.sm, fontWeight: '600' },
  row: { flexDirection: 'row', gap: 8, marginTop: 8 },
  btn: { backgroundColor: '#fff', borderRadius: BorderRadius.sm, paddingHorizontal: 14, paddingVertical: 6 },
  outline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: 'rgba(255,255,255,0.7)' },
  btnText: { fontWeight: '700', fontSize: FontSizes.sm },
});
