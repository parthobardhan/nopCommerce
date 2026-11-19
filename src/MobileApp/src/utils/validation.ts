import type { Address } from '../api/types';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email.trim());
}

export function validateLogin(email: string, password: string): string[] {
  const errors: string[] = [];
  if (!isValidEmail(email)) errors.push('Enter a valid email address');
  if (!password) errors.push('Enter your password');
  return errors;
}

export function validateRegistration(data: {
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
}): string[] {
  const errors: string[] = [];
  if (!data.firstName.trim()) errors.push('First name is required');
  if (!data.lastName.trim()) errors.push('Last name is required');
  if (!isValidEmail(data.email)) errors.push('Enter a valid email address');
  if (data.password.length < 6) errors.push('Password must be at least 6 characters');
  if (data.password !== data.confirmPassword) errors.push('Passwords do not match');
  return errors;
}

export function validateAddress(address: Address, requiresState: boolean): string[] {
  const errors: string[] = [];
  if (!address.firstName.trim()) errors.push('First name is required');
  if (!address.lastName.trim()) errors.push('Last name is required');
  if (!isValidEmail(address.email)) errors.push('Enter a valid email address');
  if (!address.countryId) errors.push('Country is required');
  if (requiresState && !address.stateProvinceId) errors.push('State / province is required');
  if (!address.city.trim()) errors.push('City is required');
  if (!address.address1.trim()) errors.push('Street address is required');
  if (!address.zipPostalCode.trim()) errors.push('Zip / postal code is required');
  if (!address.phoneNumber.trim()) errors.push('Phone number is required');
  return errors;
}
