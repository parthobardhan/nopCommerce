import { emptyAddress, formatAddress, isAddressValid, nextStep, previousStep, validateAddress } from '../../src/domain/checkout';

const VALID = { ...emptyAddress(), first_name: 'Ada', last_name: 'Lovelace', email: 'ada@example.com', country_id: 1, city: 'London', address1: '12 St', zip_postal_code: 'N1', phone_number: '+44 20 7946 0958' };

describe('validateAddress', () => {
  it('passes a complete address', () => {
    expect(validateAddress(VALID)).toEqual({});
    expect(isAddressValid(VALID)).toBe(true);
  });

  it('reports every missing required field', () => {
    const errors = validateAddress(emptyAddress());
    expect(Object.keys(errors).sort()).toEqual(['address1', 'city', 'country_id', 'email', 'first_name', 'last_name', 'phone_number', 'zip_postal_code']);
  });

  it('checks email and phone formats', () => {
    expect(validateAddress({ ...VALID, email: 'not-an-email' }).email).toMatch(/valid email/);
    expect(validateAddress({ ...VALID, phone_number: 'abc' }).phone_number).toMatch(/valid phone/);
    expect(validateAddress({ ...VALID, phone_number: '(212) 555-0100' })).toEqual({});
  });
});

describe('checkout step machine', () => {
  it('skips shipping when the cart has no shippable items', () => {
    expect(nextStep('address', true)).toBe('shipping');
    expect(nextStep('address', false)).toBe('payment');
    expect(nextStep('shipping', true)).toBe('payment');
    expect(nextStep('payment', true)).toBe('confirm');
    expect(nextStep('confirm', true)).toBe('complete');
    expect(nextStep('complete', true)).toBe('complete');
  });

  it('walks backwards symmetrically', () => {
    expect(previousStep('payment', false)).toBe('address');
    expect(previousStep('payment', true)).toBe('shipping');
    expect(previousStep('confirm', true)).toBe('payment');
    expect(previousStep('address', true)).toBe('address');
  });
});

describe('formatAddress', () => {
  it('omits empty lines', () => {
    expect(formatAddress({ ...VALID, address2: '', country_name: 'United Kingdom' })).toBe('Ada Lovelace\n12 St\nLondon N1\nUnited Kingdom');
  });
});
