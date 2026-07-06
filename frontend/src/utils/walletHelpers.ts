import { Booking, Transaction, BookingPaymentStatus } from '../types';

export type Tone = 'success' | 'error' | 'warning' | 'info' | 'neutral';

interface TransactionMeta {
  label: string;
  icon: string;
  tone: Tone;
}

// Real transaction `type` values per the product spec: Booking Payment,
// Wallet Top-up, Refund, Escrow Hold, Escrow Release, Withdrawal,
// Adjustment, Platform Credit. Only "WITHDRAWAL" was directly observed in
// production data during API inspection, so this mapping is deliberately
// defensive - any type string not listed here (typo, new backend value,
// etc.) still renders a sensible label/tone instead of crashing or showing
// nothing (see the fallback in getTransactionMeta below).
const TYPE_META: Record<string, TransactionMeta> = {
  BOOKING_PAYMENT: { label: 'Booking Payment', icon: 'cart-outline', tone: 'error' },
  TOPUP: { label: 'Wallet Top-up', icon: 'add-circle-outline', tone: 'success' },
  WALLET_TOPUP: { label: 'Wallet Top-up', icon: 'add-circle-outline', tone: 'success' },
  REFUND: { label: 'Refund', icon: 'return-down-back-outline', tone: 'success' },
  ESCROW_HOLD: { label: 'Escrow Hold', icon: 'lock-closed-outline', tone: 'warning' },
  ESCROW_RELEASE: { label: 'Escrow Release', icon: 'lock-open-outline', tone: 'success' },
  WITHDRAWAL: { label: 'Withdrawal', icon: 'arrow-up-circle-outline', tone: 'error' },
  ADJUSTMENT: { label: 'Adjustment', icon: 'construct-outline', tone: 'info' },
  PLATFORM_CREDIT: { label: 'Platform Credit', icon: 'gift-outline', tone: 'success' },
};

export function getTransactionMeta(type: string, direction?: string): TransactionMeta {
  const key = (type || '').toUpperCase().trim();
  const meta = TYPE_META[key];
  if (meta) return meta;
  const label =
    key
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase()) || 'Transaction';
  const tone: Tone = direction === 'CREDIT' ? 'success' : direction === 'DEBIT' ? 'error' : 'neutral';
  return { label, icon: 'swap-horizontal-outline', tone };
}

export const TRANSACTION_FILTERS: { key: string; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'BOOKING_PAYMENT', label: 'Bookings' },
  { key: 'TOPUP', label: 'Top-ups' },
  { key: 'REFUND', label: 'Refunds' },
  { key: 'ESCROW_HOLD', label: 'Escrow Hold' },
  { key: 'ESCROW_RELEASE', label: 'Escrow Release' },
  { key: 'WITHDRAWAL', label: 'Withdrawals' },
];

const STATUS_LABEL: Record<BookingPaymentStatus, { label: string; tone: Tone }> = {
  awaiting_payment: { label: 'Awaiting Payment', tone: 'warning' },
  paid: { label: 'Paid', tone: 'info' },
  escrow: { label: 'In Escrow', tone: 'warning' },
  completed: { label: 'Completed', tone: 'success' },
  released: { label: 'Released', tone: 'success' },
  refunded: { label: 'Refunded', tone: 'info' },
  cancelled: { label: 'Cancelled', tone: 'error' },
};

export function getPaymentStatusMeta(key: BookingPaymentStatus) {
  return STATUS_LABEL[key] || { label: 'Unknown', tone: 'neutral' as Tone };
}

/**
 * Derives a booking's payment/escrow status from real data. The production
 * API has no dedicated `payment_status` or `escrow` field on bookings, so
 * this combines the booking's real lifecycle `status` with any matching
 * wallet transactions (filtered by `booking_id`) when available. Passing no
 * transactions still yields a sensible best-effort status from `status`
 * alone - this is never fabricated data, only a computed view of real
 * fields.
 */
export function derivePaymentStatus(
  booking: Pick<Booking, 'id' | 'status'>,
  transactions: Transaction[] = []
): BookingPaymentStatus {
  const related = transactions.filter((t) => t.booking_id === String(booking.id));
  const hasType = (needle: string) => related.some((t) => t.type.includes(needle));
  const status = (booking.status || '').toLowerCase();

  if (hasType('REFUND')) return 'refunded';
  if (['cancelled', 'rejected', 'declined'].includes(status)) return 'cancelled';
  if (status === 'completed') return hasType('RELEASE') ? 'released' : 'completed';
  if (hasType('ESCROW_HOLD') || hasType('BOOKING_PAYMENT')) {
    return ['confirmed', 'arrived'].includes(status) ? 'escrow' : 'paid';
  }
  if (['confirmed', 'arrived'].includes(status)) return 'paid';
  return 'awaiting_payment';
}

// Static reference list for the withdrawal bank picker. The production API
// has no bank-list endpoint (confirmed via direct probe), so this is a
// plain UI reference list of real Nigerian bank names - not fabricated
// business/financial data.
export const NIGERIAN_BANKS: string[] = [
  'Access Bank',
  'Citibank Nigeria',
  'Ecobank Nigeria',
  'Fidelity Bank',
  'First Bank of Nigeria',
  'First City Monument Bank (FCMB)',
  'Globus Bank',
  'Guaranty Trust Bank (GTBank)',
  'Jaiz Bank',
  'Keystone Bank',
  'Kuda Microfinance Bank',
  'Moniepoint MFB',
  'Opay',
  'Palmpay',
  'Polaris Bank',
  'Providus Bank',
  'Stanbic IBTC Bank',
  'Standard Chartered Bank',
  'Sterling Bank',
  'SunTrust Bank',
  'Titan Trust Bank',
  'Union Bank of Nigeria',
  'United Bank for Africa (UBA)',
  'Unity Bank',
  'Wema Bank',
  'Zenith Bank',
];
