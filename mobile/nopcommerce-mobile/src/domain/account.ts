export interface RegisterForm {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  confirm_password: string;
}

export function validateRegisterForm(form: RegisterForm): Partial<Record<keyof RegisterForm, string>> {
  const errors: Partial<Record<keyof RegisterForm, string>> = {};
  if (!form.first_name.trim()) errors.first_name = 'First name is required';
  if (!form.last_name.trim()) errors.last_name = 'Last name is required';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) errors.email = 'Enter a valid email';
  if (form.password.length < 6) errors.password = 'Use at least 6 characters';
  if (form.password !== form.confirm_password) errors.confirm_password = 'Passwords do not match';
  return errors;
}
