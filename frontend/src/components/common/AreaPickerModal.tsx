import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { fetchAreas, ServiceArea } from '../../services/location.service';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (area: ServiceArea) => void;
  selectedId?: number | null;
}

/** Pick your area from the list. No map service needed. */
export function AreaPickerModal({ visible, onClose, onSelect, selectedId }: Props) {
  const { colors } = useTheme();
  const [areas, setAreas] = useState<ServiceArea[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!visible || areas.length) return;
    setLoading(true);
    setFailed(false);
    fetchAreas().then(setAreas).catch(() => setFailed(true)).finally(() => setLoading(false));
  }, [visible, areas.length]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Choose your area</Text>
          <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Close"><Ionicons name="close" size={24} color={colors.text} /></TouchableOpacity>
        </View>
        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
        ) : failed || areas.length === 0 ? (
          <Text style={{ color: colors.textSecondary, textAlign: 'center', marginTop: 40, paddingHorizontal: 24 }}>We couldn't load the areas. Check your connection and try again.</Text>
        ) : (
          <FlatList
            data={areas}
            keyExtractor={(a) => String(a.id)}
            renderItem={({ item }) => (
              <TouchableOpacity testID={`area-${item.id}`} style={[styles.row, { borderBottomColor: colors.border }]} onPress={() => { onSelect(item); onClose(); }} accessibilityRole="button">
                <Text style={{ color: colors.text, fontSize: 16, flex: 1 }}>{item.name}</Text>
                {selectedId === item.id && <Ionicons name="checkmark" size={20} color={colors.primary} />}
              </TouchableOpacity>
            )}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  title: { fontSize: 20, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
});
