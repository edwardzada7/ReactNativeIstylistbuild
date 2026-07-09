import {
  deriveCategories,
  iconForCategory,
  normalizeBooking,
  normalizeProvider,
  normalizeReview,
  normalizeService,
} from '../normalize';

describe('normalizeService', () => {
  it('reads the production provider-service shape (sub_service_* fields)', () => {
    const svc = normalizeService({
      sub_service_id: 'haircut',
      sub_service_name: 'Haircut',
      stylist_id: 'p1',
      default_price: '2000',
      default_duration: '30',
      category_name: 'Barbers',
    });
    expect(svc.id).toBe('haircut');
    expect(svc.provider_id).toBe('p1');
    expect(svc.name).toBe('Haircut');
    expect(svc.price).toBe(2000);
    expect(svc.duration).toBe(30);
    expect(svc.category).toBe('Barbers');
    expect(svc.is_active).toBe(true);
  });

  it('applies sensible fallbacks for a nearly-empty record', () => {
    const svc = normalizeService({});
    expect(svc.id).toBe('');
    expect(svc.name).toBe('Service');
    expect(svc.description).toBe('');
    expect(svc.price).toBe(0);
    expect(svc.duration).toBe(30);
    expect(svc.is_active).toBe(true);
  });

  it('coerces numeric string prices/durations to numbers', () => {
    const svc = normalizeService({ price: '1500', duration_minutes: '45' });
    expect(svc.price).toBe(1500);
    expect(svc.duration).toBe(45);
  });
});

describe('normalizeProvider', () => {
  it('maps alternate field names and normalizes nested services', () => {
    const provider = normalizeProvider({
      provider_id: 'p1',
      auth_id: 'auth-1',
      name: 'Glam Studio',
      average_rating: '4.5',
      reviews_count: '12',
      city: 'Lagos',
      country: 'Nigeria',
      portfolio_images: ['a.jpg', 'b.jpg'],
      kyc_verified: true,
      services: [{ sub_service_id: 's1', sub_service_name: 'Cut' }],
    });
    expect(provider.id).toBe('p1');
    expect(provider.user_id).toBe('auth-1');
    expect(provider.business_name).toBe('Glam Studio');
    expect(provider.rating).toBe(4.5);
    expect(provider.review_count).toBe(12);
    expect(provider.location).toBe('Lagos, Nigeria');
    expect(provider.images).toEqual(['a.jpg', 'b.jpg']);
    expect(provider.is_verified).toBe(true);
    expect(provider.services).toHaveLength(1);
    expect(provider.services[0].name).toBe('Cut');
  });

  it('builds a location from city/country when no explicit location exists', () => {
    expect(normalizeProvider({ city: 'Abuja' }).location).toBe('Abuja');
    expect(normalizeProvider({}).location).toBe('Location not set');
  });

  it('defaults business_name, availability and guards non-array images/services', () => {
    const provider = normalizeProvider({ images: 'not-an-array', services: null });
    expect(provider.business_name).toBe('Stylist');
    expect(provider.is_available).toBe(true);
    expect(provider.images).toEqual([]);
    expect(provider.services).toEqual([]);
  });

  it('treats is_available === false as unavailable', () => {
    expect(normalizeProvider({ is_available: false }).is_available).toBe(false);
  });
});

describe('normalizeReview', () => {
  it('maps alternate reviewer/comment fields with fallbacks', () => {
    const review = normalizeReview({
      review_id: 'r1',
      user_id: 'c1',
      reviewer_name: 'Ada',
      stars: '5',
      feedback: 'Great!',
    });
    expect(review.id).toBe('r1');
    expect(review.customer_id).toBe('c1');
    expect(review.customer_name).toBe('Ada');
    expect(review.rating).toBe(5);
    expect(review.comment).toBe('Great!');
    expect(review.images).toEqual([]);
  });

  it('defaults customer_name and rating when absent', () => {
    const review = normalizeReview({});
    expect(review.customer_name).toBe('Customer');
    expect(review.rating).toBe(0);
  });
});

describe('normalizeBooking', () => {
  it('prefers the production separate booking_date + booking_time fields', () => {
    const booking = normalizeBooking({
      id: 'b1',
      booking_date: '2024-03-15',
      booking_time: '10:00',
      status: 'confirmed',
      total_amount: '5000',
      services: [{ service_id: 's1', sub_service_name: 'Haircut', price: '2000' }],
    });
    expect(booking.date).toBe('2024-03-15');
    expect(booking.time).toBe('10:00');
    expect(booking.scheduled_at).toBe('2024-03-15T10:00');
    expect(booking.total_amount).toBe(5000);
    expect(booking.service_name).toBe('Haircut');
    expect(booking.services).toHaveLength(1);
    expect(booking.services?.[0]).toMatchObject({ service_id: 's1', service_name: 'Haircut', price: 2000 });
  });

  it('derives date/time from a combined scheduled_at when the split fields are missing', () => {
    const booking = normalizeBooking({ id: 'b2', scheduled_at: '2024-03-15T10:30:00Z' });
    expect(booking.date).toBe('2024-03-15');
    expect(booking.time).toBe('10:30 AM');
  });

  it('defaults status to pending and amount to zero', () => {
    const booking = normalizeBooking({});
    expect(booking.status).toBe('pending');
    expect(booking.total_amount).toBe(0);
    expect(booking.service_name).toBe('Service');
    expect(booking.provider_name).toBe('Provider');
  });
});

describe('iconForCategory', () => {
  it.each([
    ['Hair Braiding', 'cut'],
    ['Makeup Artist', 'color-palette'],
    ['Nail Technician', 'hand-left'],
    ['Spa Day', 'water'],
  ])('maps "%s" to icon "%s"', (name, icon) => {
    expect(iconForCategory(name)).toBe(icon);
  });

  it('is case-insensitive', () => {
    expect(iconForCategory('MASSAGE')).toBe('fitness');
  });

  it('falls back to "sparkles" for unknown or empty categories', () => {
    expect(iconForCategory('Photography')).toBe('sparkles');
    expect(iconForCategory('')).toBe('sparkles');
  });
});

describe('deriveCategories', () => {
  it('groups services by category and counts providers per category', () => {
    const categories = deriveCategories([
      { category: 'Hair' },
      { category: 'Hair' },
      { category_name: 'Makeup' },
      { service_category: 'Nails' },
      {},
    ]);
    const byName = Object.fromEntries(categories.map((c) => [c.name, c]));
    expect(byName.Hair.provider_count).toBe(2);
    expect(byName.Makeup.provider_count).toBe(1);
    expect(byName.Nails.icon).toBe('hand-left');
    expect(categories).toHaveLength(3);
  });

  it('returns an empty list for empty or nullish input', () => {
    expect(deriveCategories([])).toEqual([]);
    expect(deriveCategories(null as never)).toEqual([]);
  });
});
