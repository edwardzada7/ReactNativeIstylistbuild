import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';

/** Blue verified tick shown next to verified providers/users everywhere. */
export function VerifiedBadge({ verified, size = 16 }: { verified?: boolean | null; size?: number }) {
  if (!verified) return null;
  return <Ionicons name="checkmark-circle" size={size} color={Colors.info} accessibilityLabel="Verified" />;
}

export const isVerifiedProfile = (p: any): boolean =>
  !!p && (p.isVerified === true || p.isKycVerified === true || p.is_verified === true || p.verified === true || p.user?.isKycVerified === true);
