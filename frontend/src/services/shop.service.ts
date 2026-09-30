import { normalizeShopCategoryMetadata } from "../constants/shopCategories";
import { supabase } from "../lib/supabase";
import { ProductReview, ProductReviewsResponse } from "../types";
import apiService from "./api";

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
  moderation_status?: "pending" | "approved" | "rejected";
  status?: string;
  created_at: string;
  seller_listing_id?: number;
  seller_id?: number;
  seller_name?: string | null;
  seller_type?: "official" | "provider" | "brand_partner" | string | null;
  listing_status?: string | null;
  isMarketplaceListing?: boolean;
  provider_purchase_enabled?: boolean | null;
  provider_purchase_price?: number | null;
}

interface ProviderSeller {
  id: number;
  seller_type: string;
  provider_auth_id: string | null;
}

interface ProductListing {
  id: number;
  product_id: number;
  seller_id: number;
  price: number;
  stock: number;
  status?: string | null;
  provider_purchase_enabled?: boolean | null;
  provider_purchase_price?: number | null;
}

export interface ProviderInventory {
  id: number;
  product_id: number;
  source_listing_id: number;
  quantity: number;
  reserved_quantity?: number | null;
  quantity_allocated_to_listings?: number | null;
  products?: { name?: string; image_urls?: string[] | null } | null;
}

export interface PlatformReferralEarning {
  id: number | string;
  referral_type: string;
  product_id?: number | null;
  order_id?: number | null;
  sale_amount: number;
  earning_amount: number;
  status: string;
  available_at?: string | null;
  created_at: string;
  currency?: string | null;
  product_name?: string | null;
}

interface ShopSeller {
  id: number;
  seller_type?: string | null;
  provider_auth_id?: string | null;
  name?: string | null;
  display_name?: string | null;
  business_name?: string | null;
  seller_name?: string | null;
  status?: string | null;
  is_active?: boolean | null;
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
    main_category:
      normalized.main_category ??
      product.main_category ??
      product.category ??
      null,
    subcategory: normalized.subcategory ?? product.subcategory ?? null,
    featured_collection: product.featured_collection ?? null,
  } as Product;
}

function isColumnMissingError(error: any): boolean {
  const message = `${error?.message || ""}`.toLowerCase();
  return (
    message.includes("column") &&
    (message.includes("does not exist") ||
      message.includes("not exist") ||
      message.includes("unknown"))
  );
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
  async getProducts(params?: {
    includeUnapproved?: boolean;
    includeOutOfStock?: boolean;
  }): Promise<Product[]> {
    let query = supabase.from("products").select("*");

    if (!params?.includeUnapproved) {
      query = query.eq("approved", true);
    }

    if (!params?.includeOutOfStock && params?.includeUnapproved) {
      query = query.gt("stock", 0);
    }

    const { data, error } = await query.order("created_at", {
      ascending: false,
    });
    if (error) throw error;
    const products = (data || []).map((product) =>
      normalizeProductCategoryMetadata(product as Product),
    );
    if (params?.includeUnapproved) return products;

    try {
      const [
        { data: listingRows, error: listingError },
        { data: sellerRows, error: sellerError },
      ] = await Promise.all([
        supabase.from("product_listings").select("*"),
        supabase.from("shop_sellers").select("*"),
      ]);
      if (listingError) throw listingError;
      if (sellerError) throw sellerError;

      const sellers = (sellerRows || []) as ShopSeller[];
      const sellersById = new Map(
        sellers.map((seller) => [Number(seller.id), seller]),
      );
      const listings = (listingRows || []) as ProductListing[];
      const listedProductIds = new Set(
        listings.map((listing) => Number(listing.product_id)),
      );
      const productsById = new Map(
        products.map((product) => [Number(product.id), product]),
      );
      const marketplaceProducts = listings.flatMap((listing) => {
        const seller = sellersById.get(Number(listing.seller_id));
        const product = productsById.get(Number(listing.product_id));
        const sellerStatus = String(seller?.status || "").toLowerCase();
        const listingStatus = String(listing.status || "").toLowerCase();
        if (
          !seller ||
          !product ||
          seller.is_active === false ||
          ["inactive", "suspended"].includes(sellerStatus)
        )
          return [];
        if (listingStatus !== "active" || Number(listing.stock) <= 0) return [];

        return [
          normalizeProductCategoryMetadata({
            ...product,
            price: Number(listing.price),
            stock: Number(listing.stock),
            seller_listing_id: Number(listing.id),
            seller_id: Number(listing.seller_id),
            seller_type: seller.seller_type,
            seller_name:
              seller.display_name ||
              seller.business_name ||
              seller.seller_name ||
              seller.name ||
              null,
            listing_status: listing.status,
            provider_purchase_enabled: listing.provider_purchase_enabled ?? null,
            provider_purchase_price: listing.provider_purchase_price != null ? Number(listing.provider_purchase_price) : null,
            isMarketplaceListing: true,
          }),
        ];
      });

      const legacyProducts = products.filter(
        (product) =>
          !listedProductIds.has(Number(product.id)) &&
          Number(product.stock) > 0,
      );
      return [...marketplaceProducts, ...legacyProducts];
    } catch (sellerError) {
      console.warn(
        "[shop] seller listings unavailable; using legacy products",
        sellerError,
      );
      return products.filter((product) => Number(product.stock) > 0);
    }
  },

  async getProduct(
    id: number,
    sellerListingId?: number,
  ): Promise<Product | null> {
    const products = await this.getProducts();
    return (
      products.find(
        (product) =>
          Number(product.id) === id &&
          (!sellerListingId || product.seller_listing_id === sellerListingId),
      ) || null
    );
  },

  async getProviderProducts(stylistAuthId: string): Promise<Product[]> {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("stylist_auth_id", stylistAuthId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data || []).map((product) =>
      normalizeProductCategoryMetadata(product as Product),
    );
  },

  async getProviderSeller(
    providerAuthId: string,
  ): Promise<ProviderSeller | null> {
    const { data, error } = await supabase
      .from("shop_sellers")
      .select("id, seller_type, provider_auth_id")
      .eq("seller_type", "provider")
      .eq("provider_auth_id", providerAuthId)
      .maybeSingle();
    if (error) throw error;
    return data as ProviderSeller | null;
  },

  async getProviderShopProducts(providerAuthId: string): Promise<Product[]> {
    const seller = await this.getProviderSeller(providerAuthId);
    const ownProducts = await this.getProviderProducts(providerAuthId);
    if (!seller) return ownProducts;

    const { data: listingRows, error: listingError } = await supabase
      .from("product_listings")
      .select("id, product_id, price, stock")
      .eq("seller_id", seller.id);
    if (listingError) throw listingError;

    const listings = (listingRows || []) as ProductListing[];
    if (listings.length === 0) return ownProducts;

    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("*")
      .in(
        "id",
        listings.map((listing) => listing.product_id),
      );
    if (productsError) throw productsError;

    const productsById = new Map(
      (products || []).map((product) => [
        Number(product.id),
        product as Product,
      ]),
    );
    const listedProducts = listings.flatMap((listing) => {
      const product = productsById.get(Number(listing.product_id));
      if (!product) return [];
      return [
        normalizeProductCategoryMetadata({
          ...product,
          price: Number(listing.price),
          stock: Number(listing.stock),
          seller_listing_id: listing.id,
          isMarketplaceListing: true,
        }),
      ];
    });

    return [...listedProducts, ...ownProducts];
  },

  async addProductToProviderShop(
    product: Product,
  ): Promise<{ added: boolean }> {
    const authId = await apiService.getAuthId();
    if (!authId) throw new Error("Not authenticated");

    const seller = await this.getProviderSeller(authId);
    if (!seller)
      throw new Error(
        "Your provider shop seller account is not set up yet. Please contact support.",
      );

    const { data: existing, error: existingError } = await supabase
      .from("product_listings")
      .select("id")
      .eq("product_id", product.id)
      .eq("seller_id", seller.id)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing) return { added: false };

    const { error } = await supabase.from("product_listings").insert({
      product_id: product.id,
      seller_id: seller.id,
      price: product.price,
      stock: product.stock,
    });
    if (error) {
      if (error.code === "23505") return { added: false };
      throw error;
    }
    return { added: true };
  },

  async initializeProviderPurchase(input: {
    listing_id: number;
    quantity: number;
    email: string;
    redirect_url: string;
  }): Promise<any> {
    if (!Number.isInteger(input.quantity) || input.quantity <= 0)
      throw new Error("Quantity must be greater than zero.");
    return apiService.post(
      "/payments/paystack/provider-purchase/initialize",
      input,
    );
  },

  async verifyProviderPurchase(reference: string): Promise<any> {
    return apiService.get("/payments/paystack/provider-purchase/verify", {
      params: { reference },
    });
  },

  async getProviderInventory(): Promise<ProviderInventory[]> {
    return apiService.get<ProviderInventory[]>("/provider/inventory");
  },

  async getProviderReferralEarnings(): Promise<PlatformReferralEarning[]> {
    return apiService.get<PlatformReferralEarning[]>("/provider/referral-earnings");
  },

  async listProviderInventory(input: {
    inventory_id: number;
    quantity: number;
    price: number;
  }): Promise<any> {
    if (!Number.isInteger(input.quantity) || input.quantity <= 0)
      throw new Error("Quantity must be greater than zero.");
    return apiService.post("/provider/inventory/list", input);
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
    if (!authId) throw new Error("Not authenticated");

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
      ...(input.featured_collection
        ? { featured_collection: input.featured_collection }
        : {}),
    };

    try {
      const { data, error } = await supabase
        .from("products")
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return normalizeProductCategoryMetadata(data as Product);
    } catch (error) {
      if (!isColumnMissingError(error)) throw error;
      const {
        main_category,
        subcategory,
        featured_collection,
        ...fallbackPayload
      } = payload;
      const { data, error: fallbackError } = await supabase
        .from("products")
        .insert(fallbackPayload)
        .select()
        .single();
      if (fallbackError) throw fallbackError;
      return normalizeProductCategoryMetadata(data as Product);
    }
  },

  async updateProduct(
    id: number,
    input: Partial<{
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
      moderation_status: "pending" | "approved" | "rejected";
      status: string;
    }>,
  ): Promise<void> {
    const payload = { ...input };
    try {
      const { error } = await supabase
        .from("products")
        .update(payload)
        .eq("id", id);
      if (error) throw error;
    } catch (error) {
      if (!isColumnMissingError(error)) throw error;
      const {
        main_category,
        subcategory,
        featured_collection,
        ...fallbackPayload
      } = payload;
      const { error: fallbackError } = await supabase
        .from("products")
        .update(fallbackPayload)
        .eq("id", id);
      if (fallbackError) throw fallbackError;
    }
  },

  async deleteProduct(id: number): Promise<void> {
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) throw error;
  },

  async createOrder(input: {
    customer_auth_id?: string;
    items: { product_id: number; quantity: number; listing_id?: number }[];
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
    shipping_address?: string;
    note?: string;
    currency?: string;
  }): Promise<any> {
    const sanitizedItems = (input.items || []).filter(
      (item) =>
        item &&
        Number.isFinite(item.product_id) &&
        Number.isFinite(item.quantity) &&
        item.quantity > 0,
    );
    const subtotal = Number(input.subtotal ?? 0);
    const deliveryFee = Number(input.delivery_fee ?? 0);
    const totalAmount = Number(input.total_amount ?? subtotal + deliveryFee);

    return await apiService.post("/shop/orders", {
      ...input,
      items: sanitizedItems,
      subtotal: Number.isFinite(subtotal) ? subtotal : 0,
      delivery_fee: Number.isFinite(deliveryFee) ? deliveryFee : 0,
      total_amount: Number.isFinite(totalAmount) ? totalAmount : 0,
      payment_method: (input.payment_method || "paystack").trim() || "paystack",
      delivery_address:
        (input.delivery_address || "").trim() ||
        "Delivery address not provided",
      currency: (input.currency || "NGN").trim().toUpperCase() || "NGN",
    });
  },

  async initializePaystackCheckout(input: {
    amount: number;
    email: string;
    order_id: number | string;
    callback_url: string;
    items?: { product_id: number; quantity: number; listing_id?: number }[];
  }): Promise<{
    status: boolean;
    authorization_url?: string;
    reference?: string;
    message?: string;
  }> {
    const amount = Number(input.amount || 0);
    const orderId = input.order_id != null ? Number(input.order_id) : NaN;
    if (
      !Number.isFinite(amount) ||
      amount <= 0 ||
      !Number.isFinite(orderId) ||
      orderId <= 0 ||
      !input.email ||
      !input.callback_url
    ) {
      throw new Error(
        "Shop Paystack checkout requires a valid amount, email, order_id, and callback_url.",
      );
    }

    return apiService.post("/payments/paystack/shop/initialize", {
      amount: amount,
      email: input.email,
      order_id: orderId,
      callback_url: input.callback_url,
      items: input.items || [],
    });
  },

  async verifyPaystackCheckout(input: {
    reference: string;
    order_id?: number;
  }): Promise<{ status: string; message?: string; order?: any }> {
    return apiService.get("/payments/paystack/shop/verify", {
      params: {
        reference: input.reference,
        ...(input.order_id ? { order_id: input.order_id } : {}),
      },
    });
  },

  async getMyOrders(): Promise<Order[]> {
    const authId = await apiService.getAuthId();
    if (!authId) return [];
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("customer_auth_id", authId)
      .order("created_at", { ascending: false });
    if (error) throw error;

    const orders = (data || []) as Order[];
    return await Promise.all(
      orders.map(async (order) => {
        const items = await this.getOrderItems(order.id);
        let provider_name: string | null = null;
        if (order.provider_auth_id) {
          try {
            const profile = await apiService.get<any>(
              `/users/by-auth/${order.provider_auth_id}`,
            );
            provider_name = profile?.name || profile?.full_name || null;
          } catch (err) {
            console.warn("[shop] failed to load provider profile", err);
          }
        }
        return { ...order, items, provider_name };
      }),
    );
  },

  async getProviderOrders(providerAuthId: string): Promise<Order[]> {
    // A single order can contain items from multiple sellers, and
    // `orders.provider_auth_id` only ever reflects the first seller resolved
    // at checkout - so a direct client-side filter on that column alone
    // misses orders where this provider's item wasn't first. The backend
    // resolves correct attribution via order_items -> product_listings ->
    // shop_sellers / products.
    const orders = (await apiService.get<any[]>('/provider/shop-orders')) || [];
    return await Promise.all(
      orders.map(async (order) => {
        const items = await this.getOrderItems(order.id);
        let customer_name: string | null = null;
        if (order.customer_auth_id) {
          try {
            const profile = await apiService.get<any>(
              `/users/by-auth/${order.customer_auth_id}`,
            );
            customer_name = profile?.name || profile?.full_name || null;
          } catch (err) {
            console.warn("[shop] failed to load customer profile", err);
          }
        }
        return { ...order, items, customer_name };
      }),
    );
  },

  async getOrderItems(orderId: number): Promise<any[]> {
    const { data, error } = await supabase
      .from("order_items")
      .select("*, products(name, image_urls)")
      .eq("order_id", orderId);
    if (error) throw error;
    return data || [];
  },

  async updateOrderStatus(orderId: number, status: string): Promise<any> {
    return await apiService.patch(`/shop/orders/${orderId}`, { status });
  },

  async getProductReviews(productId: number): Promise<ProductReviewsResponse> {
    return await apiService.get<ProductReviewsResponse>(
      `/shop/products/${productId}/reviews`,
    );
  },

  async createProductReview(
    productId: number,
    input: {
      rating: number;
      review_text: string;
      comment?: string;
      product_id?: number;
      productId?: number | string;
      user_id?: string;
      order_id?: number | null;
      item_id?: number | null;
    },
  ): Promise<ProductReview> {
    const authId = await apiService.getAuthId();
    if (!authId) throw new Error("Not authenticated");

    const reviewText = String(input.review_text ?? input.comment ?? "").trim();
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

    if (
      !Number.isInteger(normalizedPayload.rating) ||
      normalizedPayload.rating < 1 ||
      normalizedPayload.rating > 5
    ) {
      throw new Error("Please select a rating from 1 to 5 stars.");
    }
    if (!normalizedPayload.review_text) {
      throw new Error("Please write a review before submitting.");
    }

    return await apiService.post<ProductReview>(
      `/shop/products/${productId}/reviews`,
      normalizedPayload,
    );
  },

  async updateProductReview(
    productId: number,
    reviewId: number,
    input: {
      rating: number;
      review_text: string;
      comment?: string;
      product_id?: number;
      productId?: number | string;
      user_id?: string;
      order_id?: number | null;
      item_id?: number | null;
    },
  ): Promise<ProductReview> {
    const authId = await apiService.getAuthId();
    if (!authId) throw new Error("Not authenticated");

    const reviewText = String(input.review_text ?? input.comment ?? "").trim();
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

    if (
      !Number.isInteger(normalizedPayload.rating) ||
      normalizedPayload.rating < 1 ||
      normalizedPayload.rating > 5
    ) {
      throw new Error("Please select a rating from 1 to 5 stars.");
    }
    if (!normalizedPayload.review_text) {
      throw new Error("Please write a review before submitting.");
    }

    return await apiService.patch<ProductReview>(
      `/shop/products/${productId}/reviews/${reviewId}`,
      normalizedPayload,
    );
  },

  async deleteProductReview(
    productId: number,
    reviewId: number,
  ): Promise<void> {
    const authId = await apiService.getAuthId();
    if (!authId) throw new Error("Not authenticated");
    await apiService.delete(`/shop/products/${productId}/reviews/${reviewId}`);
  },
};
