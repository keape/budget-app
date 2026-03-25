export type AllocationMode = 'amount' | 'quantity';

function parse(val: string): number | null {
  if (!val || !val.trim()) return null;
  const n = parseFloat(val);
  return isNaN(n) ? null : n;
}

/**
 * Called when Amount changes in Quantity mode.
 * Derives: quantity = amount / price
 * Price is a denominator — returns null if price is 0 or missing.
 */
export function deriveOnAmountChange(
  amount: string,
  price: string,
): string | null {
  const a = parse(amount);
  const p = parse(price);
  if (a === null || p === null || p === 0) return null;
  return (a / p).toFixed(6);
}

/**
 * Called when Quantity changes in Amount mode.
 * Derives: price = amount / quantity
 * Quantity is a denominator — returns null if quantity is 0 or missing.
 */
export function deriveOnQuantityChange(
  amount: string,
  quantity: string,
): string | null {
  const a = parse(amount);
  const q = parse(quantity);
  if (a === null || q === null || q === 0) return null;
  return (a / q).toFixed(2);
}

/**
 * Called when Price changes (both modes).
 * Amount mode  → quantity = amount / price  (price is denominator; 0 blocks)
 * Quantity mode → amount = quantity × price  (price is multiplicand; 0 is valid)
 * Returns { field, value } or null if not calculable.
 */
export function deriveOnPriceChange(
  amount: string,
  quantity: string,
  price: string,
  mode: AllocationMode,
): { field: 'amount' | 'quantity'; value: string } | null {
  const p = parse(price);
  if (p === null) return null; // empty or NaN always blocks

  if (mode === 'amount') {
    if (p === 0) return null; // division by zero
    const a = parse(amount);
    if (a === null) return null;
    return { field: 'quantity', value: (a / p).toFixed(6) };
  } else {
    // Quantity mode: multiplication — p === 0 is allowed (produces 0.00)
    const q = parse(quantity);
    if (q === null) return null;
    return { field: 'amount', value: (q * p).toFixed(2) };
  }
}
