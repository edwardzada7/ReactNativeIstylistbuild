import React, { useRef } from 'react';
import { Dimensions, FlatList, Image, Modal, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

/** Full-screen photo viewer: swipe between photos, tap X (or Android back) to close. */
export function PhotoViewer({ urls, startIndex = 0, visible, onClose }: { urls: string[]; startIndex?: number; visible: boolean; onClose: () => void }) {
  const [index, setIndex] = React.useState(startIndex);
  const { width, height } = Dimensions.get('window');
  const ref = useRef<FlatList<string>>(null);
  React.useEffect(() => { if (visible) setIndex(startIndex); }, [visible, startIndex]);
  if (!visible) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        <StatusBar hidden />
        <FlatList
          ref={ref}
          data={urls}
          horizontal
          pagingEnabled
          initialScrollIndex={Math.min(startIndex, Math.max(urls.length - 1, 0))}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          showsHorizontalScrollIndicator={false}
          keyExtractor={(u, i) => u + i}
          onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
          renderItem={({ item }) => <Image source={{ uri: item }} style={{ width, height }} resizeMode="contain" />}
        />
        <SafeAreaView style={styles.top} edges={['top']} pointerEvents="box-none">
          <TouchableOpacity onPress={onClose} style={styles.close} accessibilityLabel="Close photo" hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          {urls.length > 1 && <Text style={styles.count}>{index + 1} / {urls.length}</Text>}
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000' },
  top: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8 },
  close: { backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 20, padding: 6 },
  count: { color: '#fff', fontWeight: '700', backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, overflow: 'hidden' },
});
