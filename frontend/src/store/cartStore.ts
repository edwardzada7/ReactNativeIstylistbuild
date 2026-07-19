import { create } from 'zustand';

export interface CartLine {
  productId: number;
  name: string;
  price: number;
  image: string | null;
  quantity: number;
  stylistAuthId: string;
}

interface CartState {
  lines: CartLine[];
  addItem: (line: Omit<CartLine, 'quantity'>, qty?: number) => void;
  removeItem: (productId: number) => void;
  setQuantity: (productId: number, quantity: number) => void;
  clear: () => void;
  total: () => number;
}

/**
 * Cart (Phase 3A - Shop). Intentionally client-side/in-memory only - there
 * is no `cart` table in the production schema (confirmed via audit), and
 * the whole app already follows a "cart is ephemeral, order is real"
 * pattern - checkout is what actually persists via POST /api/shop/orders.
 */
export const useCartStore = create<CartState>((set, get) => ({
  lines: [],
  addItem: (line, qty = 1) =>
    set((state) => {
      const existing = state.lines.find((l) => l.productId === line.productId);
      if (existing) {
        return {
          lines: state.lines.map((l) =>
            l.productId === line.productId ? { ...l, quantity: l.quantity + qty } : l
          ),
        };
      }
      return { lines: [...state.lines, { ...line, quantity: qty }] };
    }),
  removeItem: (productId) => set((state) => ({ lines: state.lines.filter((l) => l.productId !== productId) })),
  setQuantity: (productId, quantity) =>
    set((state) => ({
      lines: quantity <= 0
        ? state.lines.filter((l) => l.productId !== productId)
        : state.lines.map((l) => (l.productId === productId ? { ...l, quantity } : l)),
    })),
  clear: () => set({ lines: [] }),
  total: () => get().lines.reduce((sum, l) => sum + l.price * l.quantity, 0),
}));
