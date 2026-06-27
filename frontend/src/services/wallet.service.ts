import apiService from './api';
import { Wallet, Transaction, WithdrawRequest, PaginatedResponse } from '../types';

export const walletService = {
  // Get wallet balance
  async getWallet(): Promise<Wallet> {
    return await apiService.get<Wallet>('/wallet');
  },

  // Get transactions
  async getTransactions(params?: {
    type?: string;
    page?: number;
    per_page?: number;
  }): Promise<PaginatedResponse<Transaction>> {
    return await apiService.get<PaginatedResponse<Transaction>>('/wallet/transactions', {
      params,
    });
  },

  // Initiate withdrawal
  async withdraw(data: WithdrawRequest): Promise<Transaction> {
    return await apiService.post<Transaction>('/wallet/withdraw', data);
  },

  // Fund wallet
  async fundWallet(amount: number): Promise<{ payment_link: string; reference: string }> {
    return await apiService.post('/wallet/fund', { amount });
  },

  // Verify payment
  async verifyPayment(reference: string): Promise<Transaction> {
    return await apiService.post<Transaction>('/wallet/verify-payment', { reference });
  },
};