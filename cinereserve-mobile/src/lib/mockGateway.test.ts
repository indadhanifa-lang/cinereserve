import { describe, expect, it } from 'vitest';
import {
  TEST_CARD_DECLINED,
  TEST_CARD_OK,
  cardBrand,
  expiryValid,
  formatCardNumber,
  formatExpiry,
  isDeclinedCard,
  luhnValid,
  mobileValid,
  validateCard,
} from './mockGateway';

const NOV_2026 = new Date(2026, 10, 3);

describe('card checks', () => {
  it('accepts both test cards and rejects a mistyped one', () => {
    expect(luhnValid(TEST_CARD_OK)).toBe(true);
    expect(luhnValid(TEST_CARD_DECLINED)).toBe(true);
    expect(luhnValid('4242 4242 4242 4241')).toBe(false);
    expect(luhnValid('4242')).toBe(false);
  });

  it('keeps a card valid through the end of its expiry month', () => {
    expect(expiryValid('11/26', NOV_2026)).toBe(true);
    expect(expiryValid('10/26', NOV_2026)).toBe(false);
    expect(expiryValid('01/27', NOV_2026)).toBe(true);
    expect(expiryValid('13/27', NOV_2026)).toBe(false);
    expect(expiryValid('1227', NOV_2026)).toBe(false);
  });

  it('reports every bad field at once', () => {
    expect(validateCard({ number: TEST_CARD_OK, expiry: '12/28', cvc: '123' }, NOV_2026)).toEqual({});
    expect(Object.keys(validateCard({ number: '1234', expiry: '01/20', cvc: '1' }, NOV_2026))).toEqual([
      'number',
      'expiry',
      'cvc',
    ]);
  });

  it('only declines the decline test card', () => {
    expect(isDeclinedCard('4000000000000002')).toBe(true);
    expect(isDeclinedCard(TEST_CARD_OK)).toBe(false);
  });

  it('formats input as the customer types', () => {
    expect(formatCardNumber('4242424242424242')).toBe('4242 4242 4242 4242');
    expect(formatExpiry('1228')).toBe('12/28');
    expect(formatExpiry('1')).toBe('1');
    expect(cardBrand('5555 5555 5555 4444')).toBe('Mastercard');
    expect(cardBrand('4242')).toBe('Visa');
  });
});

describe('wallet checks', () => {
  it('accepts an 11-digit 09 mobile number', () => {
    expect(mobileValid('0917 123 4567')).toBe(true);
    expect(mobileValid('0817 123 4567')).toBe(false);
    expect(mobileValid('0917 123 456')).toBe(false);
  });
});
