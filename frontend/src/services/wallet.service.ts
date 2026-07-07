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

  // GROUND TRUTH (Phase 6.4 - verified against production web app source,
  // frontend/src/screens/WalletScreen.jsx handleTopUp + frontend/src/services/api.js
  // paymentsAPI.initialize/verify): top-up does NOT call a direct
  // /wallets/{id}/topup credit endpoint. It is a real hosted-checkout flow:
  //   1) POST /payments/flutterwave/initialize
  //      { amount, email, purpose: "wallet_topup", name?, phone?, redirect_url? }
  //      -> { status, authorization_url, message }
  //   2) customer completes payment on Flutterwave's hosted page
  //   3) Flutterwave redirects back to redirect_url with
  //      ?status=successful&tx_ref=...&transaction_id=...
  //   4) GET /payments/flutterwave/verify?reference={tx_ref}&transaction_id={id}
  //      -> { status: "success"|..., amount, message } - THIS is what
  //      actually confirms + credits the wallet server-side.
  // The previous /wallets/{id}/topup call skipped steps 1-3 entirely and
  // never actually verified anything with Flutterwave, which is why a
  // real successful payment could still end up showing "Payment Failed"
  // with no wallet credit.
  async initializePayment(data: {
    amount: number;
    email: string;
    purpose: 'wallet_topup';
    name?: string;
    phone?: string;
    redirect_url?: string;
  }): Promise<{ status: boolean; authorization_url?: string; message?: string }> {
    return apiService.post('/payments/flutterwave/initialize', data);
  },

  async verifyPayment(
    reference: string,
    transactionId?: string | null
  ): Promise<{ status: string; amount?: number; message?: string }> {
    return apiService.get('/payments/flutterwave/verify', {
      params: { reference, ...(transactionId ? { transaction_id: transactionId } : {}) },
    });
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
