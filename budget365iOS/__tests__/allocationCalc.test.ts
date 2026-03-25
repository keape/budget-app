import {
  deriveOnAmountChange,
  deriveOnQuantityChange,
  deriveOnPriceChange,
} from '../src/utils/allocationCalc';

describe('deriveOnAmountChange (Quantity mode: derive qty from amount/price)', () => {
  it('returns quantity when amount and price are valid', () => {
    expect(deriveOnAmountChange('500', '200.00')).toBe('2.500000');
  });
  it('returns null when price is zero (division by zero)', () => {
    expect(deriveOnAmountChange('500', '0')).toBeNull();
  });
  it('returns null when price is empty', () => {
    expect(deriveOnAmountChange('500', '')).toBeNull();
  });
  it('returns null when amount is empty', () => {
    expect(deriveOnAmountChange('', '200')).toBeNull();
  });
  it('returns null when amount is not a valid number', () => {
    expect(deriveOnAmountChange('abc', '200')).toBeNull();
  });
});

describe('deriveOnQuantityChange (Amount mode: derive price from amount/qty)', () => {
  it('returns price when amount and quantity are valid', () => {
    expect(deriveOnQuantityChange('500', '2.5')).toBe('200.00');
  });
  it('returns null when quantity is zero (division by zero)', () => {
    expect(deriveOnQuantityChange('500', '0')).toBeNull();
  });
  it('returns null when quantity is empty', () => {
    expect(deriveOnQuantityChange('500', '')).toBeNull();
  });
  it('returns null when amount is empty', () => {
    expect(deriveOnQuantityChange('', '2.5')).toBeNull();
  });
});

describe('deriveOnPriceChange', () => {
  // Amount mode: quantity = amount / price (price IS the denominator)
  it('Amount mode: derives quantity = amount / price', () => {
    const result = deriveOnPriceChange('500', '2.500000', '200.00', 'amount');
    expect(result).toEqual({ field: 'quantity', value: '2.500000' });
  });
  it('Amount mode: returns null when price is zero (division by zero)', () => {
    expect(deriveOnPriceChange('500', '2.5', '0', 'amount')).toBeNull();
  });
  it('Amount mode: returns null when price is empty', () => {
    expect(deriveOnPriceChange('500', '2.5', '', 'amount')).toBeNull();
  });
  it('Amount mode: returns null when amount is empty', () => {
    expect(deriveOnPriceChange('', '2.5', '200', 'amount')).toBeNull();
  });

  // Quantity mode: amount = quantity * price (price is a multiplicand — zero IS valid)
  it('Quantity mode: derives amount = quantity * price', () => {
    const result = deriveOnPriceChange('500', '2.5', '200.00', 'quantity');
    expect(result).toEqual({ field: 'amount', value: '500.00' });
  });
  it('Quantity mode: zero price produces zero amount (valid)', () => {
    expect(deriveOnPriceChange('500', '2.5', '0', 'quantity')).toEqual({ field: 'amount', value: '0.00' });
  });
  it('Quantity mode: returns null when price is empty', () => {
    expect(deriveOnPriceChange('500', '2.5', '', 'quantity')).toBeNull();
  });
  it('Quantity mode: returns null when quantity is empty', () => {
    expect(deriveOnPriceChange('500', '', '200', 'quantity')).toBeNull();
  });
});
