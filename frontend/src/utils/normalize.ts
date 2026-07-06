// Defensive normalizers for the production API (mongo-supabase-api.emergent.host).
// Different endpoints occasionally use slightly different field names for the
// same concept (e.g. business_name vs name vs stylist_name). These helpers
// pick the first available value so the UI never crashes on a missing/renamed
// field and always renders a sane fallback instead of blank/undefined text.
import { Provider, Service, Review, Category, Booking } from '../types';

const pick = (obj: any, keys: string[], fallback: any = undefined) => {
  if (!obj) return fallback;
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null && obj[key] !== '') return obj[key];
  }
  return fallback;
};

export function normalizeService(raw: any): Service {
  return {
    id: String(pick(raw, ['id', 'sub_service_id', 'service_id'], '')),
    provider_id: String(pick(raw, ['provider_id', 'stylist_id'], '')),
    // Real production shape uses `sub_service_name` on provider-service rows
    // (e.g. { sub_service_id: "haircut", sub_service_name: "Haircut", ... })
    // and plain `name` on catalog rows (e.g. /catalog/sub-services). Both are
    // covered here so a real name is always shown instead of the "Service"
    // placeholder that silently rendered everywhere before this fix.
    name: pick(raw, ['name', 'sub_service_name', 'service_name', 'title'], 'Service'),
    description: pick(raw, ['description', 'details'], ''),
    price: Number(pick(raw, ['price', 'default_price', 'amount', 'cost'], 0)),
    duration: Number(
      pick(raw, ['duration_minutes', 'default_duration', 'duration', 'minutes'], 30)
    ),
    category: pick(raw, ['category', 'category_name', 'category_id', 'service_category']),
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
    price_range: pick(raw, ['price_range', 'price_level'], '\u20A6\u20A6'),
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

function deriveDateTime(scheduledAt: string): { date: string; time: string } {
  if (!scheduledAt) return { date: '', time: '' };
  const d = new Date(scheduledAt);
  if (isNaN(d.getTime())) return { date: scheduledAt, time: '' };
  const date = d.toISOString().slice(0, 10);
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return { date, time };
}

export function normalizeBooking(raw: any): Booking {
  const scheduledAt = pick(raw, ['scheduled_at', 'booking_date', 'date_time'], '');
  const { date, time } = deriveDateTime(scheduledAt);
  return {
    id: String(pick(raw, ['id', 'booking_id'], '')),
    customer_id: String(pick(raw, ['customer_id', 'user_id'], '')),
    customer_auth_id: pick(raw, ['customer_auth_id']),
    provider_id: String(pick(raw, ['provider_id', 'stylist_id'], '')),
    provider_auth_id: pick(raw, ['provider_auth_id']),
    service_id: String(pick(raw, ['service_id'], '')),
    service_name: pick(raw, ['service_name', 'service_title'], 'Service'),
    provider_name: pick(raw, ['provider_name', 'stylist_name', 'business_name'], 'Provider'),
    provider_avatar: pick(raw, ['provider_avatar', 'provider_image', 'avatar']),
    scheduled_at: scheduledAt,
    date: pick(raw, ['date'], date),
    time: pick(raw, ['time'], time),
    status: pick(raw, ['status'], 'pending'),
    total_amount: Number(pick(raw, ['total_amount', 'amount', 'price', 'total'], 0)),
    payment_status: pick(raw, ['payment_status']),
    location: pick(raw, ['location', 'address']),
    notes: pick(raw, ['notes'], ''),
    created_at: pick(raw, ['created_at'], ''),
    updated_at: pick(raw, ['updated_at']),
  } as Booking;
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
