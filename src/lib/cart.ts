import { useCallback, useEffect, useState } from "react";

export type CartLine = {
  productId: string;
  name: string;
  priceKobo: number;
  quantity: number;
};

export type Cart = {
  merchantId: string | null;
  merchantName: string | null;
  lines: CartLine[];
};

const KEY = "zentra.cart.v1";
const EVENT = "zentra:cart";
const EMPTY: Cart = { merchantId: null, merchantName: null, lines: [] };

function read(): Cart {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Cart;
    if (!parsed || !Array.isArray(parsed.lines)) return EMPTY;
    return parsed;
  } catch {
    return EMPTY;
  }
}

function write(cart: Cart) {
  window.localStorage.setItem(KEY, JSON.stringify(cart));
  window.dispatchEvent(new Event(EVENT));
}

export function cartSubtotal(cart: Cart): number {
  return cart.lines.reduce((sum, l) => sum + l.priceKobo * l.quantity, 0);
}

export function cartCount(cart: Cart): number {
  return cart.lines.reduce((sum, l) => sum + l.quantity, 0);
}

export function useCart() {
  const [cart, setCart] = useState<Cart>(EMPTY);

  useEffect(() => {
    const sync = () => setCart(read());
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const addItem = useCallback(
    (
      merchant: { id: string; name: string },
      product: { id: string; name: string; priceKobo: number },
    ): { replacedStore: boolean } => {
      const current = read();
      const differentStore = current.merchantId !== null && current.merchantId !== merchant.id;
      const base: Cart = differentStore || current.merchantId === null
        ? { merchantId: merchant.id, merchantName: merchant.name, lines: [] }
        : current;

      const existing = base.lines.find((l) => l.productId === product.id);
      const lines = existing
        ? base.lines.map((l) =>
            l.productId === product.id ? { ...l, quantity: l.quantity + 1 } : l,
          )
        : [
            ...base.lines,
            { productId: product.id, name: product.name, priceKobo: product.priceKobo, quantity: 1 },
          ];

      write({ merchantId: merchant.id, merchantName: merchant.name, lines });
      return { replacedStore: differentStore };
    },
    [],
  );

  const setQuantity = useCallback((productId: string, quantity: number) => {
    const current = read();
    const lines = current.lines
      .map((l) => (l.productId === productId ? { ...l, quantity } : l))
      .filter((l) => l.quantity > 0);
    write(lines.length ? { ...current, lines } : EMPTY);
  }, []);

  const clear = useCallback(() => write(EMPTY), []);

  return { cart, addItem, setQuantity, clear, subtotal: cartSubtotal(cart), count: cartCount(cart) };
}
