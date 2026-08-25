import { normalizeShopCategoryMetadata } from '../constants/shopCategories';
import { supabase } from '../lib/supabase';
import { ProductReview, ProductReviewsResponse } from '../types';
import apiService from './api';

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
  main_category?: string | null;
  subcategory?: string | null;
  featured_collection?: string | null;
  moderation_status?: 'pending' | 'approved' | 'rejected';
  status?: string;
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

function normalizeProductCategoryMetadata(product: Partial<Product>): Product {
  const normalized = normalizeShopCategoryMetadata({
    category: product.main_category || product.category,
    subcategory: product.subcategory,
    main_category: product.main_category || product.category,
  });

  return {
    ...(product as Product),
    category: normalized.category ?? product.category ?? null,
    main_category: normalized.main_category ?? product.main_category ?? product.category ?? null,
    subcategory: normalized.subcategory ?? product.subcategory ?? null,
    featured_collection: product.featured_collection ?? null,
  } as Product;
}

function isColumnMissingError(error: any): boolean {
  const message = `${error?.message || ''}`.toLowerCase();
  return message.includes('column') && (message.includes('does not exist') || message.includes('not exist') || message.includes('unknown'));
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
  async getProducts(params?: { includeUnapproved?: boolean; includeOutOfStock?: boolean }): Promise<Product[]> {
    let query = supabase.from('products').select('*');

    if (!params?.includeUnapproved) {
      query = query.eq('approved', true);
    }

    if (!params?.includeOutOfStock) {
      query = query.gt('stock', 0);
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map((product) => normalizeProductCategoryMetadata(product as Product));
  },

  async getProduct(id: number): Promise<Product | null> {
    const { data, error } = await supabase.from('products').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data ? normalizeProductCategoryMetadata(data as Product) : null;
  },

  async getProviderProducts(stylistAuthId: string): Promise<Product[]> {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('stylist_auth_id', stylistAuthId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map((product) => normalizeProductCategoryMetadata(product as Product));
  },

  async createProduct(input: {
    name: string;
    description: string;
    price: number;
    stock: number;
    image_urls?: string[];
    category?: string | null;
    main_category?: string | null;
    subcategory?: string | null;
    featured_collection?: string | null;
  }): Promise<Product> {
    const authId = await apiService.getAuthId();
    if (!authId) throw new Error('Not authenticated');

    const payload = {
      name: input.name,
      description: input.description,
      price: input.price,
      stock: input.stock,
      image_urls: input.image_urls,
      stylist_auth_id: authId,
      approved: false,
      ...(input.category ? { category: input.category } : {}),
      ...(input.main_category ? { main_category: input.main_category } : {}),
      ...(input.subcategory ? { subcategory: input.subcategory } : {}),
      ...(input.featured_collection ? { featured_collection: input.featured_collection } : {}),
    };

    try {
      const { data, error } = await supabase.from('products').insert(payload).select().single();
      if (error) throw error;
      return normalizeProductCategoryMetadata(data as Product);
    } catch (error) {
      if (!isColumnMissingError(error)) throw error;
      const { main_category, subcategory, featured_collection, ...fallbackPayload } = payload;
      const { data, error: fallbackError } = await supabase.from('products').insert(fallbackPayload).select().single();
      if (fallbackError) throw fallbackError;
      return normalizeProductCategoryMetadata(data as Product);
    }
  },

  async updateProduct(id: number, input: Partial<{
    name: string;
    description: string;
    price: number;
    stock: number;
    image_urls: string[];
    approved: boolean;
    category: string | null;
    main_category: string | null;
    subcategory: string | null;
    featured_collection: string | null;
    moderation_status: 'pending' | 'approved' | 'rejected';
    status: string;
  }>): Promise<void> {
    const payload = { ...input };
    try {
      const { error } = await supabase.from('products').update(payload).eq('id', id);
      if (error) throw error;
    } catch (error) {
      if (!isColumnMissingError(error)) throw error;
      const { main_category, subcategory, featured_collection, ...fallbackPayload } = payload;
      const { error: fallbackError } = await supabase.from('products').update(fallbackPayload).eq('id', id);
      if (fallbackError) throw fallbackError;
    }
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
    payment_method?: string;
    delivery_address?: string;
    currency?: string;
  }): Promise<any> {
    const sanitizedItems = (input.items || []).filter((item) => item && Number.isFinite(item.product_id) && Number.isFinite(item.quantity) && item.quantity > 0);
    const subtotal = Number(input.subtotal ?? 0);
    const deliveryFee = Number(input.delivery_fee ?? 0);
    const totalAmount = Number(input.total_amount ?? subtotal + deliveryFee);

    return await apiService.post('/shop/orders', {
      ...input,
      items: sanitizedItems,
      subtotal: Number.isFinite(subtotal) ? subtotal : 0,
      delivery_fee: Number.isFinite(deliveryFee) ? deliveryFee : 0,
      total_amount: Number.isFinite(totalAmount) ? totalAmount : 0,
      payment_method: (input.payment_method || 'paystack').trim() || 'paystack',
      delivery_address: (input.delivery_address || '').trim() || 'Delivery address not provided',
      currency: (input.currency || 'NGN').trim().toUpperCase() || 'NGN',
    });
  },

  async initializePaystackCheckout(input: {
    amount: number;
    email: string;
    items?: { product_id: number; quantity: number }[];
    name?: string;
    phone?: string;
    redirect_url?: string;
    currency?: string;
    payment_method?: string;
    delivery_address?: string;
    cartItems?: { product_id: number; quantity: number }[];
    totalAmount?: number;
    deliveryAddressId?: string;
    paymentMethod?: string;
  }): Promise<{ status: boolean; authorization_url?: string; reference?: string; message?: string }> {
    const sanitizedItems = (input.items || []).filter((item) => item && Number.isFinite(item.product_id) && Number.isFinite(item.quantity) && item.quantity > 0);
    const amount = Number(input.amount || 0);
    const body: Record<string, any> = {
      amount: Number.isFinite(amount) ? amount : 0,
      email: input.email,
      currency: (input.currency || 'NGN').trim().toUpperCase() || 'NGN',
      payment_method: (input.payment_method || 'paystack').trim() || 'paystack',
      ...(sanitizedItems.length > 0 ? { items: sanitizedItems } : {}),
      cartItems: input.cartItems || sanitizedItems,
      totalAmount: Number(input.totalAmount ?? amount),
      paymentMethod: input.paymentMethod || input.payment_method || 'paystack',
    };

    if (input.name) body.name = input.name;
    if (input.phone) body.phone = input.phone;
    if (input.redirect_url) body.redirect_url = input.redirect_url;
    if (input.delivery_address) body.delivery_address = input.delivery_address.trim();
    if (input.deliveryAddressId) body.deliveryAddressId = input.deliveryAddressId;

    return apiService.post('/payments/paystack/shop/initialize', body);
  },

  async verifyPaystackCheckout(input: {
    reference: string;
    transaction_id?: string | null;
    items?: { product_id: number; quantity: number }[];
    amount?: number;
    email?: string;
    name?: string;
    phone?: string;
    currency?: string;
    provider_auth_id?: string;
    payment_method?: string;
    delivery_address?: string;
  }): Promise<{ status: string; message?: string; order?: any }> {
    const sanitizedItems = (input.items || []).filter((item) => item && Number.isFinite(item.product_id) && Number.isFinite(item.quantity) && item.quantity > 0);
    return apiService.get('/payments/paystack/shop/verify', {
      params: {
        reference: input.reference,
        ...(input.transaction_id ? { transaction_id: input.transaction_id } : {}),
        ...(input.amount !== undefined ? { amount: Number(input.amount) || 0 } : {}),
        ...(input.currency ? { currency: input.currency.trim().toUpperCase() } : {}),
        ...(input.email ? { email: input.email } : {}),
        ...(input.name ? { name: input.name } : {}),
        ...(input.phone ? { phone: input.phone } : {}),
        ...(input.provider_auth_id ? { provider_auth_id: input.provider_auth_id } : {}),
        ...(input.payment_method ? { payment_method: input.payment_method.trim() } : {}),
        ...(input.delivery_address ? { delivery_address: input.delivery_address.trim() } : {}),
        ...(sanitizedItems.length > 0 ? { items: JSON.stringify(sanitizedItems) } : {}),
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
    return await apiService.patch(`/shop/orders/${orderId}`, { status });
  },

  async getProductReviews(productId: number): Promise<ProductReviewsResponse> {
    return await apiService.get<ProductReviewsResponse>(`/shop/products/${productId}/reviews`);
  },

  async createProductReview(
    productId: number,
    input: { rating: number; review_text: string; comment?: string; product_id?: number; productId?: number; user_id?: string; order_id?: number | null; item_id?: number | null }
  ): Promise<ProductReview> {
    const authId = await apiService.getAuthId();
    if (!authId) throw new Error('Not authenticated');

    const reviewText = String(input.review_text ?? input.comment ?? '').trim();
    const rating = Number(input.rating);
    const normalizedPayload = {
      product_id: Number(input.product_id ?? input.productId ?? productId),
      productId: Number(input.product_id ?? input.productId ?? productId),
      user_id: String(input.user_id ?? authId),
      order_id: input.order_id != null ? Number(input.order_id) : null,
      item_id: input.item_id != null ? Number(input.item_id) : null,
      rating,
      review_text: reviewText,
      comment: reviewText,
    };

    if (!Number.isInteger(normalizedPayload.rating) || normalizedPayload.rating < 1 || normalizedPayload.rating > 5) {
      throw new Error('Please select a rating from 1 to 5 stars.');
    }
    if (!normalizedPayload.review_text) {
      throw new Error('Please write a review before submitting.');
    }

    return await apiService.post<ProductReview>(`/shop/products/${productId}/reviews`, normalizedPayload);
  },

  async updateProductReview(
    productId: number,
    reviewId: number,
    input: { rating: number; review_text: string; comment?: string; product_id?: number; productId?: number; user_id?: string; order_id?: number | null; item_id?: number | null }
  ): Promise<ProductReview> {
    const authId = await apiService.getAuthId();
    if (!authId) throw new Error('Not authenticated');

    const reviewText = String(input.review_text ?? input.comment ?? '').trim();
    const rating = Number(input.rating);
    const normalizedPayload = {
      product_id: Number(input.product_id ?? input.productId ?? productId),
      productId: Number(input.product_id ?? input.productId ?? productId),
      user_id: String(input.user_id ?? authId),
      order_id: input.order_id != null ? Number(input.order_id) : null,
      item_id: input.item_id != null ? Number(input.item_id) : null,
      rating,
      review_text: reviewText,
      comment: reviewText,
    };

    if (!Number.isInteger(normalizedPayload.rating) || normalizedPayload.rating < 1 || normalizedPayload.rating > 5) {
      throw new Error('Please select a rating from 1 to 5 stars.');
    }
    if (!normalizedPayload.review_text) {
      throw new Error('Please write a review before submitting.');
    }

    return await apiService.patch<ProductReview>(`/shop/products/${productId}/reviews/${reviewId}`, normalizedPayload);
  },

  async deleteProductReview(productId: number, reviewId: number): Promise<void> {
    const authId = await apiService.getAuthId();
    if (!authId) throw new Error('Not authenticated');
    await apiService.delete(`/shop/products/${productId}/reviews/${reviewId}`);
  },
};
