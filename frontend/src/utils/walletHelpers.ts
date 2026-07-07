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
 * Formats a raw booking lifecycle `status` string into a readable label.
 * Known values use the EXACT label text from the production web app's
 * STATUS_CONFIG (BookingDetailsScreen.jsx); anything else falls back to a
 * generic Title Case formatter - never inventing a new status, only
 * formatting whatever the backend actually returns.
 */
const KNOWN_STATUS_LABELS: Record<string, string> = {
  pending_payment: 'Awaiting Payment',
  pending: 'Pending',
  confirmed: 'Confirmed',
  completed: 'Completed',
  canceled: 'Canceled',
  declined: 'Declined',
  no_show_pending: 'No-Show Pending',
  user_no_show: 'Customer No-Show',
  provider_no_show: 'Provider No-Show',
  disputed: 'Disputed',
};

export function formatStatusLabel(status: string): string {
  const key = (status || '').toLowerCase();
  if (KNOWN_STATUS_LABELS[key]) return KNOWN_STATUS_LABELS[key];
  return (status || '')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Derives a booking's payment/escrow status from real data. GROUND TRUTH
 * (Phase 6.1 - verified against production web app source,
 * BookingDetailsScreen.jsx STATUS_CONFIG + canCustomerPay/canProviderConfirm
 * logic): the real lifecycle is
 *   pending_payment (unpaid) -> pending (paid, awaiting provider) ->
 *   confirmed (accepted, in progress) -> completed
 * "pending" does NOT mean unpaid - it means already paid, awaiting the
 * provider's accept/reject. Only "pending_payment" means awaiting payment.
 * This was previously inverted (status === 'pending' was treated as
 * awaiting payment), which caused the Pay from Wallet button to show for
 * already-paid bookings.
 */
export function derivePaymentStatus(
  booking: Pick<Booking, 'id' | 'status'>,
  transactions: Transaction[] = []
): BookingPaymentStatus {
  const related = transactions.filter((t) => t.booking_id === String(booking.id));
  const hasType = (needle: string) => related.some((t) => t.type.includes(needle));
  const status = (booking.status || '').toLowerCase();

  if (hasType('REFUND')) return 'refunded';
  if (['canceled', 'cancelled', 'declined', 'rejected', 'user_no_show', 'provider_no_show'].includes(status)) {
    return 'cancelled';
  }
  if (status === 'pending_payment') return 'awaiting_payment';
  if (status === 'completed') return hasType('RELEASE') ? 'released' : 'completed';
  if (status === 'confirmed') return 'escrow';
  if (status === 'pending') return 'paid';
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
