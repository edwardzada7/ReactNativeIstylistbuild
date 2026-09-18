export type ShopMainCategorySlug =
  | 'beauty'
  | 'fashion'
  | 'wellness'
  | 'bridal'
  | 'events'
  | 'professional-supplies'
  | 'gifts'
  | 'lifestyle-essentials';

export interface ShopSubcategory {
  id: string;
  name: string;
}

export interface ShopCategory {
  id: ShopMainCategorySlug;
  name: string;
  icon: string;
  slug: ShopMainCategorySlug;
  subcategories: ShopSubcategory[];
}

export const SHOP_CATEGORIES: ShopCategory[] = [
  {
    id: 'beauty',
    slug: 'beauty',
    name: '💄 Beauty',
    icon: '💄',
    subcategories: [
      { id: 'hair-care', name: 'Hair Care' },
      { id: 'hair-extensions-wigs', name: 'Hair Extensions & Wigs' },
      { id: 'makeup', name: 'Makeup' },
      { id: 'skincare', name: 'Skincare' },
      { id: 'fragrances', name: 'Fragrances' },
      { id: 'nails', name: 'Nails' },
      { id: 'eyelashes-brows', name: 'Eyelashes & Brows' },
      { id: 'beauty-tools', name: 'Beauty Tools' },
      { id: 'salon-equipment', name: 'Salon Equipment' },
      { id: 'barber-equipment', name: 'Barber Equipment' },
    ],
  },
  {
    id: 'fashion',
    slug: 'fashion',
    name: '👗 Fashion',
    icon: '👗',
    subcategories: [
      { id: 'womens-fashion', name: "Women's Fashion" },
      { id: 'mens-fashion', name: "Men's Fashion" },
      { id: 'shoes', name: 'Shoes' },
      { id: 'bags', name: 'Bags' },
      { id: 'jewellery', name: 'Jewellery' },
      { id: 'watches', name: 'Watches' },
      { id: 'sunglasses', name: 'Sunglasses' },
      { id: 'fashion-accessories', name: 'Fashion Accessories' },
    ],
  },
  {
    id: 'wellness',
    slug: 'wellness',
    name: '🧖 Wellness',
    icon: '🧖',
    subcategories: [
      { id: 'spa-products', name: 'Spa Products' },
      { id: 'massage-oils', name: 'Massage Oils' },
      { id: 'wellness-self-care', name: 'Wellness & Self-care' },
      { id: 'personal-care', name: 'Personal Care' },
    ],
  },
  {
    id: 'bridal',
    slug: 'bridal',
    name: '💍 Bridal',
    icon: '💍',
    subcategories: [
      { id: 'wedding-dresses', name: 'Wedding Dresses' },
      { id: 'bridal-accessories', name: 'Bridal Accessories' },
      { id: 'veils', name: 'Veils' },
      { id: 'bridal-makeup-kits', name: 'Bridal Makeup Kits' },
      { id: 'groom-accessories', name: 'Groom Accessories' },
    ],
  },
  {
    id: 'events',
    slug: 'events',
    name: '🎉 Events',
    icon: '🎉',
    subcategories: [
      { id: 'party-decorations', name: 'Party Decorations' },
      { id: 'wedding-decorations', name: 'Wedding Decorations' },
      { id: 'event-rentals', name: 'Event Rentals' },
      { id: 'photography-props', name: 'Photography Props' },
      { id: 'dj-equipment', name: 'DJ Equipment' },
      { id: 'event-planner-supplies', name: 'Event Planner Supplies' },
    ],
  },
  {
    id: 'professional-supplies',
    slug: 'professional-supplies',
    name: '📸 Professional Supplies',
    icon: '📸',
    subcategories: [
      { id: 'photography-equipment', name: 'Photography Equipment' },
      { id: 'makeup-artist-kits', name: 'Makeup Artist Kits' },
      { id: 'tattoo-supplies', name: 'Tattoo Supplies' },
      { id: 'cosmetology-supplies', name: 'Cosmetology Supplies' },
      { id: 'hair-stylist-tools', name: 'Hair Stylist Tools' },
      { id: 'barber-supplies', name: 'Barber Supplies' },
    ],
  },
  {
    id: 'gifts',
    slug: 'gifts',
    name: '🎁 Gifts',
    icon: '🎁',
    subcategories: [
      { id: 'gift-boxes', name: 'Gift Boxes' },
      { id: 'flowers', name: 'Flowers' },
      { id: 'customized-gifts', name: 'Customized Gifts' },
      { id: 'luxury-hampers', name: 'Luxury Hampers' },
    ],
  },
  {
    id: 'lifestyle-essentials',
    slug: 'lifestyle-essentials',
    name: '🛍 Lifestyle Essentials',
    icon: '🛍',
    subcategories: [
      { id: 'candles', name: 'Candles' },
      { id: 'diffusers', name: 'Diffusers' },
      { id: 'room-fragrances', name: 'Room Fragrances' },
      { id: 'lifestyle-accessories', name: 'Lifestyle Accessories' },
      { id: 'travel-accessories', name: 'Travel Accessories' },
      { id: 'premium-water-bottles', name: 'Premium Water Bottles' },
      { id: 'vanity-organizers', name: 'Vanity Organizers' },
    ],
  },
];

const CATEGORY_LOOKUP = new Map<string, ShopCategory>();
const SUBCATEGORY_LOOKUP = new Map<ShopMainCategorySlug, Map<string, ShopSubcategory>>();

for (const category of SHOP_CATEGORIES) {
  CATEGORY_LOOKUP.set(normalizeLookupValue(category.name), category);
  CATEGORY_LOOKUP.set(category.slug, category);
  const subcategoryLookup = new Map<string, ShopSubcategory>();
  for (const subcategory of category.subcategories) {
    subcategoryLookup.set(normalizeLookupValue(subcategory.name), subcategory);
    subcategoryLookup.set(subcategory.id, subcategory);
  }
  SUBCATEGORY_LOOKUP.set(category.slug, subcategoryLookup);
}

function normalizeLookupValue(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export function getShopCategoryBySlug(value?: string | null): ShopCategory | undefined {
  if (!value) return undefined;
  return CATEGORY_LOOKUP.get(normalizeLookupValue(value)) || SHOP_CATEGORIES.find((category) => category.slug === value);
}

export function normalizeShopCategoryMetadata(input?: { category?: string | null; subcategory?: string | null; main_category?: string | null }) {
  const rawMainCategory = input?.main_category ?? input?.category;
  const mainCategory = normalizeMainCategory(rawMainCategory);
  const mainCategorySlug = mainCategory ? getShopCategoryBySlug(mainCategory)?.slug : undefined;
  const normalizedSubcategory = normalizeSubcategory(mainCategorySlug, input?.subcategory);

  return {
    category: mainCategory,
    subcategory: normalizedSubcategory,
    main_category: mainCategory,
    main_category_slug: mainCategorySlug ?? null,
  };
}

export function normalizeMainCategory(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const category = getShopCategoryBySlug(trimmed) || getShopCategoryBySlug(normalizeLookupValue(trimmed));
  return category?.name ?? trimmed;
}

export function normalizeSubcategory(mainCategorySlug?: string | null, value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const slug = (mainCategorySlug ?? getShopCategoryBySlug(trimmed)?.slug) as ShopMainCategorySlug | undefined;
  if (!slug) return trimmed;
  const lookup = SUBCATEGORY_LOOKUP.get(slug);
  if (!lookup) return trimmed;
  return lookup.get(normalizeLookupValue(trimmed))?.name ?? trimmed;
}

export function getShopCategoryDisplayName(value?: string | null): string {
  const category = normalizeMainCategory(value);
  return category || 'Uncategorized';
}

export function getShopSubcategoryDisplayName(mainCategoryValue?: string | null, value?: string | null): string {
  const normalizedMainCategory = getShopCategoryBySlug(normalizeMainCategory(mainCategoryValue) ?? undefined)?.slug;
  const subcategory = normalizeSubcategory(normalizedMainCategory, value);
  return subcategory || 'Uncategorized';
}
