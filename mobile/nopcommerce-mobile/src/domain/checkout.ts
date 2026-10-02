import type { AddressModelDto } from '../api/types';

export type CheckoutStep = 'address' | 'shipping' | 'payment' | 'confirm' | 'complete';

export const CHECKOUT_STEPS: readonly CheckoutStep[] = ['address', 'shipping', 'payment', 'confirm', 'complete'];

export function nextStep(step: CheckoutStep, requiresShipping: boolean): CheckoutStep {
  switch (step) {
    case 'address':
      return requiresShipping ? 'shipping' : 'payment';
    case 'shipping':
      return 'payment';
    case 'payment':
      return 'confirm';
    case 'confirm':
    case 'complete':
      return 'complete';
  }
}

export function previousStep(step: CheckoutStep, requiresShipping: boolean): CheckoutStep {
  switch (step) {
    case 'shipping':
      return 'address';
    case 'payment':
      return requiresShipping ? 'shipping' : 'address';
    case 'confirm':
      return 'payment';
    case 'address':
    case 'complete':
      return 'address';
  }
}

export type AddressField = keyof Pick<
  AddressModelDto,
  'first_name' | 'last_name' | 'email' | 'country_id' | 'city' | 'address1' | 'zip_postal_code' | 'phone_number'
>;

export type AddressErrors = Partial<Record<AddressField, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateAddress(address: AddressModelDto): AddressErrors {
  const errors: AddressErrors = {};
  if (!text(address.first_name)) errors.first_name = 'First name is required';
  if (!text(address.last_name)) errors.last_name = 'Last name is required';
  if (!text(address.email)) errors.email = 'Email is required';
  else if (!EMAIL_RE.test(address.email!.trim())) errors.email = 'Enter a valid email';
  if (!address.country_id || address.country_id <= 0) errors.country_id = 'Select a country';
  if (!text(address.city)) errors.city = 'City is required';
  if (!text(address.address1)) errors.address1 = 'Street address is required';
  if (!text(address.zip_postal_code)) errors.zip_postal_code = 'Postal code is required';
  if (!text(address.phone_number)) errors.phone_number = 'Phone number is required';
  else if (!isPlausiblePhone(address.phone_number!)) errors.phone_number = 'Enter a valid phone number';
  return errors;
}

/** Accepts international formats with separators; requires 6–15 digits (E.164 upper bound). */
export function isPlausiblePhone(value: string): boolean {
  const trimmed = value.trim();
  if (!/^\+?[\d\s().-]+$/.test(trimmed)) return false;
  const digits = trimmed.replace(/\D/g, '').length;
  return digits >= 6 && digits <= 15;
}

export function isAddressValid(address: AddressModelDto): boolean {
  return Object.keys(validateAddress(address)).length === 0;
}

export function emptyAddress(): AddressModelDto {
  return {
    first_name: '',
    last_name: '',
    email: '',
    company: '',
    country_id: null,
    state_province_id: null,
    city: '',
    address1: '',
    address2: '',
    zip_postal_code: '',
    phone_number: '',
  };
}

export function formatAddress(address: AddressModelDto): string {
  const lines = [
    [address.first_name, address.last_name].filter(Boolean).join(' '),
    address.address1,
    address.address2,
    [address.city, address.zip_postal_code].filter(Boolean).join(' '),
    address.country_name,
  ];
  return lines.filter((l) => l && l.trim()).join('\n');
}

function text(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}
