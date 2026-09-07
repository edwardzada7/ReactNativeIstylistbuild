import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface CartLine {
  productId: number;
  sellerId?: number;
  sellerListingId?: number;
  sellerName?: string | null;
  name: string;
  price: number;
  image: string | null;
  quantity: number;
  stylistAuthId: string;
}

export const getCartLineKey = (line: Pick<CartLine, 'productId' | 'sellerId' | 'sellerListingId'>) =>
  `${line.productId}:${line.sellerListingId ?? line.sellerId ?? 'legacy'}`;

interface CartState {
  lines: CartLine[];
  userRole: string | null;
  storageKey: string | null;
  setSession: (userId: string | null, userRole: string | null) => Promise<void>;
  addItem: (line: Omit<CartLine, 'quantity'>, qty?: number) => void;
  removeItem: (lineKey: string | number) => void;
  setQuantity: (lineKey: string | number, quantity: number) => void;
  clearCart: () => void;
  clear: () => void;
  total: () => number;
}

const getStorageKey = (userId: string | null, userRole: string | null) =>
  `istylist_cart_${userId}_${userRole}`;

export const useCartStore = create<CartState>((set, get) => ({
  lines: [],
  userRole: null,
  storageKey: null,
  setSession: async (userId, userRole) => {
    const storageKey = getStorageKey(userId, userRole);
    set({ lines: [], userRole, storageKey });

    try {
      const storedLines = await AsyncStorage.getItem(storageKey);
      if (get().storageKey !== storageKey) return;
      set({ lines: storedLines ? (JSON.parse(storedLines) as CartLine[]) : [] });
    } catch (error) {
      console.warn('[cart] failed to load session cart', error);
    }
  },
  addItem: (line, qty = 1) =>
    set((state) => {
      if (state.userRole === 'provider') return state;
      const existing = state.lines.find((l) => getCartLineKey(l) === getCartLineKey(line));
      const lines = existing
        ? state.lines.map((l) =>
            getCartLineKey(l) === getCartLineKey(line) ? { ...l, quantity: l.quantity + qty } : l
          )
        : [...state.lines, { ...line, quantity: qty }];
      if (state.storageKey) void AsyncStorage.setItem(state.storageKey, JSON.stringify(lines));
      return { lines };
    }),
  removeItem: (lineKey) => set((state) => {
    const lines = state.lines.filter((l) => typeof lineKey === 'number' ? l.productId !== lineKey : getCartLineKey(l) !== lineKey);
    if (state.storageKey) void AsyncStorage.setItem(state.storageKey, JSON.stringify(lines));
    return { lines };
  }),
  setQuantity: (lineKey, quantity) =>
    set((state) => {
      const lines = quantity <= 0
        ? state.lines.filter((l) => typeof lineKey === 'number' ? l.productId !== lineKey : getCartLineKey(l) !== lineKey)
        : state.lines.map((l) => (typeof lineKey === 'number' ? l.productId === lineKey : getCartLineKey(l) === lineKey) ? { ...l, quantity } : l);
      if (state.storageKey) void AsyncStorage.setItem(state.storageKey, JSON.stringify(lines));
      return { lines };
    }),
  clearCart: () => {
    const storageKey = get().storageKey;
    set({ lines: [] });
    if (storageKey) void AsyncStorage.removeItem(storageKey);
  },
  clear: () => get().clearCart(),
  total: () => get().lines.reduce((sum, l) => sum + l.price * l.quantity, 0),
}));
