import {
  NIGERIAN_BANKS,
  TRANSACTION_FILTERS,
  derivePaymentStatus,
  formatStatusLabel,
  getPaymentStatusMeta,
  getTransactionMeta,
} from '../walletHelpers';
import { Transaction } from '../../types';

const tx = (over: Partial<Transaction>): Transaction => ({
  id: 't1',
  type: 'BOOKING_PAYMENT',
  direction: 'DEBIT',
  amount: 1000,
  description: '',
  created_at: '',
  booking_id: 'b1',
  reference: 'ref',
  status: 'success',
  ...over,
});

describe('getTransactionMeta', () => {
  it('maps every known transaction type to its label/icon/tone', () => {
    expect(getTransactionMeta('BOOKING_PAYMENT')).toEqual({
      label: 'Booking Payment',
      icon: 'cart-outline',
      tone: 'error',
    });
    expect(getTransactionMeta('WITHDRAWAL').tone).toBe('error');
    expect(getTransactionMeta('REFUND').tone).toBe('success');
    expect(getTransactionMeta('ESCROW_HOLD').tone).toBe('warning');
  });

  it('is case-insensitive and trims whitespace', () => {
    expect(getTransactionMeta('  topup ')).toEqual(getTransactionMeta('TOPUP'));
  });

  it('treats TOPUP and WALLET_TOPUP identically', () => {
    expect(getTransactionMeta('WALLET_TOPUP')).toEqual(getTransactionMeta('TOPUP'));
  });

  it('title-cases an unknown type and derives tone from direction', () => {
    expect(getTransactionMeta('MYSTERY_FEE', 'CREDIT')).toEqual({
      label: 'Mystery Fee',
      icon: 'swap-horizontal-outline',
      tone: 'success',
    });
    expect(getTransactionMeta('MYSTERY_FEE', 'DEBIT').tone).toBe('error');
    expect(getTransactionMeta('MYSTERY_FEE').tone).toBe('neutral');
  });

  it('falls back to a generic label for empty types', () => {
    expect(getTransactionMeta('')).toEqual({
      label: 'Transaction',
      icon: 'swap-horizontal-outline',
      tone: 'neutral',
    });
  });
});

describe('getPaymentStatusMeta', () => {
  it('returns the configured label/tone for known statuses', () => {
    expect(getPaymentStatusMeta('paid')).toEqual({ label: 'Paid', tone: 'info' });
    expect(getPaymentStatusMeta('completed')).toEqual({ label: 'Completed', tone: 'success' });
    expect(getPaymentStatusMeta('cancelled')).toEqual({ label: 'Cancelled', tone: 'error' });
  });

  it('falls back to Unknown/neutral for an unrecognized status', () => {
    expect(getPaymentStatusMeta('bogus' as never)).toEqual({ label: 'Unknown', tone: 'neutral' });
  });
});

describe('formatStatusLabel', () => {
  it('uses the exact production label for known statuses', () => {
    expect(formatStatusLabel('pending_payment')).toBe('Awaiting Payment');
    expect(formatStatusLabel('user_no_show')).toBe('Customer No-Show');
    expect(formatStatusLabel('confirmed')).toBe('Confirmed');
  });

  it('is case-insensitive on known statuses', () => {
    expect(formatStatusLabel('CONFIRMED')).toBe('Confirmed');
  });

  it('title-cases unknown statuses without inventing new text', () => {
    expect(formatStatusLabel('some_new_state')).toBe('Some New State');
  });

  it('returns an empty string for empty input', () => {
    expect(formatStatusLabel('')).toBe('');
  });
});

describe('derivePaymentStatus', () => {
  it('reports refunded when a related REFUND transaction exists', () => {
    const status = derivePaymentStatus(
      { id: 'b1', status: 'completed' },
      [tx({ type: 'REFUND', booking_id: 'b1' })]
    );
    expect(status).toBe('refunded');
  });

  it('only matches transactions for the same booking id', () => {
    const status = derivePaymentStatus(
      { id: 'b1', status: 'completed' },
      [tx({ type: 'REFUND', booking_id: 'b2' })]
    );
    expect(status).toBe('completed');
  });

  it.each(['canceled', 'cancelled', 'declined', 'rejected', 'user_no_show', 'provider_no_show'])(
    'maps cancellation-like status "%s" to cancelled',
    (s) => {
      expect(derivePaymentStatus({ id: 'b1', status: s })).toBe('cancelled');
    }
  );

  it('maps pending_payment to awaiting_payment', () => {
    expect(derivePaymentStatus({ id: 'b1', status: 'pending_payment' })).toBe('awaiting_payment');
  });

  it('treats pending (already paid, awaiting provider) as paid, not awaiting_payment', () => {
    expect(derivePaymentStatus({ id: 'b1', status: 'pending' })).toBe('paid');
  });

  it('maps confirmed to escrow', () => {
    expect(derivePaymentStatus({ id: 'b1', status: 'confirmed' })).toBe('escrow');
  });

  it('distinguishes completed vs released by an escrow-release transaction', () => {
    expect(derivePaymentStatus({ id: 'b1', status: 'completed' })).toBe('completed');
    expect(
      derivePaymentStatus({ id: 'b1', status: 'completed' }, [
        tx({ type: 'ESCROW_RELEASE', booking_id: 'b1' }),
      ])
    ).toBe('released');
  });

  it('matches transactions by string-coerced booking id', () => {
    const status = derivePaymentStatus(
      { id: 42 as unknown as string, status: 'completed' },
      [tx({ type: 'ESCROW_RELEASE', booking_id: '42' })]
    );
    expect(status).toBe('released');
  });

  it('defaults to awaiting_payment for an unknown status', () => {
    expect(derivePaymentStatus({ id: 'b1', status: 'weird' })).toBe('awaiting_payment');
  });
});

describe('static reference lists', () => {
  it('exposes an "all" filter first plus per-type filters', () => {
    expect(TRANSACTION_FILTERS[0]).toEqual({ key: 'all', label: 'All' });
    expect(TRANSACTION_FILTERS.map((f) => f.key)).toContain('WITHDRAWAL');
  });

  it('lists Nigerian banks with no duplicates', () => {
    expect(NIGERIAN_BANKS).toContain('Guaranty Trust Bank (GTBank)');
    expect(new Set(NIGERIAN_BANKS).size).toBe(NIGERIAN_BANKS.length);
  });
});
