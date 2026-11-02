// Rules for the mock payment gateway. Nothing here talks to a real
// processor: card and wallet details never leave the device, the backend
// only ever receives the chosen payment_method.

export const TEST_CARD_OK = '4242 4242 4242 4242';
export const TEST_CARD_DECLINED = '4000 0000 0000 0002';
export const TEST_OTP = '123456';

export const digitsOnly = (value: string): string => value.replace(/\D/g, '');

/** "4242424242424242" → "4242 4242 4242 4242" */
export const formatCardNumber = (value: string): string =>
  digitsOnly(value).slice(0, 19).replace(/(\d{4})(?=\d)/g, '$1 ');

/** "1228" → "12/28" */
export const formatExpiry = (value: string): string => {
  const digits = digitsOnly(value).slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
};

/** "09171234567" → "0917 123 4567" */
export const formatMobile = (value: string): string => {
  const digits = digitsOnly(value).slice(0, 11);
  return [digits.slice(0, 4), digits.slice(4, 7), digits.slice(7)].filter(Boolean).join(' ');
};

export const cardBrand = (number: string): 'Visa' | 'Mastercard' | null => {
  const digits = digitsOnly(number);
  if (/^4/.test(digits)) return 'Visa';
  if (/^(5[1-5]|2[2-7])/.test(digits)) return 'Mastercard';
  return null;
};

export const luhnValid = (number: string): boolean => {
  const digits = digitsOnly(number);
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let digit = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
};

/** MM/YY that hasn't passed — a card is valid through the end of its month. */
export const expiryValid = (value: string, now = new Date()): boolean => {
  const match = /^(\d{2})\/(\d{2})$/.exec(value);
  if (!match) return false;
  const month = Number(match[1]);
  const year = 2000 + Number(match[2]);
  if (month < 1 || month > 12) return false;
  return year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth() + 1);
};

export type CardErrors = Partial<Record<'number' | 'expiry' | 'cvc', string>>;

export const validateCard = (
  card: { number: string; expiry: string; cvc: string },
  now = new Date()
): CardErrors => {
  const errors: CardErrors = {};
  if (!luhnValid(card.number)) errors.number = 'Enter a valid card number.';
  if (!expiryValid(card.expiry, now)) errors.expiry = 'Enter a future date as MM/YY.';
  if (!/^\d{3,4}$/.test(card.cvc)) errors.cvc = 'Enter the 3 or 4 digit code.';
  return errors;
};

export const isDeclinedCard = (number: string): boolean =>
  digitsOnly(number) === digitsOnly(TEST_CARD_DECLINED);

/** Philippine mobile number: 09XXXXXXXXX */
export const mobileValid = (value: string): boolean => /^09\d{9}$/.test(digitsOnly(value));
