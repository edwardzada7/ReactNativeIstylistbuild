import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import { LargeSecureStore } from './secureStore';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[supabase] EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY are missing. ' +
      'Auth calls will fail until they are set in frontend/.env'
  );
}

// Mobile needs an encrypted persistent storage adapter and must not try to
// parse sessions out of redirect URLs. Web can safely fall back to the
// browser's own localStorage-backed default and URL detection.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: Platform.OS === 'web' ? undefined : new LargeSecureStore(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
});







========================================
Mobile Frontend .env


EXPO_TUNNEL_SUBDOMAIN=stylist-mobile-1
EXPO_PACKAGER_HOSTNAME=https://stylist-mobile-1.preview.emergentagent.com
EXPO_PUBLIC_BACKEND_URL=https://stylist-mobile-1.preview.emergentagent.com
EXPO_USE_FAST_RESOLVER="1"
METRO_CACHE_ROOT=/app/frontend/.metro-cache
EXPO_PACKAGER_PROXY_URL=https://stylist-mobile-1.preview.emergentagent.com

# API Configuration - Production backend (Supabase PostgreSQL business logic API)
EXPO_PUBLIC_API_BASE_URL=https://mongo-supabase-api.emergent.host/api

# Supabase Auth (identity provider)
EXPO_PUBLIC_SUPABASE_URL=https://gvmomyoeokauuixsydiu.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2bW9teW9lb2thdXVpeHN5ZGl1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYyMDQxMTksImV4cCI6MjA4MTc4MDExOX0.RWD9j4dKIcgZ_An6pM4sLgyRPc1j7A6vx1QRm2nrLw0

# Flutterwave (payments)
EXPO_PUBLIC_FLW_PUBLIC_KEY=FLWPUBK-d41cdd72dafe974d3410ef0383881b22-X


======================

Mobile Backend .env


MONGO_URL=mongodb://localhost:27017
DB_NAME=stylist_app
CORS_ORIGINS=*
JWT_SECRET=istylist_super_secret_jwt_key_change_in_production_2025
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
REFRESH_TOKEN_EXPIRE_DAYS=30


====================================
Web Backend .env



# Supabase Configuration
SUPABASE_URL="https://gvmomyoeokauuixsydiu.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2bW9teW9lb2thdXVpeHN5ZGl1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjIwNDExOSwiZXhwIjoyMDgxNzgwMTE5fQ.NkCuBMt7m70qra_endsobGAYTbiXamKFtt4i-rYXZqk"

# Database Configuration
DATABASE_URL="postgresql://postgres:26ikwFo1ntGGkESp@db.gvmomyoeokauuixsydiu.supabase.co:5432/postgres"

# JWT Secret
JWT_SECRET="ba3ad9ab96f464248683c1e4ad07a19fe55c137a1bc014098b7fda2a0cbc68a405580348d0051b60b7fd419f4a3e3f13a36d4ad5264bafe1ed09bcc011e8f27f"

# Admin Configuration
ADMIN_DASH_KEY=istylist_admin_secret_key_2026

# CORS Configuration
CORS_ORIGINS="*"

# Paystack Configuration (Dormant - kept for rollback)
PAYSTACK_SECRET_KEY=sk_test_88958f8099bb5f21d33c1b74e9950bbb6622e38e
PAYSTACK_CALLBACK_URL=""

# Flutterwave Configuration (Current payment provider)
FLW_PUBLIC_KEY="FLWPUBK-d41cdd72dafe974d3410ef0383881b22-X"
FLW_SECRET_KEY="FLWSECK-0c64199e6ea6c68cf109db0ad1bd268b-19ed16d40d8vt-X"
FLW_WEBHOOK_SECRET="elroielyonedwardfavour1onyedikamaduzada"


======================================

Web Frontend .env
--



# Backend API URL
REACT_APP_BACKEND_URL=https://mongo-supabase-api.preview.emergentagent.com

# Flutterwave Public Key
REACT_APP_FLW_PUBLIC_KEY=FLWPUBK-d41cdd72dafe974d3410ef0383881b22-X
