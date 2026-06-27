import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSizes, Spacing, BorderRadius } from '../../src/constants/theme';
import { Button } from '../../src/components/common';
import { authService } from '../../src/services/auth.service';

export default function VerifyOTP() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email: string }>();
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const inputRefs = useRef<Array<TextInput | null>>([]);

  const handleOtpChange = (value: string, index: number) => {
    if (isNaN(Number(value))) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const code = otp.join('');
    if (code.length !== 6) {
      Alert.alert('Error', 'Please enter the complete OTP');
      return;
    }

    setLoading(true);
    try {
      await authService.verifyOTP({ email: params.email, code });
      Alert.alert('Success', 'Your account has been verified!', [
        {
          text: 'OK',
          onPress: () => router.replace('/(tabs)'),
        },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      await authService.resendOTP(params.email);
      Alert.alert('Success', 'OTP has been resent to your email');
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to resend OTP');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => router.back()}
      >
        <Ionicons name="arrow-back" size={24} color={Colors.text} />
      </TouchableOpacity>

      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Ionicons name="mail-outline" size={48} color={Colors.primary} />
          </View>
          <Text style={styles.title}>Verify Your Email</Text>
          <Text style={styles.subtitle}>
            We've sent a 6-digit code to{' \n'}
            <Text style={styles.email}>{params.email}</Text>
          </Text>
        </View>

        <View style={styles.otpContainer}>
          {otp.map((digit, index) => (
            <TextInput
              key={index}
              ref={(ref) => (inputRefs.current[index] = ref)}
              style={styles.otpInput}
              value={digit}
              onChangeText={(value) => handleOtpChange(value, index)}
              onKeyPress={(e) => handleKeyPress(e, index)}
              keyboardType="number-pad"
              maxLength={1}
              selectTextOnFocus
            />
          ))}
        </View>

        <Button
          title="Verify"
          onPress={handleVerify}
          loading={loading}
          fullWidth
          size="large"
        />

        <View style={styles.resend}>
          <Text style={styles.resendText}>Didn't receive the code? </Text>
          <TouchableOpacity onPress={handleResend}>
            <Text style={styles.resendLink}>Resend</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.xl,
  },
  backButton: {
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
  },
  content: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.xxl,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: FontSizes.xxl,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  subtitle: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  email: {
    color: Colors.primary,
    fontWeight: '600',
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.xl,
  },
  otpInput: {
    width: 48,
    height: 56,
    borderWidth: 2,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    textAlign: 'center',
    fontSize: FontSizes.xl,
    fontWeight: 'bold',
    color: Colors.text,
    backgroundColor: Colors.surface,
  },
  resend: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: Spacing.lg,
  },
  resendText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
  },
  resendLink: {
    fontSize: FontSizes.md,
    color: Colors.primary,
    fontWeight: '600',
  },
});