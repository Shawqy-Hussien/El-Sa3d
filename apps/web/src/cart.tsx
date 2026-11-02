import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Product, ProductVariant } from './api.js';

export interface CartItem {
  product: Product;
  variant: ProductVariant;
  quantity: number;
}

interface CartContextValue {
  items: CartItem[];
  count: number;
  subtotal: number;
  add: (product: Product, variant: ProductVariant, quantity: number) => void;
  setQuantity: (variantId: string, quantity: number) => void;
  remove: (variantId: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('namaa-cart') ?? '[]') as CartItem[];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('namaa-cart', JSON.stringify(items));
  }, [items]);

  const value = useMemo<CartContextValue>(() => ({
    items,
    count: items.reduce((sum, item) => sum + item.quantity, 0),
    subtotal: items.reduce((sum, item) => sum + Number(item.variant.price) * item.quantity, 0),
    add(product, variant, quantity) {
      setItems((current) => {
        const existing = current.find((item) => item.variant.id === variant.id);
        if (existing) {
          return current.map((item) =>
            item.variant.id === variant.id
              ? { ...item, quantity: Math.min(99, item.quantity + quantity) }
              : item,
          );
        }
        return [...current, { product, variant, quantity: Math.max(1, Math.min(99, quantity)) }];
      });
    },
    setQuantity(variantId, quantity) {
      if (quantity <= 0) {
        setItems((current) => current.filter((item) => item.variant.id !== variantId));
        return;
      }
      setItems((current) => current.map((item) =>
        item.variant.id === variantId ? { ...item, quantity: Math.min(99, quantity) } : item,
      ));
    },
    remove(variantId) {
      setItems((current) => current.filter((item) => item.variant.id !== variantId));
    },
    clear() {
      setItems([]);
    },
  }), [items]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used inside CartProvider.');
  return context;
}
