import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, Vibration, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { BorderRadius, Colors, FontSizes, Spacing } from '../../src/constants/theme';
import { useTheme } from '../../src/contexts/ThemeContext';
import { ScanResult, ScannerSession, eventsService } from '../../src/services/events.service';

const RESULT_STYLE: Record<string, { bg: string; icon: keyof typeof Ionicons.glyphMap; title: string }> = {
  valid: { bg: '#16A34A', icon: 'checkmark-circle', title: 'VALID' },
  used: { bg: '#DC2626', icon: 'close-circle', title: 'ALREADY USED' },
  canceled: { bg: '#DC2626', icon: 'close-circle', title: 'CANCELED' },
  wrong_event: { bg: '#D97706', icon: 'alert-circle', title: 'WRONG EVENT' },
  invalid: { bg: '#DC2626', icon: 'close-circle', title: 'INVALID' },
};

/** Door scanner for event staff: enter the event's scanner code, then scan QR codes or type the 6-digit PIN. */
export default function EventScanner() {
  const router = useRouter();
  const { colors } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [codeInput, setCodeInput] = useState('');
  const [accessCode, setAccessCode] = useState<string | null>(null);
  const [session, setSession] = useState<ScannerSession | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [pin, setPin] = useState('');
  const [result, setResult] = useState<ScanResult | null>(null);
  const [counts, setCounts] = useState({ total: 0, checked_in: 0 });
  const [history, setHistory] = useState<{ label: string; ok: boolean; text: string }[]>([]);
  const [cameraOn, setCameraOn] = useState(true);
  const busyRef = useRef(false);
  const lastRef = useRef({ code: '', at: 0 });

  const signIn = async () => {
    const code = codeInput.trim().toUpperCase();
    if (code.length < 4) return;
    setSigningIn(true);
    setLoginError('');
    try {
      const s = await eventsService.scannerLogin(code);
      setAccessCode(code);
      setSession(s);
      setCounts({ total: s.total, checked_in: s.checked_in });
    } catch (e: any) {
      setLoginError(e?.friendlyMessage || e?.response?.data?.detail || 'Could not sign in. Check the code and your connection.');
    } finally {
      setSigningIn(false);
    }
  };

  const check = useCallback(
    async (raw: string) => {
      if (!accessCode || !session || busyRef.current) return;
      const code = raw.trim();
      const now = Date.now();
      if (code === lastRef.current.code && now - lastRef.current.at < 4000) return;
      lastRef.current = { code, at: now };
      busyRef.current = true;
      try {
        const res = await eventsService.scan(accessCode, code, session.event_id);
        setResult(res);
        if (res.total !== undefined && res.checked_in !== undefined) setCounts({ total: res.total, checked_in: res.checked_in });
        setHistory((h) => [{ label: res.holder || res.message, ok: res.result === 'valid', text: res.result === 'valid' ? 'Admitted' : res.result === 'used' ? 'Used' : 'Rejected' }, ...h].slice(0, 15));
        Vibration.vibrate(res.result === 'valid' ? 80 : [0, 120, 60, 120]);
      } catch (e: any) {
        setResult({ result: 'invalid', message: e?.friendlyMessage || e?.response?.data?.detail || 'Could not check this ticket. Check your connection.' });
      } finally {
        busyRef.current = false;
      }
    },
    [accessCode, session],
  );

  if (!session) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <TouchableOpacity style={styles.back} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <KeyboardAvoidingView behavior="padding" style={styles.loginWrap}>
          <Ionicons name="scan-outline" size={48} color={Colors.primary} />
          <Text style={[styles.loginTitle, { color: colors.text }]}>Ticket scanner</Text>
          <Text style={[styles.loginText, { color: colors.textSecondary }]}>Enter the scanner code you were given for this event.</Text>
          {/^\d{6}$/.test(codeInput.trim()) ? (
            <Text style={{ color: '#B45309', textAlign: 'center' }}>That looks like a ticket PIN. Scanner codes are 8 letters/numbers made by the organiser.</Text>
          ) : null}
          {loginError ? <Text style={{ color: Colors.error, textAlign: 'center' }}>{loginError}</Text> : null}
          <TextInput
            value={codeInput}
            onChangeText={(v) => { setLoginError(''); setCodeInput(v.toUpperCase()); }}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder="SCANNER CODE"
            placeholderTextColor={colors.textMuted}
            style={[styles.codeInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
            testID="scanner-code-input"
          />
          <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: Colors.primary, opacity: codeInput.trim().length < 4 || signingIn ? 0.6 : 1 }]} disabled={codeInput.trim().length < 4 || signingIn} onPress={signIn}>
            {signingIn ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Start scanning</Text>}
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  const style = result ? RESULT_STYLE[result.result] || RESULT_STYLE.invalid : null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.loginTitle, { color: colors.text, fontSize: FontSizes.lg }]} numberOfLines={1}>{session.event_title}</Text>
          <Text style={{ color: colors.textSecondary, fontSize: FontSizes.xs }}>Checked in {counts.checked_in} / {counts.total}</Text>
        </View>
        <TouchableOpacity onPress={() => Alert.alert('Sign out of scanner?', undefined, [{ text: 'Cancel', style: 'cancel' }, { text: 'Sign out', onPress: () => { setSession(null); setAccessCode(null); setResult(null); setHistory([]); } }])}>
          <Text style={{ color: Colors.primary, fontWeight: '700' }}>Sign out</Text>
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={{ padding: Spacing.md, gap: Spacing.md }} keyboardShouldPersistTaps="handled">
        <View style={styles.cameraBox}>
          {!permission ? (
            <View style={styles.camFallback}><ActivityIndicator color="#fff" /></View>
          ) : !permission.granted ? (
            <View style={styles.camFallback}>
              <Ionicons name="camera-outline" size={40} color="#9CA3AF" />
              <Text style={{ color: '#D1D5DB', textAlign: 'center', marginVertical: 8 }}>
                {permission.canAskAgain ? 'Allow the camera to scan QR codes.' : 'Camera is blocked. Enable it in Settings > Apps > iStylist > Permissions, or type the PIN below.'}
              </Text>
              {permission.canAskAgain && (
                <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: Colors.primary, paddingHorizontal: 24 }]} onPress={requestPermission}><Text style={styles.primaryText}>Allow camera</Text></TouchableOpacity>
              )}
            </View>
          ) : cameraOn ? (
            <>
              <CameraView
                style={StyleSheet.absoluteFill}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                onBarcodeScanned={({ data }) => check(data)}
              />
              <View style={styles.frame} pointerEvents="none" />
            </>
          ) : (
            <View style={styles.camFallback}><Ionicons name="camera-outline" size={40} color="#9CA3AF" /></View>
          )}
        </View>
        {permission?.granted && (
          <TouchableOpacity style={[styles.outlineBtn, { borderColor: colors.border }]} onPress={() => setCameraOn((v) => !v)}>
            <Text style={{ color: colors.text, fontWeight: '600' }}>{cameraOn ? 'Pause camera' : 'Resume camera'}</Text>
          </TouchableOpacity>
        )}

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TextInput
            value={pin}
            onChangeText={(v) => setPin(v.replace(/\D/g, '').slice(0, 6))}
            keyboardType="number-pad"
            placeholder="6-digit PIN"
            placeholderTextColor={colors.textMuted}
            style={[styles.codeInput, { flex: 1, color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
            testID="scanner-pin-input"
          />
          <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: Colors.primary, paddingHorizontal: 20, opacity: pin.length === 6 ? 1 : 0.5 }]} disabled={pin.length !== 6} onPress={() => { check(pin); setPin(''); }}>
            <Text style={styles.primaryText}>Check</Text>
          </TouchableOpacity>
        </View>

        {result && style && (
          <View style={[styles.result, { backgroundColor: style.bg }]} testID="scan-result">
            <Ionicons name={style.icon} size={56} color="#fff" />
            <Text style={styles.resultTitle}>{style.title}</Text>
            <Text style={styles.resultText}>{result.message}</Text>
            {result.holder ? <Text style={[styles.resultText, { fontWeight: '700' }]}>{result.holder} · {result.ticket_type}</Text> : null}
            {result.result === 'used' && result.used_at ? <Text style={styles.resultText}>Used at {new Date(result.used_at).toLocaleTimeString()}</Text> : null}
          </View>
        )}

        {history.length > 0 && (
          <View style={[styles.history, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={{ color: colors.textSecondary, fontSize: FontSizes.xs, fontWeight: '700', padding: Spacing.sm }}>Recent scans</Text>
            {history.map((h, i) => (
              <View key={i} style={[styles.historyRow, { borderTopColor: colors.border }]}>
                <Text style={{ color: colors.text, flex: 1 }} numberOfLines={1}>{h.label}</Text>
                <Text style={{ color: h.ok ? '#15803D' : '#DC2626', fontWeight: '700' }}>{h.text}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  back: { padding: Spacing.md },
  loginWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.lg, gap: Spacing.sm },
  loginTitle: { fontSize: FontSizes.xl, fontWeight: '800' },
  loginText: { fontSize: FontSizes.md, textAlign: 'center' },
  codeInput: { alignSelf: 'stretch', borderWidth: 1, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, height: 52, fontSize: FontSizes.lg, textAlign: 'center', letterSpacing: 4 },
  primaryBtn: { alignSelf: 'stretch', height: 52, borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#fff', fontWeight: '800', fontSize: FontSizes.md },
  outlineBtn: { borderWidth: 1, borderRadius: BorderRadius.md, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  cameraBox: { width: '100%', aspectRatio: 1, backgroundColor: '#000', borderRadius: BorderRadius.lg, overflow: 'hidden' },
  camFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  frame: { position: 'absolute', top: '15%', left: '15%', right: '15%', bottom: '15%', borderWidth: 2, borderColor: 'rgba(255,255,255,0.8)', borderRadius: 16 },
  result: { borderRadius: BorderRadius.lg, padding: Spacing.lg, alignItems: 'center', gap: 4 },
  resultTitle: { color: '#fff', fontSize: 26, fontWeight: '900' },
  resultText: { color: '#fff', fontSize: FontSizes.md, textAlign: 'center' },
  history: { borderWidth: 1, borderRadius: BorderRadius.md, overflow: 'hidden' },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: Spacing.sm, borderTopWidth: StyleSheet.hairlineWidth },
});
