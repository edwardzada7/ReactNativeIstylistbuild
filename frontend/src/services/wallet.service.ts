import apiService from './api';
import { Wallet, Transaction, WithdrawRequest } from '../types';

const asList = (raw: any): any[] => {
  if (Array.isArray(raw)) return raw;
  return raw?.data || raw?.transactions || raw?.results || [];
};

function normalizeWallet(raw: any): Wallet {
  return {
    id: String(raw?.id ?? ''),
    user_auth_id: raw?.user_auth_id ?? '',
    balance: Number(raw?.balance ?? 0),
  };
}

function normalizeTransaction(raw: any): Transaction {
  const amount = Math.abs(Number(raw?.amount ?? 0));
  return {
    id: String(raw?.id ?? ''),
    type: String(raw?.type ?? raw?.raw_type ?? 'ADJUSTMENT').toUpperCase(),
    direction: String(raw?.direction ?? (amount >= 0 ? 'CREDIT' : 'DEBIT')).toUpperCase(),
    amount,
    description: raw?.description ?? '',
    created_at: raw?.created_at ?? new Date().toISOString(),
    booking_id: raw?.booking_id != null ? String(raw.booking_id) : null,
    reference: raw?.reference ?? '',
    status: String(raw?.status ?? 'completed').toLowerCase(),
  };
}

export const walletService = {
  // Real contract (verified via direct API probe): GET /api/wallets returns
  // EVERY wallet in the system - there is no per-user filter param on the
  // backend, so we fetch the list and match the current user's Supabase
  // auth id client-side.
  async getWallet(authId: string): Promise<Wallet | null> {
    if (!authId) return null;
    const raw = await apiService.get<any>('/wallets');
    const match = asList(raw).find((w: any) => w.user_auth_id === authId);
    return match ? normalizeWallet(match) : null;
  },

  // Real contract (verified via direct API probe): GET /api/wallet/transactions
  // requires `auth_id` as a query param and returns a flat array (already
  // newest-first in production data).
  async getTransactions(authId: string): Promise<Transaction[]> {
    if (!authId) return [];
    const raw = await apiService.get<any>('/wallet/transactions', { params: { auth_id: authId } });
    return asList(raw).map(normalizeTransaction);
  },

  // Real contract (verified via direct API probe): POST /api/wallets/{id}/topup
  // requires `amount` as a query param and credits the wallet directly. This
  // is called after a Flutterwave checkout reports a successful payment -
  // Flutterwave's own server-to-server webhook (/api/webhooks/flutterwave,
  // confirmed to exist and signature-protected) is the authoritative source
  // of truth on the backend; this call is the client-facing complement that
  // reflects the top-up immediately instead of waiting on webhook timing.
  async topUp(walletId: string, amount: number): Promise<void> {
    await apiService.post(`/wallets/${walletId}/topup`, null, { params: { amount } });
  },

  // KNOWN BACKEND LIMITATION: no withdrawal-request creation endpoint could
  // be found on the production API after testing 20+ plausible route names
  // (e.g. /wallet/withdraw, /wallets/{id}/withdraw, /withdrawal-requests,
  // /wallets/{id}/payout, /wallets/{id}/cashout - all 404). This throws a
  // clear, typed error so the UI can show a "coming soon" message instead of
  // silently failing or pretending the request succeeded.
  async requestWithdrawal(_data: WithdrawRequest): Promise<never> {
    const err: any = new Error('Withdrawals are not yet supported by the production API.');
    err.friendlyMessage =
      'Withdrawal requests are coming soon. This feature is not yet available on the server.';
    throw err;
  },
};
