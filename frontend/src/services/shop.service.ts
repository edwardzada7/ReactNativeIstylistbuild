import { supabase } from '../lib/supabase';
import apiService, { localApiService } from './api';

export interface Product {
  id: number;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  image_urls: string[] | null;
  stylist_auth_id: string;
  approved: boolean;
  category?: string | null;
  created_at: string;
}

export interface OrderItemSummary {
  id: number;
  quantity: number;
  price: number;
  product_id?: number;
  products?: { name?: string; image_urls?: string[] | null } | null;
}

export interface Order {
  id: number;
  customer_auth_id: string;
  provider_auth_id?: string | null;
  customer_name?: string | null;
  status: string;
  total_amount: number;
  subtotal?: number | null;
  delivery_fee?: number | null;
  payment_reference?: string | null;
  payment_status?: string | null;
  created_at: string;
  items?: OrderItemSummary[];
  provider_name?: string | null;
}

/**
 * Shop (Phase 3A). Reuses the EXISTING `products`, `orders`, `order_items`
 * tables exactly as confirmed via the backend audit - no new tables. Reads
 * go straight to Supabase (RLS-verified: customers see only `approved`
 * products; providers can manage their own products via direct
 * insert/update). Order creation goes through the local backend's
 * `/api/shop/orders` bridge because RLS blocks a direct client insert into
 * `orders`/`order_items` (verified: Postgres error 42501).
 */
export const shopService = {
  async getProducts(): Promise<Product[]> {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('approved', true)
      .gt('stock', 0)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async getProduct(id: number): Promise<Product | null> {
    const { data, error } = await supabase.from('products').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data;
  },

  async getProviderProducts(stylistAuthId: string): Promise<Product[]> {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('stylist_auth_id', stylistAuthId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async createProduct(input: { name: string; description: string; price: number; stock: number; image_urls?: string[] }): Promise<Product> {
    const authId = await apiService.getAuthId();
    if (!authId) throw new Error('Not authenticated');
    const { data, error } = await supabase
      .from('products')
      .insert({ ...input, stylist_auth_id: authId, approved: false })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateProduct(id: number, input: Partial<{ name: string; description: string; price: number; stock: number; image_urls: string[] }>): Promise<void> {
    const { error } = await supabase.from('products').update(input).eq('id', id);
    if (error) throw error;
  },

  async deleteProduct(id: number): Promise<void> {
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) throw error;
  },

  async createOrder(input: {
    items: { product_id: number; quantity: number }[];
    payment_reference?: string;
    payment_status?: string;
    subtotal?: number;
    delivery_fee?: number;
    total_amount?: number;
    customer_name?: string;
    provider_auth_id?: string;
    order_status?: string;
  }): Promise<any> {
    return await localApiService.post('/shop/orders', input);
  },

  async initializeFlutterwaveCheckout(input: {
    amount: number;
    email: string;
    purpose: 'wallet_topup';
    name?: string;
    phone?: string;
    redirect_url?: string;
    currency?: string;
  }): Promise<{ status: boolean; authorization_url?: string; tx_ref?: string; message?: string }> {
    return apiService.post('/payments/flutterwave/initialize', input);
  },

  async verifyFlutterwaveCheckout(input: {
    reference: string;
    transaction_id?: string | null;
    items?: { product_id: number; quantity: number }[];
    amount?: number;
    email?: string;
    name?: string;
    phone?: string;
    currency?: string;
  }): Promise<{ status: string; message?: string; order?: any }> {
    return apiService.get('/payments/flutterwave/verify', {
      params: {
        reference: input.reference,
        ...(input.transaction_id ? { transaction_id: input.transaction_id } : {}),
      },
    });
  },

  async getMyOrders(): Promise<Order[]> {
    const authId = await apiService.getAuthId();
    if (!authId) return [];
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('customer_auth_id', authId)
      .order('created_at', { ascending: false });
    if (error) throw error;

    const orders = (data || []) as Order[];
    return await Promise.all(
      orders.map(async (order) => {
        const items = await this.getOrderItems(order.id);
        let provider_name: string | null = null;
        if (order.provider_auth_id) {
          try {
            const profile = await apiService.get<any>(`/users/by-auth/${order.provider_auth_id}`);
            provider_name = profile?.name || profile?.full_name || null;
          } catch (err) {
            console.warn('[shop] failed to load provider profile', err);
          }
        }
        return { ...order, items, provider_name };
      })
    );
  },

  async getProviderOrders(providerAuthId: string): Promise<Order[]> {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('provider_auth_id', providerAuthId)
      .order('created_at', { ascending: false });
    if (error) throw error;

    const orders = (data || []) as Order[];
    return await Promise.all(
      orders.map(async (order) => {
        const items = await this.getOrderItems(order.id);
        let customer_name: string | null = null;
        if (order.customer_auth_id) {
          try {
            const profile = await apiService.get<any>(`/users/by-auth/${order.customer_auth_id}`);
            customer_name = profile?.name || profile?.full_name || null;
          } catch (err) {
            console.warn('[shop] failed to load customer profile', err);
          }
        }
        return { ...order, items, customer_name };
      })
    );
  },

  async getOrderItems(orderId: number): Promise<any[]> {
    const { data, error } = await supabase
      .from('order_items')
      .select('*, products(name, image_urls)')
      .eq('order_id', orderId);
    if (error) throw error;
    return data || [];
  },

  async updateOrderStatus(orderId: number, status: string): Promise<any> {
    return await localApiService.patch(`/shop/orders/${orderId}`, { status });
  },
};
