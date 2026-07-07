// GROUND TRUTH (Phase 6.4 - verified against production web app source,
// frontend/src/utils/constants.js SERVICE_CATALOG + getAllSubServices).
// The web app's "Add Service" picker does NOT call any /catalog/* API at
// all - it uses this exact static catalog. Porting it 1:1 (same category/
// service/sub-service ids, names, default durations & prices) is what
// fixes the empty "Select from list" picker on mobile, which was relying
// on a live API call the web app never actually uses for this flow.
import { CatalogSubService } from '../types';

interface RawSubService {
  id: string;
  name: string;
  defaultDuration: number;
  defaultPrice: number;
}
interface RawService {
  id: string;
  name: string;
  icon: string;
  requiresVerification?: boolean;
  subServices: RawSubService[];
}
interface RawCategory {
  id: string;
  name: string;
  icon: string;
  notice?: string;
  services: Record<string, RawService>;
}

export const SERVICE_CATALOG: Record<string, RawCategory> = {
  'beauty-grooming': {
    id: 'beauty-grooming',
    name: 'Beauty & Grooming',
    icon: '✨',
    services: {
      barbers: {
        id: 'barbers',
        name: 'Barbers',
        icon: '✂️',
        subServices: [
          { id: 'haircut', name: 'Haircut', defaultDuration: 30, defaultPrice: 2000 },
          { id: 'beard-trim', name: 'Beard Trim', defaultDuration: 15, defaultPrice: 1000 },
          { id: 'hair-shave', name: 'Hair Shave', defaultDuration: 20, defaultPrice: 1500 },
          { id: 'line-up-shape-up', name: 'Line Up / Shape Up', defaultDuration: 15, defaultPrice: 1000 },
          { id: 'hair-coloring-highlights', name: 'Hair Coloring / Highlights', defaultDuration: 60, defaultPrice: 5000 },
          { id: 'kids-haircut', name: "Kids' Haircut", defaultDuration: 20, defaultPrice: 1500 },
        ],
      },
      'hair-braiders': {
        id: 'hair-braiders',
        name: 'Hair Braiders',
        icon: '🧵',
        subServices: [
          { id: 'box-braids', name: 'Box Braids', defaultDuration: 240, defaultPrice: 15000 },
          { id: 'cornrows', name: 'Cornrows', defaultDuration: 120, defaultPrice: 8000 },
          { id: 'twists', name: 'Twists', defaultDuration: 180, defaultPrice: 12000 },
          { id: 'senegalese-twists', name: 'Senegalese Twists', defaultDuration: 240, defaultPrice: 15000 },
          { id: 'feed-in-braids', name: 'Feed-in Braids', defaultDuration: 180, defaultPrice: 12000 },
          { id: 'knotless-braids', name: 'Knotless Braids', defaultDuration: 300, defaultPrice: 20000 },
        ],
      },
      dreadlocks: {
        id: 'dreadlocks',
        name: 'Dreadlocks',
        icon: '🔒',
        subServices: [
          { id: 'dreadlock-installation', name: 'Dreadlock Installation', defaultDuration: 300, defaultPrice: 25000 },
          { id: 'dreadlock-maintenance', name: 'Dreadlock Maintenance / Retwist', defaultDuration: 120, defaultPrice: 8000 },
          { id: 'dreadlock-removal', name: 'Dreadlock Removal', defaultDuration: 180, defaultPrice: 15000 },
        ],
      },
      hairdressers: {
        id: 'hairdressers',
        name: 'Hairdressers',
        icon: '💇',
        subServices: [
          { id: 'hair-styling', name: 'Hair Styling', defaultDuration: 60, defaultPrice: 5000 },
          { id: 'hair-coloring', name: 'Hair Coloring / Highlights', defaultDuration: 90, defaultPrice: 8000 },
          { id: 'blowouts', name: 'Blowouts', defaultDuration: 45, defaultPrice: 4000 },
          { id: 'hair-treatment', name: 'Hair Treatment / Deep Conditioning', defaultDuration: 60, defaultPrice: 6000 },
        ],
      },
      'wig-specialists': {
        id: 'wig-specialists',
        name: 'Wig Specialists',
        icon: '👩',
        subServices: [
          { id: 'wig-installation', name: 'Wig Installation', defaultDuration: 60, defaultPrice: 10000 },
          { id: 'wig-styling', name: 'Wig Styling / Cutting', defaultDuration: 45, defaultPrice: 5000 },
          { id: 'wig-maintenance', name: 'Wig Maintenance / Cleaning', defaultDuration: 60, defaultPrice: 4000 },
        ],
      },
      'makeup-artists': {
        id: 'makeup-artists',
        name: 'Makeup Artists',
        icon: '💄',
        subServices: [
          { id: 'bridal-makeup', name: 'Bridal Makeup', defaultDuration: 120, defaultPrice: 30000 },
          { id: 'party-event-makeup', name: 'Party / Event Makeup', defaultDuration: 60, defaultPrice: 15000 },
          { id: 'photoshoot-makeup', name: 'Photoshoot Makeup', defaultDuration: 90, defaultPrice: 20000 },
          { id: 'natural-everyday-makeup', name: 'Natural / Everyday Makeup', defaultDuration: 45, defaultPrice: 8000 },
        ],
      },
      'nail-technicians': {
        id: 'nail-technicians',
        name: 'Nail Technicians',
        icon: '💅',
        subServices: [
          { id: 'manicure', name: 'Manicure', defaultDuration: 45, defaultPrice: 3000 },
          { id: 'pedicure', name: 'Pedicure', defaultDuration: 60, defaultPrice: 4000 },
          { id: 'gel-nails', name: 'Gel Nails', defaultDuration: 75, defaultPrice: 8000 },
          { id: 'acrylic-nails', name: 'Acrylic Nails', defaultDuration: 90, defaultPrice: 12000 },
          { id: 'nail-art', name: 'Nail Art', defaultDuration: 30, defaultPrice: 2000 },
        ],
      },
      'eyelash-technicians': {
        id: 'eyelash-technicians',
        name: 'Eyelash Technicians',
        icon: '👁️',
        subServices: [
          { id: 'lash-extensions', name: 'Lash Extensions', defaultDuration: 90, defaultPrice: 15000 },
          { id: 'lash-lifts', name: 'Lash Lifts', defaultDuration: 60, defaultPrice: 8000 },
          { id: 'brow-lamination', name: 'Brow Lamination', defaultDuration: 45, defaultPrice: 6000 },
          { id: 'microblading', name: 'Microblading', defaultDuration: 120, defaultPrice: 50000 },
          { id: 'microshading', name: 'Microshading', defaultDuration: 120, defaultPrice: 45000 },
          { id: 'brow-tinting', name: 'Brow Tinting', defaultDuration: 30, defaultPrice: 3000 },
        ],
      },
      facials: {
        id: 'facials',
        name: 'Facials (Estheticians)',
        icon: '🧖',
        subServices: [
          { id: 'basic-facial', name: 'Basic Facial', defaultDuration: 45, defaultPrice: 5000 },
          { id: 'deep-cleansing-facial', name: 'Deep Cleansing Facial', defaultDuration: 60, defaultPrice: 8000 },
          { id: 'anti-aging-facial', name: 'Anti-Aging Facial', defaultDuration: 75, defaultPrice: 12000 },
          { id: 'acne-treatment', name: 'Acne Treatment', defaultDuration: 60, defaultPrice: 10000 },
        ],
      },
      cosmetologists: {
        id: 'cosmetologists',
        name: 'Cosmetologists',
        icon: '🌸',
        subServices: [
          { id: 'skin-treatment', name: 'Skin Treatment / Care', defaultDuration: 60, defaultPrice: 8000 },
          { id: 'body-treatments', name: 'Body Treatments', defaultDuration: 90, defaultPrice: 15000 },
          { id: 'non-surgical-beauty', name: 'Non-surgical Beauty Procedures', defaultDuration: 60, defaultPrice: 20000 },
        ],
      },
    },
  },
  'body-aesthetics': {
    id: 'body-aesthetics',
    name: 'Body & Aesthetics',
    icon: '💎',
    notice: 'Verified & Regulated Providers Only',
    services: {
      'non-surgical-body': {
        id: 'non-surgical-body',
        name: 'Non-Surgical Body Enhancement',
        icon: '💉',
        requiresVerification: true,
        subServices: [
          { id: 'lip-fillers', name: 'Lip Fillers', defaultDuration: 60, defaultPrice: 80000 },
          { id: 'botox', name: 'Botox / Wrinkle Treatments', defaultDuration: 45, defaultPrice: 100000 },
          { id: 'skin-tightening', name: 'Skin Tightening', defaultDuration: 60, defaultPrice: 50000 },
          { id: 'fat-reduction', name: 'Fat Reduction (Non-surgical)', defaultDuration: 90, defaultPrice: 150000 },
        ],
      },
      'tattoo-artists': {
        id: 'tattoo-artists',
        name: 'Tattoo Artists',
        icon: '🎨',
        subServices: [
          { id: 'small-tattoos', name: 'Small / Minimalist Tattoos', defaultDuration: 60, defaultPrice: 15000 },
          { id: 'large-tattoos', name: 'Large / Full Body Tattoos', defaultDuration: 300, defaultPrice: 100000 },
          { id: 'custom-designs', name: 'Custom Designs', defaultDuration: 180, defaultPrice: 50000 },
          { id: 'portrait-tattoos', name: 'Portrait Tattoos', defaultDuration: 240, defaultPrice: 80000 },
          { id: 'coverup-tattoos', name: 'Cover-up Tattoos', defaultDuration: 180, defaultPrice: 60000 },
          { id: 'black-grey-tattoos', name: 'Black & Grey Tattoos', defaultDuration: 120, defaultPrice: 40000 },
          { id: 'color-tattoos', name: 'Color Tattoos', defaultDuration: 150, defaultPrice: 50000 },
          { id: 'tattoo-touchups', name: 'Tattoo Touch ups', defaultDuration: 60, defaultPrice: 20000 },
          { id: 'tattoo-removal', name: 'Tattoo Removal', defaultDuration: 60, defaultPrice: 30000 },
        ],
      },
      'body-piercing': {
        id: 'body-piercing',
        name: 'Body Piercing',
        icon: '💎',
        subServices: [
          { id: 'ear-piercing', name: 'Ear Piercing', defaultDuration: 15, defaultPrice: 3000 },
          { id: 'nose-piercing', name: 'Nose Piercing', defaultDuration: 15, defaultPrice: 5000 },
          { id: 'body-piercing-general', name: 'Body Piercing', defaultDuration: 30, defaultPrice: 8000 },
        ],
      },
      'medical-surgical': {
        id: 'medical-surgical',
        name: 'Medical / Surgical (Verified Only)',
        icon: '🏥',
        requiresVerification: true,
        subServices: [
          { id: 'teeth-whitening', name: 'Teeth Whitening', defaultDuration: 60, defaultPrice: 50000 },
          { id: 'hair-transplant', name: 'Hair Transplant', defaultDuration: 480, defaultPrice: 500000 },
          { id: 'cosmetic-surgery', name: 'Cosmetic Surgery', defaultDuration: 240, defaultPrice: 1000000 },
        ],
      },
    },
  },
  'wellness-care': {
    id: 'wellness-care',
    name: 'Wellness & Care',
    icon: '🧘',
    services: {
      'spa-services': {
        id: 'spa-services',
        name: 'Spa Services',
        icon: '🧖‍♀️',
        subServices: [
          { id: 'full-body-massage', name: 'Full Body Massage', defaultDuration: 90, defaultPrice: 15000 },
          { id: 'head-neck-massage', name: 'Head & Neck Massage', defaultDuration: 30, defaultPrice: 5000 },
          { id: 'aromatherapy', name: 'Aromatherapy', defaultDuration: 60, defaultPrice: 12000 },
          { id: 'massage-therapy', name: 'Massage Therapy', defaultDuration: 60, defaultPrice: 10000 },
          { id: 'deep-tissue-massage', name: 'Deep Tissue Massage', defaultDuration: 75, defaultPrice: 18000 },
          { id: 'sports-massage', name: 'Sports Massage', defaultDuration: 60, defaultPrice: 15000 },
          { id: 'reflexology', name: 'Reflexology', defaultDuration: 45, defaultPrice: 8000 },
        ],
      },
      'body-therapy': {
        id: 'body-therapy',
        name: 'Body Therapy',
        icon: '🌿',
        subServices: [
          { id: 'body-scrubs', name: 'Body Scrubs / Exfoliation', defaultDuration: 60, defaultPrice: 10000 },
          { id: 'body-wraps', name: 'Body Wraps', defaultDuration: 75, defaultPrice: 15000 },
        ],
      },
      'wellness-treatments': {
        id: 'wellness-treatments',
        name: 'Wellness Treatments',
        icon: '🍃',
        subServices: [
          { id: 'yoga', name: 'Yoga', defaultDuration: 60, defaultPrice: 5000 },
          { id: 'meditation', name: 'Meditation', defaultDuration: 45, defaultPrice: 4000 },
          { id: 'fitness-coaching', name: 'Fitness Coaching', defaultDuration: 60, defaultPrice: 8000 },
        ],
      },
    },
  },
  'fashion-bridal': {
    id: 'fashion-bridal',
    name: 'Fashion & Bridal',
    icon: '👗',
    services: {
      'fashion-designers': {
        id: 'fashion-designers',
        name: 'Fashion Designers',
        icon: '🎨',
        subServices: [
          { id: 'custom-clothing', name: 'Custom Clothing Design', defaultDuration: 120, defaultPrice: 50000 },
          { id: 'outfit-styling', name: 'Outfit Styling', defaultDuration: 90, defaultPrice: 20000 },
          { id: 'fittings-alterations', name: 'Fittings & Alterations', defaultDuration: 60, defaultPrice: 10000 },
        ],
      },
      'bridal-designers': {
        id: 'bridal-designers',
        name: 'Bridal Designers',
        icon: '👰',
        subServices: [
          { id: 'wedding-dress', name: 'Wedding Dress Design', defaultDuration: 180, defaultPrice: 150000 },
          { id: 'bridal-accessories', name: 'Bridal Accessories', defaultDuration: 60, defaultPrice: 30000 },
          { id: 'bridal-fittings', name: 'Fittings & Alterations', defaultDuration: 90, defaultPrice: 20000 },
        ],
      },
      models: {
        id: 'models',
        name: 'Models',
        icon: '🚶',
        subServices: [
          { id: 'runway-modeling', name: 'Runway Modeling', defaultDuration: 120, defaultPrice: 50000 },
          { id: 'photoshoot-modeling', name: 'Photoshoot Modeling', defaultDuration: 180, defaultPrice: 40000 },
          { id: 'promotional-events', name: 'Promotional Events', defaultDuration: 240, defaultPrice: 30000 },
        ],
      },
    },
  },
  'events-entertainment': {
    id: 'events-entertainment',
    name: 'Events & Entertainment',
    icon: '🎉',
    services: {
      'event-planners': {
        id: 'event-planners',
        name: 'Event Planners',
        icon: '📋',
        subServices: [
          { id: 'weddings', name: 'Weddings', defaultDuration: 480, defaultPrice: 200000 },
          { id: 'birthday-parties', name: 'Birthday Parties', defaultDuration: 240, defaultPrice: 50000 },
          { id: 'corporate-events', name: 'Corporate Events', defaultDuration: 360, defaultPrice: 150000 },
        ],
      },
      mcs: {
        id: 'mcs',
        name: 'MCs',
        icon: '🎤',
        subServices: [
          { id: 'event-hosting', name: 'Event Hosting', defaultDuration: 240, defaultPrice: 100000 },
          { id: 'public-speaking', name: 'Public Speaking', defaultDuration: 60, defaultPrice: 50000 },
        ],
      },
      djs: {
        id: 'djs',
        name: 'DJs',
        icon: '🎧',
        subServices: [{ id: 'music-mixing', name: 'Music Mixing / DJing', defaultDuration: 300, defaultPrice: 80000 }],
      },
      'hype-men': {
        id: 'hype-men',
        name: 'Hype Men / Performers',
        icon: '📢',
        subServices: [
          { id: 'live-performances', name: 'Live Performances', defaultDuration: 120, defaultPrice: 50000 },
          { id: 'crowd-engagement', name: 'Crowd Engagement', defaultDuration: 180, defaultPrice: 40000 },
        ],
      },
      artists: {
        id: 'artists',
        name: 'Artists',
        icon: '🎭',
        subServices: [
          { id: 'singing-music', name: 'Singing / Music Performances', defaultDuration: 120, defaultPrice: 100000 },
          { id: 'acting-theater', name: 'Acting / Theater', defaultDuration: 180, defaultPrice: 80000 },
        ],
      },
      'food-vendors': {
        id: 'food-vendors',
        name: 'Food Vendors',
        icon: '🍽️',
        subServices: [
          { id: 'catering', name: 'Catering', defaultDuration: 300, defaultPrice: 100000 },
          { id: 'snacks-drinks', name: 'Snacks & Drinks', defaultDuration: 180, defaultPrice: 30000 },
        ],
      },
    },
  },
  'classes-learning': {
    id: 'classes-learning',
    name: 'Classes & Learning',
    icon: '📚',
    services: {
      'beauty-classes': {
        id: 'beauty-classes',
        name: 'Beauty Classes',
        icon: '🎓',
        subServices: [
          { id: 'makeup-training', name: 'Makeup Training', defaultDuration: 240, defaultPrice: 50000 },
          { id: 'hair-styling-training', name: 'Hair Styling Training', defaultDuration: 240, defaultPrice: 40000 },
          { id: 'nail-lash-training', name: 'Nail & Lash Training', defaultDuration: 180, defaultPrice: 35000 },
          { id: 'tattoo-body-art-training', name: 'Tattoo & Body Art Training', defaultDuration: 300, defaultPrice: 80000 },
        ],
      },
      'wellness-training': {
        id: 'wellness-training',
        name: 'Wellness Training',
        icon: '🧘',
        subServices: [
          { id: 'massage-therapy-training', name: 'Massage Therapy Training', defaultDuration: 240, defaultPrice: 60000 },
          { id: 'fitness-yoga-training', name: 'Fitness / Yoga Training', defaultDuration: 180, defaultPrice: 30000 },
        ],
      },
    },
  },
};

export function getAllSubServicesCatalog(): CatalogSubService[] {
  const out: CatalogSubService[] = [];
  Object.values(SERVICE_CATALOG).forEach((cat) => {
    Object.values(cat.services).forEach((svc) => {
      (svc.subServices || []).forEach((sub) => {
        out.push({
          id: sub.id,
          name: sub.name,
          default_duration: sub.defaultDuration,
          default_price: sub.defaultPrice,
          service_id: svc.id,
          service_name: svc.name,
          category_id: cat.id,
          category_name: cat.name,
          requires_verification: svc.requiresVerification || false,
        });
      });
    });
  });
  return out;
}
