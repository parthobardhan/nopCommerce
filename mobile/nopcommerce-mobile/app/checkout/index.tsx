import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { describeError } from '../../src/api/errors';
import type { AddressModelDto, SelectListItemDto } from '../../src/api/types';
import { emptyAddress, formatAddress, nextStep, previousStep, validateAddress, type AddressErrors, type CheckoutStep } from '../../src/domain/checkout';
import {
  useBillingAddress,
  useCart,
  useCartTotals,
  useConfirmOrder,
  usePaymentMethods,
  useSaveBilling,
  useSavePayment,
  useSaveShipping,
  useShippingMethods,
} from '../../src/hooks/queries';
import { Button } from '../../src/ui/components/Button';
import { DemoBanner } from '../../src/ui/components/DemoBanner';
import { Field } from '../../src/ui/components/Field';
import { EmptyState, ErrorState, Loading, Screen } from '../../src/ui/components/Screen';
import { colors, radius, spacing, typography } from '../../src/ui/theme';

const STEP_LABELS: Record<Exclude<CheckoutStep, 'complete'>, string> = {
  address: 'Address',
  shipping: 'Shipping',
  payment: 'Payment',
  confirm: 'Confirm',
};

export default function CheckoutScreen() {
  const cart = useCart();
  const totals = useCartTotals(Boolean(cart.data?.items.length));
  const requiresShipping = totals.data?.requires_shipping ?? true;
  const [step, setStep] = useState<CheckoutStep>('address');
  const [address, setAddress] = useState<AddressModelDto | null>(null);
  const [shipToSame, setShipToSame] = useState(true);
  const [shippingOption, setShippingOption] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<{ systemName: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (cart.isPending) return <Loading />;
  if (cart.isError) return <ErrorState error={cart.error} onRetry={cart.refetch} />;
  if (!cart.data.items.length) {
    return <EmptyState title="Your cart is empty" message="Add products before checking out." action={{ title: 'Back to shop', onPress: () => router.navigate('/') }} />;
  }

  const go = (next: CheckoutStep) => {
    setError(null);
    setStep(next);
  };

  return (
    <Screen>
      <DemoBanner />
      <StepHeader current={step} requiresShipping={requiresShipping} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" testID={`checkout-${step}`}>
        {error ? (
          <Text style={styles.error} testID="checkout-error">
            {error}
          </Text>
        ) : null}
        {step === 'address' ? (
          <AddressStep address={address} onChange={setAddress} shipToSame={shipToSame} onShipToSame={setShipToSame} onError={setError} onDone={() => go(nextStep('address', requiresShipping))} />
        ) : null}
        {step === 'shipping' ? (
          <ShippingStep selected={shippingOption} onSelect={setShippingOption} onError={setError} onBack={() => go(previousStep('shipping', requiresShipping))} onDone={() => go('payment')} />
        ) : null}
        {step === 'payment' ? (
          <PaymentStep selected={paymentMethod?.systemName ?? null} onSelect={setPaymentMethod} onError={setError} onBack={() => go(previousStep('payment', requiresShipping))} onDone={() => go('confirm')} />
        ) : null}
        {step === 'confirm' ? (
          <ConfirmStep
            address={address ?? emptyAddress()}
            shippingOption={shippingOption}
            paymentMethodName={paymentMethod?.name ?? null}
            totals={{ subtotal: totals.data?.sub_total ?? null, shipping: totals.data?.shipping ?? null, tax: totals.data?.tax ?? null, total: totals.data?.order_total ?? null }}
            items={cart.data.items.map((i) => ({ id: i.id, name: i.product_name, quantity: i.quantity, subTotal: i.sub_total }))}
            onBack={() => go('payment')}
            onError={setError}
          />
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function StepHeader({ current, requiresShipping }: { current: CheckoutStep; requiresShipping: boolean }) {
  const steps = (Object.keys(STEP_LABELS) as (keyof typeof STEP_LABELS)[]).filter((s) => requiresShipping || s !== 'shipping');
  const currentIndex = steps.indexOf(current as keyof typeof STEP_LABELS);
  return (
    <View style={styles.stepper} testID="checkout-stepper">
      {steps.map((s, index) => (
        <View key={s} style={styles.step}>
          <View style={[styles.stepDot, index <= currentIndex && styles.stepDotActive]}>
            <Text style={[styles.stepNumber, index <= currentIndex && styles.stepNumberActive]}>{index + 1}</Text>
          </View>
          <Text style={[typography.caption, index === currentIndex && styles.stepLabelActive]}>{STEP_LABELS[s]}</Text>
        </View>
      ))}
    </View>
  );
}

interface AddressStepProps {
  address: AddressModelDto | null;
  onChange: (a: AddressModelDto) => void;
  shipToSame: boolean;
  onShipToSame: (v: boolean) => void;
  onError: (message: string | null) => void;
  onDone: () => void;
}

function AddressStep({ address, onChange, shipToSame, onShipToSame, onError, onDone }: AddressStepProps) {
  const billing = useBillingAddress(true);
  const save = useSaveBilling();
  const [errors, setErrors] = useState<AddressErrors>({});

  // Until the shopper edits a field, show the address the store suggests.
  const form: AddressModelDto = useMemo(
    () => address ?? { ...emptyAddress(), ...(billing.data?.billing_new_address ?? {}), available_countries: undefined },
    [address, billing.data],
  );
  const countries: SelectListItemDto[] = useMemo(() => billing.data?.billing_new_address.available_countries ?? [], [billing.data]);

  if (billing.isPending) return <Loading label="Preparing checkout…" />;
  if (billing.isError) return <ErrorState error={billing.error} onRetry={billing.refetch} />;

  const set = (patch: Partial<AddressModelDto>) => {
    const next = { ...form, ...patch };
    onChange(next);
    if (Object.keys(errors).length) setErrors(validateAddress(next));
  };

  const submit = () => {
    const validation = validateAddress(form);
    setErrors(validation);
    if (Object.keys(validation).length) return;
    onChange(form);
    save.mutate(
      { address: form, shipToSame },
      {
        onSuccess: (result) => {
          if (result.wrong_billing_address || result.errors?.length) onError(result.errors?.join('\n') ?? 'The store rejected this address');
          else onDone();
        },
        onError: (e) => onError(describeError(e)),
      },
    );
  };

  return (
    <View style={styles.card}>
      <Text style={typography.heading}>Billing address</Text>
      <View style={styles.twoCol}>
        <View style={styles.col}>
          <Field label="First name" value={form.first_name ?? ''} onChangeText={(v) => set({ first_name: v })} error={errors.first_name} autoComplete="given-name" testID="addr-first-name" />
        </View>
        <View style={styles.col}>
          <Field label="Last name" value={form.last_name ?? ''} onChangeText={(v) => set({ last_name: v })} error={errors.last_name} autoComplete="family-name" testID="addr-last-name" />
        </View>
      </View>
      <Field label="Email" value={form.email ?? ''} onChangeText={(v) => set({ email: v })} error={errors.email} keyboardType="email-address" autoCapitalize="none" autoComplete="email" testID="addr-email" />
      <Text style={styles.fieldLabel}>Country</Text>
      <View style={styles.chips}>
        {countries.map((c) => {
          const selected = String(form.country_id ?? '') === c.value;
          return (
            <Pressable key={c.value} onPress={() => set({ country_id: Number(c.value) })} style={[styles.chip, selected && styles.chipSelected]} accessibilityRole="radio" accessibilityState={{ selected }} testID={`country-${c.value}`}>
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{c.text}</Text>
            </Pressable>
          );
        })}
      </View>
      {errors.country_id ? <Text style={styles.fieldError}>{errors.country_id}</Text> : null}
      <Field label="Street address" value={form.address1 ?? ''} onChangeText={(v) => set({ address1: v })} error={errors.address1} autoComplete="street-address" testID="addr-address1" />
      <Field label="Apartment, suite (optional)" value={form.address2 ?? ''} onChangeText={(v) => set({ address2: v })} testID="addr-address2" />
      <View style={styles.twoCol}>
        <View style={styles.col}>
          <Field label="City" value={form.city ?? ''} onChangeText={(v) => set({ city: v })} error={errors.city} testID="addr-city" />
        </View>
        <View style={styles.col}>
          <Field label="Postal code" value={form.zip_postal_code ?? ''} onChangeText={(v) => set({ zip_postal_code: v })} error={errors.zip_postal_code} autoComplete="postal-code" testID="addr-zip" />
        </View>
      </View>
      <Field label="Phone" value={form.phone_number ?? ''} onChangeText={(v) => set({ phone_number: v })} error={errors.phone_number} keyboardType="phone-pad" autoComplete="tel" testID="addr-phone" />
      {billing.data.ship_to_same_address_allowed ? (
        <View style={styles.switchRow}>
          <Text style={typography.body}>Ship to this address</Text>
          <Switch value={shipToSame} onValueChange={onShipToSame} trackColor={{ true: colors.primary }} />
        </View>
      ) : null}
      <Button title="Continue to shipping" onPress={submit} loading={save.isPending} style={styles.cta} testID="address-continue" />
    </View>
  );
}

interface ChoiceStepProps {
  selected: string | null;
  onSelect: (value: string) => void;
  onError: (message: string | null) => void;
  onBack: () => void;
  onDone: () => void;
}

function ShippingStep({ selected, onSelect, onError, onBack, onDone }: ChoiceStepProps) {
  const methods = useShippingMethods(true);
  const save = useSaveShipping();

  if (methods.isPending) return <Loading label="Loading shipping options…" />;
  if (methods.isError) return <ErrorState error={methods.error} onRetry={methods.refetch} />;

  const preselected = methods.data.shipping_methods.find((m) => m.selected) ?? methods.data.shipping_methods[0];
  const current = selected ?? (preselected ? shippingKey(preselected.name, preselected.shipping_rate_computation_method_system_name) : null);

  const submit = () => {
    if (!current) return onError('Choose a shipping method');
    onSelect(current);
    save.mutate(current, {
      onSuccess: (result) => (result.errors?.length ? onError(result.errors.join('\n')) : onDone()),
      onError: (e) => onError(describeError(e)),
    });
  };

  return (
    <View style={styles.card}>
      <Text style={typography.heading}>Shipping method</Text>
      {methods.data.warnings.map((w) => (
        <Text key={w} style={styles.error}>
          {w}
        </Text>
      ))}
      {methods.data.shipping_methods.map((m) => {
        const key = shippingKey(m.name, m.shipping_rate_computation_method_system_name);
        const isSelected = current === key;
        return (
          <Pressable key={key} onPress={() => onSelect(key)} style={[styles.option, isSelected && styles.optionSelected]} accessibilityRole="radio" accessibilityState={{ selected: isSelected }} testID={`shipping-${m.name.replace(/\s+/g, '-').toLowerCase()}`}>
            <View style={{ flex: 1 }}>
              <Text style={styles.optionTitle}>{m.name}</Text>
              {m.description ? <Text style={typography.caption}>{m.description}</Text> : null}
            </View>
            <Text style={typography.price}>{m.fee}</Text>
          </Pressable>
        );
      })}
      <View style={styles.navRow}>
        <Button title="Back" variant="secondary" onPress={onBack} />
        <Button title="Continue to payment" onPress={submit} loading={save.isPending} style={styles.navPrimary} testID="shipping-continue" />
      </View>
    </View>
  );
}

interface PaymentStepProps extends Omit<ChoiceStepProps, 'onSelect'> {
  onSelect: (method: { systemName: string; name: string }) => void;
}

function PaymentStep({ selected, onSelect, onError, onBack, onDone }: PaymentStepProps) {
  const methods = usePaymentMethods(true);
  const save = useSavePayment();

  if (methods.isPending) return <Loading label="Loading payment options…" />;
  if (methods.isError) return <ErrorState error={methods.error} onRetry={methods.refetch} />;

  const preselected = methods.data.payment_methods.find((m) => m.selected) ?? methods.data.payment_methods[0];
  const current = selected ?? preselected?.payment_method_system_name ?? null;

  const submit = () => {
    const chosen = methods.data.payment_methods.find((m) => m.payment_method_system_name === current);
    if (!chosen) return onError('Choose a payment method');
    onSelect({ systemName: chosen.payment_method_system_name, name: chosen.name });
    save.mutate(chosen.payment_method_system_name, {
      onSuccess: (result) => (result.errors?.length ? onError(result.errors.join('\n')) : onDone()),
      onError: (e) => onError(describeError(e)),
    });
  };

  return (
    <View style={styles.card}>
      <Text style={typography.heading}>Payment method</Text>
      <Text style={styles.notice}>No card details are collected in this app. Only offline payment methods configured on the store are offered.</Text>
      {methods.data.payment_methods.length === 0 ? <Text style={styles.error}>The store has no payment methods available for this app.</Text> : null}
      {methods.data.payment_methods.map((m) => {
        const isSelected = current === m.payment_method_system_name;
        return (
          <Pressable key={m.payment_method_system_name} onPress={() => onSelect({ systemName: m.payment_method_system_name, name: m.name })} style={[styles.option, isSelected && styles.optionSelected]} accessibilityRole="radio" accessibilityState={{ selected: isSelected }} testID={`payment-${m.payment_method_system_name}`}>
            <View style={{ flex: 1 }}>
              <Text style={styles.optionTitle}>{m.name}</Text>
              {m.description ? <Text style={typography.caption}>{m.description}</Text> : null}
            </View>
            {m.fee ? <Text style={typography.price}>{m.fee}</Text> : null}
          </Pressable>
        );
      })}
      <View style={styles.navRow}>
        <Button title="Back" variant="secondary" onPress={onBack} />
        <Button title="Review order" onPress={submit} loading={save.isPending} disabled={!methods.data.payment_methods.length} style={styles.navPrimary} testID="payment-continue" />
      </View>
    </View>
  );
}

interface ConfirmStepProps {
  address: AddressModelDto;
  shippingOption: string | null;
  paymentMethodName: string | null;
  totals: { subtotal: string | null; shipping: string | null; tax: string | null; total: string | null };
  items: { id: number; name: string; quantity: number; subTotal: string }[];
  onBack: () => void;
  onError: (message: string | null) => void;
}

function ConfirmStep({ address, shippingOption, paymentMethodName, totals, items, onBack, onError }: ConfirmStepProps) {
  const confirm = useConfirmOrder();
  const place = () => {
    confirm.mutate(undefined, {
      onSuccess: (result) => {
        if (result.completed) {
          router.replace({ pathname: '/checkout/complete', params: { orderId: String(result.completed.order_id), orderNumber: result.completed.custom_order_number } });
        } else {
          onError(result.errors?.join('\n') ?? 'The store could not place the order');
        }
      },
      onError: (e) => onError(describeError(e)),
    });
  };
  return (
    <View style={styles.card}>
      <Text style={typography.heading}>Review your order</Text>
      <Text style={styles.summaryLabel}>Ship to</Text>
      <Text style={typography.body} testID="confirm-address">
        {formatAddress(address)}
      </Text>
      <Text style={styles.summaryLabel}>Shipping</Text>
      <Text style={typography.body}>{shippingOption?.split('___')[0] ?? '—'}</Text>
      <Text style={styles.summaryLabel}>Payment</Text>
      <Text style={typography.body}>{paymentMethodName ?? '—'}</Text>
      <Text style={styles.summaryLabel}>Items</Text>
      {items.map((i) => (
        <View key={i.id} style={styles.row}>
          <Text style={[typography.body, { flex: 1 }]} numberOfLines={1}>
            {i.quantity} × {i.name}
          </Text>
          <Text style={typography.body}>{i.subTotal}</Text>
        </View>
      ))}
      <View style={styles.divider} />
      <TotalRow label="Subtotal" value={totals.subtotal} />
      <TotalRow label="Shipping" value={totals.shipping} />
      <TotalRow label="Tax" value={totals.tax} />
      <TotalRow label="Total" value={totals.total} bold />
      <View style={styles.navRow}>
        <Button title="Back" variant="secondary" onPress={onBack} />
        <Button title="Place order" onPress={place} loading={confirm.isPending} style={styles.navPrimary} testID="place-order" />
      </View>
    </View>
  );
}

function TotalRow({ label, value, bold }: { label: string; value: string | null; bold?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={[typography.body, bold && styles.bold]}>{label}</Text>
      <Text style={[typography.body, bold && styles.bold]}>{value ?? '—'}</Text>
    </View>
  );
}

function shippingKey(name: string, systemName: string): string {
  return `${name}___${systemName}`;
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  stepper: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  step: { alignItems: 'center', gap: spacing.xs },
  stepDot: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  stepDotActive: { backgroundColor: colors.primary },
  stepNumber: { ...typography.caption, fontWeight: '700' },
  stepNumberActive: { color: colors.primaryText },
  stepLabelActive: { color: colors.text, fontWeight: '700' },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, gap: spacing.sm },
  twoCol: { flexDirection: 'row', gap: spacing.md },
  col: { flex: 1 },
  fieldLabel: { ...typography.caption, fontWeight: '600' },
  fieldError: { color: colors.danger, fontSize: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  chipSelected: { borderColor: colors.primaryDark, backgroundColor: '#e3f3fd' },
  chipText: { ...typography.body },
  chipTextSelected: { color: colors.primaryDark, fontWeight: '700' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm },
  cta: { marginTop: spacing.sm },
  option: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md },
  optionSelected: { borderColor: colors.primaryDark, backgroundColor: '#e3f3fd' },
  optionTitle: { ...typography.body, fontWeight: '600' },
  navRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  navPrimary: { flex: 1 },
  notice: { ...typography.caption, backgroundColor: colors.demoBanner, color: colors.demoBannerText, padding: spacing.sm, borderRadius: radius.sm },
  summaryLabel: { ...typography.caption, fontWeight: '700', marginTop: spacing.sm, textTransform: 'uppercase' },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.sm },
  bold: { fontWeight: '700', fontSize: 17 },
  error: { color: colors.danger, backgroundColor: '#fdecec', padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.md },
});
