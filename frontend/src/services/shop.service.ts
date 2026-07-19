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
  created_at: string;
}

export interface Order {
  id: number;
  customer_auth_id: string;
  status: string;
  total_amount: number;
  created_at: string;
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

  async createOrder(items: { product_id: number; quantity: number }[]): Promise<any> {
    return await localApiService.post('/shop/orders', { items });
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
    return data || [];
  },

  async getOrderItems(orderId: number): Promise<any[]> {
    const { data, error } = await supabase
      .from('order_items')
      .select('*, products(name, image_urls)')
      .eq('order_id', orderId);
    if (error) throw error;
    return data || [];
  },
};
