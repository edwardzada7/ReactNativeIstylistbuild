// Defensive normalizers for the production API (mongo-supabase-api.emergent.host).
// Different endpoints occasionally use slightly different field names for the
// same concept (e.g. business_name vs name vs stylist_name). These helpers
// pick the first available value so the UI never crashes on a missing/renamed
// field and always renders a sane fallback instead of blank/undefined text.
import { Provider, Service, Review, Category } from '../types';

const pick = (obj: any, keys: string[], fallback: any = undefined) => {
  if (!obj) return fallback;
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null && obj[key] !== '') return obj[key];
  }
  return fallback;
};

export function normalizeService(raw: any): Service {
  return {
    id: String(pick(raw, ['id', 'service_id'], '')),
    provider_id: String(pick(raw, ['provider_id', 'stylist_id'], '')),
    name: pick(raw, ['name', 'service_name', 'title'], 'Service'),
    description: pick(raw, ['description', 'details'], ''),
    price: Number(pick(raw, ['price', 'amount', 'cost'], 0)),
    duration: Number(pick(raw, ['duration_minutes', 'duration', 'minutes'], 30)),
    category: pick(raw, ['category', 'category_name', 'service_category']),
    is_active: pick(raw, ['is_active', 'active'], true),
    in_store: pick(raw, ['in_store'], undefined),
    home_service: pick(raw, ['home_service'], undefined),
  } as Service;
}

export function normalizeProvider(raw: any): Provider {
  const servicesRaw =
    pick(raw, ['services', 'provider_services', 'catalog_services'], []) || [];
  const images = pick(raw, ['portfolio_images', 'images', 'gallery', 'photos'], []) || [];
  const avatar = pick(raw, ['profile_image', 'avatar', 'photo', 'image', 'profile_photo']);
  const city = pick(raw, ['city']);
  const country = pick(raw, ['country']);
  const location = pick(raw, ['location', 'address']) || [city, country].filter(Boolean).join(', ');

  return {
    id: String(pick(raw, ['id', 'provider_id'], '')),
    user_id: String(pick(raw, ['auth_id', 'user_id'], '')),
    business_name: pick(
      raw,
      ['business_name', 'name', 'full_name', 'stylist_name'],
      'Stylist'
    ),
    bio: pick(raw, ['bio', 'about', 'description'], ''),
    category_id: String(pick(raw, ['category_id', 'category'], '')),
    category: pick(raw, ['category', 'category_name', 'specialty']),
    rating: Number(pick(raw, ['rating', 'average_rating', 'avg_rating'], 0)),
    review_count: Number(pick(raw, ['review_count', 'reviews_count', 'total_reviews'], 0)),
    price_range: pick(raw, ['price_range', 'price_level'], '$$'),
    location: location || 'Location not set',
    latitude: pick(raw, ['latitude', 'lat']),
    longitude: pick(raw, ['longitude', 'lng']),
    images: Array.isArray(images) ? images : [],
    services: Array.isArray(servicesRaw) ? servicesRaw.map(normalizeService) : [],
    is_verified: !!pick(raw, ['is_verified', 'kyc_verified', 'verified'], false),
    is_available: pick(raw, ['is_available', 'available'], true) !== false,
    response_time: pick(raw, ['response_time']),
    completion_rate: pick(raw, ['completion_rate']),
    created_at: pick(raw, ['created_at'], ''),
    avatar,
  } as Provider;
}

export function normalizeReview(raw: any): Review {
  return {
    id: String(pick(raw, ['id', 'review_id'], '')),
    booking_id: String(pick(raw, ['booking_id'], '')),
    provider_id: String(pick(raw, ['provider_id'], '')),
    customer_id: String(pick(raw, ['customer_id', 'user_id'], '')),
    customer_name: pick(raw, ['customer_name', 'reviewer_name', 'name'], 'Customer'),
    rating: Number(pick(raw, ['rating', 'stars'], 0)),
    comment: pick(raw, ['comment', 'review', 'text', 'feedback'], ''),
    images: pick(raw, ['images'], []),
    created_at: pick(raw, ['created_at'], ''),
  } as Review;
}

const CATEGORY_ICONS: Record<string, string> = {
  hair: 'cut',
  makeup: 'color-palette',
  nail: 'hand-left',
  spa: 'water',
  massage: 'fitness',
  skin: 'sparkles',
  brow: 'eye',
  lash: 'eye-outline',
  barber: 'cut-outline',
  wax: 'flame',
};

export function iconForCategory(name: string): string {
  const lower = (name || '').toLowerCase();
  for (const key of Object.keys(CATEGORY_ICONS)) {
    if (lower.includes(key)) return CATEGORY_ICONS[key];
  }
  return 'sparkles';
}

/**
 * The production API has no dedicated /categories endpoint, so categories
 * are derived client-side from the services catalog (grouped by whichever
 * category-like field is present on each service).
 */
export function deriveCategories(services: any[]): Category[] {
  const map = new Map<string, number>();
  (services || []).forEach((s) => {
    const name = pick(s, ['category', 'category_name', 'service_category']);
    if (!name) return;
    map.set(name, (map.get(name) || 0) + 1);
  });
  return Array.from(map.entries()).map(([name, count]) => ({
    id: name,
    name,
    icon: iconForCategory(name),
    provider_count: count,
  }));
}
