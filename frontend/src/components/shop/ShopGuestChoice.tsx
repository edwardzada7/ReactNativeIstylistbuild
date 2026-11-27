import React, { useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, FontSizes, Spacing, BorderRadius } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';

// Shown once per app visit (until the app is closed) to signed-out shoppers.
let choiceMade = false;

export function ShopGuestChoice() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [open, setOpen] = useState(!choiceMade);
  if (isAuthenticated || !open) return null;

  const close = () => {
    choiceMade = true;
    setOpen(false);
  };
  const go = (path: string) => {
    close();
    router.push(path as any);
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <View style={styles.backdrop}>
        <View style={styles.card} testID="shop-guest-choice">
          <Text style={styles.title}>Welcome to the iStylist Shop</Text>
          <Text style={styles.body}>
            Shop right away as a guest, or create an account to track orders, save favourites and ask sellers questions.
          </Text>
          <TouchableOpacity style={styles.primary} onPress={close} accessibilityRole="button">
            <Text style={styles.primaryText}>Continue as guest</Text>
          </TouchableOpacity>
          <View style={styles.row}>
            <TouchableOpacity style={styles.outline} onPress={() => go('/(auth)/signup')}>
              <Text style={styles.outlineText}>Sign up</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.outline} onPress={() => go('/(auth)/login')}>
              <Text style={styles.outlineText}>Sign in</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.note}>Guests can browse and buy. Asking questions, reviews and saving need an account.</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: Spacing.lg },
  card: { backgroundColor: '#fff', borderRadius: BorderRadius.xl, padding: Spacing.lg, gap: Spacing.sm },
  title: { fontSize: FontSizes.lg, fontWeight: '800', textAlign: 'center', color: '#111' },
  body: { fontSize: FontSizes.sm, color: '#555', textAlign: 'center' },
  primary: { backgroundColor: Colors.primary, borderRadius: BorderRadius.md, paddingVertical: 14, alignItems: 'center', marginTop: Spacing.sm },
  primaryText: { color: '#fff', fontWeight: '800', fontSize: FontSizes.md },
  row: { flexDirection: 'row', gap: Spacing.sm },
  outline: { flex: 1, borderWidth: 1, borderColor: Colors.primary, borderRadius: BorderRadius.md, paddingVertical: 12, alignItems: 'center' },
  outlineText: { color: Colors.primary, fontWeight: '700' },
  note: { fontSize: FontSizes.xs, color: '#777', textAlign: 'center' },
});
