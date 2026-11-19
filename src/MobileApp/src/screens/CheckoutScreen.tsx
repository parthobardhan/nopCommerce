import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import type { Address, CheckoutResult, CheckoutState, Country, PaymentMethod, ShippingMethod, StateProvince } from '../api/types';
import { AttributeSelector } from '../components/AttributeSelector';
import { Button } from '../components/Button';
import { ChoiceList } from '../components/ChoiceList';
import { SelectField } from '../components/SelectField';
import { ErrorList, ErrorView, LoadingView } from '../components/StateViews';
import { TextField } from '../components/TextField';
import { TotalsTable } from '../components/TotalsTable';
import { useCart } from '../context/CartContext';
import { useSession } from '../context/SessionContext';
import { colors, radius, spacing } from '../theme';
import { AttributeSelections, initialSelections, missingRequired, selectValue, setText, toSelectedAttributes } from '../utils/attributes';
import { validateAddress } from '../utils/validation';

export type CheckoutStep = 'address' | 'shipping' | 'payment' | 'review';

const STEP_TITLES: Record<CheckoutStep, string> = {
  address: 'Address',
  shipping: 'Shipping',
  payment: 'Payment',
  review: 'Review',
};

const shippingKey = (method: Pick<ShippingMethod, 'name' | 'shippingRateComputationMethodSystemName'>) =>
  `${method.shippingRateComputationMethodSystemName}|${method.name}`;

function emptyAddress(): Address {
  return {
    firstName: '',
    lastName: '',
    email: '',
    countryId: null,
    stateProvinceId: null,
    city: '',
    address1: '',
    zipPostalCode: '',
    phoneNumber: '',
  };
}

function withoutNulls(address: Address | null): Partial<Address> {
  if (!address) return {};
  return Object.fromEntries(Object.entries(address).filter(([, value]) => value !== null && value !== undefined)) as Partial<Address>;
}

function formatAddress(address: Address | null): string {
  if (!address) return '';
  return [
    `${address.firstName} ${address.lastName}`,
    address.address1,
    [address.city, address.stateProvinceName, address.zipPostalCode].filter(Boolean).join(', '),
    address.countryName,
    address.phoneNumber,
  ]
    .filter(Boolean)
    .join('\n');
}

export default function CheckoutScreen() {
  const router = useRouter();
  const { api, customer } = useSession();
  const { refresh: refreshCart, setCart } = useCart();

  const [state, setState] = useState<CheckoutState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [step, setStep] = useState<CheckoutStep>('address');
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const [address, setAddress] = useState<Address>(emptyAddress());
  const [countries, setCountries] = useState<Country[]>([]);
  const [loadedStates, setStates] = useState<{ countryId: number | null; list: StateProvince[] }>({ countryId: null, list: [] });

  const [shippingMethods, setShippingMethods] = useState<ShippingMethod[]>([]);
  const [shippingSelection, setShippingSelection] = useState<string | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [paymentSelection, setPaymentSelection] = useState<string | null>(null);
  const [checkoutSelections, setCheckoutSelections] = useState<AttributeSelections>({});

  const steps = useMemo<CheckoutStep[]>(
    () => (state?.requiresShipping === false ? ['address', 'payment', 'review'] : ['address', 'shipping', 'payment', 'review']),
    [state?.requiresShipping],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [checkout, countryList] = await Promise.all([api.getCheckout(), api.getCountries()]);
        if (cancelled) return;
        setState(checkout);
        setCountries(countryList);
        setCheckoutSelections(initialSelections(checkout.checkoutAttributes));
        const defaultCountry = countryList.find((country) => country.twoLetterIsoCode === 'US') ?? countryList[0];
        setAddress({
          ...emptyAddress(),
          firstName: customer?.firstName ?? '',
          lastName: customer?.lastName ?? '',
          email: customer?.email ?? '',
          countryId: defaultCountry?.id ?? null,
          ...withoutNulls(checkout.billingAddress),
        });
      } catch (e) {
        if (!cancelled) setLoadError((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api, customer]);

  useEffect(() => {
    const countryId = address.countryId;
    if (!countryId) return;
    let cancelled = false;
    api
      .getStates(countryId)
      .then((list) => !cancelled && setStates({ countryId, list }))
      .catch(() => !cancelled && setStates({ countryId, list: [] }));
    return () => {
      cancelled = true;
    };
  }, [api, address.countryId]);
  const states = loadedStates.countryId === address.countryId ? loadedStates.list : [];

  const applyResult = (result: CheckoutResult): boolean => {
    if (result.state) {
      setState(result.state);
      setCart(result.state.cart);
    }
    setErrors(result.errors);
    return result.success;
  };

  const guard = async (operation: () => Promise<void>) => {
    setBusy(true);
    try {
      await operation();
    } catch (e) {
      setErrors([(e as Error).message]);
    } finally {
      setBusy(false);
    }
  };

  const goToShipping = () =>
    guard(async () => {
      const { methods, errors: shippingErrors } = await api.getShippingMethods();
      setShippingMethods(methods);
      const selected = methods.find((method) => method.selected) ?? methods[0];
      setShippingSelection(selected ? shippingKey(selected) : null);
      setErrors(shippingErrors);
      setStep('shipping');
    });

  const goToPayment = () =>
    guard(async () => {
      const methods = await api.getPaymentMethods();
      setPaymentMethods(methods);
      setPaymentSelection((methods.find((method) => method.selected) ?? methods[0])?.systemName ?? null);
      setErrors(methods.length ? [] : ['No payment methods are available for the app.']);
      setStep('payment');
    });

  const submitAddress = async () => {
    const validation = validateAddress(address, states.length > 0);
    if (validation.length) {
      setErrors(validation);
      return;
    }
    await guard(async () => {
      const result = await api.setAddress(address);
      if (!applyResult(result)) return;
      if (result.state.requiresShipping) await goToShipping();
      else await goToPayment();
    });
  };

  const submitShipping = () =>
    guard(async () => {
      const method = shippingMethods.find((item) => shippingKey(item) === shippingSelection);
      if (!method) {
        setErrors(['Please select a shipping method']);
        return;
      }
      const result = await api.selectShippingMethod(method);
      if (applyResult(result)) await goToPayment();
    });

  const submitPayment = () =>
    guard(async () => {
      if (!paymentSelection) {
        setErrors(['Please select a payment method']);
        return;
      }
      const result = await api.selectPaymentMethod(paymentSelection);
      if (applyResult(result)) setStep('review');
    });

  const placeOrder = () =>
    guard(async () => {
      if (state?.checkoutAttributes.length) {
        const missing = missingRequired(state.checkoutAttributes, checkoutSelections);
        if (missing.length) {
          setErrors(missing.map((name) => `Please select ${name}`));
          return;
        }
        const result = await api.setCheckoutAttributes(toSelectedAttributes(state.checkoutAttributes, checkoutSelections));
        if (!applyResult(result)) return;
      }

      const order = await api.confirmOrder();
      if (!order.success) {
        setErrors(order.errors);
        return;
      }
      await refreshCart();
      router.replace(`/orders/${order.orderId}?placed=1`);
    });

  if (loadError) return <ErrorView message={loadError} />;
  if (!state) return <LoadingView />;
  if (!state.cart.items.length) return <ErrorView message="Your cart is empty." />;

  const update = (patch: Partial<Address>) => setAddress((current) => ({ ...current, ...patch }));

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" testID="checkout-screen">
      <View style={styles.steps}>
        {steps.map((item, index) => (
          <View key={item} style={[styles.step, item === step && styles.stepActive]}>
            <Text style={[styles.stepText, item === step && styles.stepTextActive]}>
              {index + 1}. {STEP_TITLES[item]}
            </Text>
          </View>
        ))}
      </View>

      <ErrorList errors={errors} />

      {step === 'address' ? (
        <View testID="step-address">
          <Text style={styles.title}>Billing & shipping address</Text>
          <TextField label="First name" value={address.firstName} onChangeText={(firstName) => update({ firstName })} testID="address-first-name" />
          <TextField label="Last name" value={address.lastName} onChangeText={(lastName) => update({ lastName })} testID="address-last-name" />
          <TextField
            label="Email"
            value={address.email}
            onChangeText={(email) => update({ email })}
            keyboardType="email-address"
            autoCapitalize="none"
            testID="address-email"
          />
          <SelectField
            label="Country"
            value={address.countryId}
            options={countries.map((country) => ({ value: country.id, label: country.name }))}
            onChange={(countryId) => update({ countryId, stateProvinceId: null })}
            testID="address-country"
          />
          {states.length ? (
            <SelectField
              label="State / province"
              value={address.stateProvinceId}
              options={states.map((item) => ({ value: item.id, label: item.name }))}
              onChange={(stateProvinceId) => update({ stateProvinceId })}
              testID="address-state"
            />
          ) : null}
          <TextField label="City" value={address.city} onChangeText={(city) => update({ city })} testID="address-city" />
          <TextField label="Street address" value={address.address1} onChangeText={(address1) => update({ address1 })} testID="address-address1" />
          <TextField
            label="Zip / postal code"
            value={address.zipPostalCode}
            onChangeText={(zipPostalCode) => update({ zipPostalCode })}
            testID="address-zip"
          />
          <TextField
            label="Phone"
            value={address.phoneNumber}
            onChangeText={(phoneNumber) => update({ phoneNumber })}
            keyboardType="phone-pad"
            testID="address-phone"
          />
          <Button title="Continue" onPress={submitAddress} loading={busy} testID="address-continue" />
        </View>
      ) : null}

      {step === 'shipping' ? (
        <View testID="step-shipping" style={styles.stepBody}>
          <Text style={styles.title}>Shipping method</Text>
          <ChoiceList
            testID="shipping"
            choices={shippingMethods.map((method) => ({
              key: shippingKey(method),
              title: method.name,
              subtitle: method.description,
              trailing: method.fee,
            }))}
            selectedKey={shippingSelection}
            onSelect={setShippingSelection}
          />
          <Button title="Continue" onPress={submitShipping} loading={busy} disabled={!shippingMethods.length} testID="shipping-continue" />
          <Button title="Back" variant="secondary" onPress={() => setStep('address')} />
        </View>
      ) : null}

      {step === 'payment' ? (
        <View testID="step-payment" style={styles.stepBody}>
          <Text style={styles.title}>Payment method</Text>
          <ChoiceList
            testID="payment"
            choices={paymentMethods.map((method) => ({
              key: method.systemName,
              title: method.name,
              subtitle: method.description,
              trailing: method.fee,
            }))}
            selectedKey={paymentSelection}
            onSelect={setPaymentSelection}
          />
          <Button title="Continue" onPress={submitPayment} loading={busy} disabled={!paymentMethods.length} testID="payment-continue" />
          <Button title="Back" variant="secondary" onPress={() => setStep(state.requiresShipping ? 'shipping' : 'address')} />
        </View>
      ) : null}

      {step === 'review' ? (
        <View testID="step-review" style={styles.stepBody}>
          <Text style={styles.title}>Review your order</Text>
          <View style={styles.card}>
            {state.cart.items.map((item) => (
              <View key={item.id} style={styles.line}>
                <Text style={styles.lineName} numberOfLines={2}>
                  {item.quantity} × {item.productName}
                </Text>
                <Text style={styles.lineTotal}>{item.subTotal}</Text>
              </View>
            ))}
          </View>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Address</Text>
            <Text style={styles.cardText}>{formatAddress(state.billingAddress)}</Text>
          </View>
          {state.selectedShippingMethod ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Shipping</Text>
              <Text style={styles.cardText}>{state.selectedShippingMethod.name}</Text>
            </View>
          ) : null}
          {state.selectedPaymentMethod ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Payment</Text>
              <Text style={styles.cardText}>{state.selectedPaymentMethod.name}</Text>
            </View>
          ) : null}
          {state.checkoutAttributes.length ? (
            <View style={styles.card}>
              {state.checkoutAttributes.map((attribute) => (
                <AttributeSelector
                  key={attribute.id}
                  attribute={attribute}
                  selection={checkoutSelections[attribute.id]}
                  onSelect={(valueId) => setCheckoutSelections((current) => selectValue(current, attribute, valueId))}
                  onChangeText={(text) => setCheckoutSelections((current) => setText(current, attribute, text))}
                />
              ))}
            </View>
          ) : null}
          <View style={styles.card}>
            <TotalsTable totals={state.cart.totals} />
          </View>
          <Button title="Place order" onPress={placeOrder} loading={busy} testID="place-order" />
          <Button title="Back" variant="secondary" onPress={() => setStep('payment')} />
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, backgroundColor: colors.background, flexGrow: 1 },
  steps: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.lg },
  step: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.sm, backgroundColor: colors.surface, alignItems: 'center' },
  stepActive: { backgroundColor: colors.primaryDark },
  stepText: { fontSize: 12, color: colors.muted, fontWeight: '600' },
  stepTextActive: { color: '#fff' },
  stepBody: { gap: spacing.md },
  title: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg, gap: spacing.sm },
  cardTitle: { fontWeight: '700', color: colors.text },
  cardText: { color: colors.text, lineHeight: 20 },
  line: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  lineName: { flex: 1, color: colors.text },
  lineTotal: { fontWeight: '600', color: colors.text },
});
