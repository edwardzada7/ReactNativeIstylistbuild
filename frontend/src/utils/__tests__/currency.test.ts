import { CURRENCY, formatCurrency, formatPriceRange } from '../currency';

const NAIRA = '\u20A6'; // ₦

describe('CURRENCY config', () => {
  it('is configured for Nigerian Naira', () => {
    expect(CURRENCY.code).toBe('NGN');
    expect(CURRENCY.symbol).toBe(NAIRA);
    expect(CURRENCY.locale).toBe('en-NG');
  });
});

describe('formatCurrency', () => {
  it('prefixes the Naira symbol and groups thousands', () => {
    expect(formatCurrency(15000)).toBe(`${NAIRA}15,000`);
    expect(formatCurrency(1234567)).toBe(`${NAIRA}1,234,567`);
  });

  it('rounds to whole Naira (no fraction digits)', () => {
    expect(formatCurrency(99.4)).toBe(`${NAIRA}99`);
    expect(formatCurrency(99.9)).toBe(`${NAIRA}100`);
  });

  it('accepts numeric strings', () => {
    expect(formatCurrency('2500')).toBe(`${NAIRA}2,500`);
  });

  it('formats zero', () => {
    expect(formatCurrency(0)).toBe(`${NAIRA}0`);
  });

  it('preserves negative amounts', () => {
    expect(formatCurrency(-500)).toBe(`${NAIRA}-500`);
  });

  it.each([undefined, null, 'not-a-number', NaN, Infinity])(
    'falls back to zero for non-finite input %p',
    (input) => {
      expect(formatCurrency(input as never)).toBe(`${NAIRA}0`);
    }
  );
});

describe('formatPriceRange', () => {
  it('returns the bare symbol when no range is provided', () => {
    expect(formatPriceRange()).toBe(NAIRA);
    expect(formatPriceRange(null)).toBe(NAIRA);
    expect(formatPriceRange('')).toBe(NAIRA);
  });

  it('replaces every USD "$" tier marker with the Naira symbol', () => {
    expect(formatPriceRange('$')).toBe(NAIRA);
    expect(formatPriceRange('$$')).toBe(`${NAIRA}${NAIRA}`);
    expect(formatPriceRange('$$$')).toBe(`${NAIRA}${NAIRA}${NAIRA}`);
  });

  it('leaves non-dollar content untouched', () => {
    expect(formatPriceRange('mid-range')).toBe('mid-range');
  });
});
