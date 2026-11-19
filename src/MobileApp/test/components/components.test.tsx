import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';

import { AttributeSelector } from '../../src/components/AttributeSelector';
import { Button } from '../../src/components/Button';
import { CartItemRow } from '../../src/components/CartItemRow';
import { ChoiceList } from '../../src/components/ChoiceList';
import { PriceText } from '../../src/components/PriceText';
import { ProductCard } from '../../src/components/ProductCard';
import { ProductGrid } from '../../src/components/ProductGrid';
import { QuantityStepper } from '../../src/components/QuantityStepper';
import { SelectField } from '../../src/components/SelectField';
import { EmptyView, ErrorList, ErrorView, LoadingView } from '../../src/components/StateViews';
import { TextField } from '../../src/components/TextField';
import { TotalsTable } from '../../src/components/TotalsTable';
import { cart, cartItem, engravingAttribute, price, productSummary, ramAttribute, softwareAttribute } from '../fixtures';

describe('Button', () => {
  it('calls onPress', async () => {
    const onPress = jest.fn();
    await render(<Button title="Buy" onPress={onPress} />);
    await fireEvent.press(screen.getByText('Buy'));
    expect(onPress).toHaveBeenCalled();
  });

  it('is inactive while disabled or loading', async () => {
    const onPress = jest.fn();
    await render(
      <>
        <Button title="Disabled" onPress={onPress} disabled testID="disabled" />
        <Button title="Loading" onPress={onPress} loading variant="secondary" testID="loading-button" />
      </>,
    );
    await fireEvent.press(screen.getByTestId('disabled'));
    await fireEvent.press(screen.getByTestId('loading-button'));
    expect(onPress).not.toHaveBeenCalled();
    expect(screen.queryByText('Loading')).toBeNull();
    expect(screen.getByTestId('loading-button')).toBeBusy();
    expect(screen.getByTestId('disabled')).toBeDisabled();
  });
});

describe('QuantityStepper', () => {
  it('increments and decrements within bounds', async () => {
    const onChange = jest.fn();
    await render(<QuantityStepper value={2} onChange={onChange} min={2} max={3} />);
    await fireEvent.press(screen.getByTestId('quantity-decrease'));
    expect(onChange).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('quantity-increase'));
    expect(onChange).toHaveBeenCalledWith(3);
    expect(screen.getByTestId('quantity-value')).toHaveTextContent('2');
  });

  it('does nothing when disabled', async () => {
    const onChange = jest.fn();
    await render(<QuantityStepper value={5} onChange={onChange} disabled />);
    await fireEvent.press(screen.getByTestId('quantity-increase'));
    await fireEvent.press(screen.getByTestId('quantity-decrease'));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('AttributeSelector', () => {
  it('renders option chips with price adjustments and selection state', async () => {
    const onSelect = jest.fn();
    await render(<AttributeSelector attribute={ramAttribute} selection={{ valueIds: [4], text: '' }} onSelect={onSelect} onChangeText={jest.fn()} />);

    expect(screen.getByText('RAM *')).toBeOnTheScreen();
    expect(screen.getByText('8 GB (+$60.00)')).toBeOnTheScreen();
    expect(screen.getByTestId('attribute-2-value-4')).toBeChecked();
    await fireEvent.press(screen.getByTestId('attribute-2-value-3'));
    expect(onSelect).toHaveBeenCalledWith(3);
  });

  it('renders checkboxes and color swatches', async () => {
    const colors = { ...ramAttribute, id: 8, controlType: 'color' as const, values: [{ ...ramAttribute.values[0], colorSquaresRgb: '#ff0000' }] };
    await render(
      <>
        <AttributeSelector attribute={softwareAttribute} selection={{ valueIds: [10], text: '' }} onSelect={jest.fn()} onChangeText={jest.fn()} />
        <AttributeSelector attribute={colors} selection={undefined} onSelect={jest.fn()} onChangeText={jest.fn()} />
      </>,
    );
    expect(screen.getByText('☑ Office (+$50.00)')).toBeOnTheScreen();
    expect(screen.getByText('☐ Acrobat')).toBeOnTheScreen();
    expect(screen.getByTestId('attribute-5-value-10')).toHaveProp('accessibilityRole', 'checkbox');
    expect(screen.getByTestId('attribute-8-value-3')).not.toBeChecked();
  });

  it('renders text inputs using the prompt', async () => {
    const onChangeText = jest.fn();
    await render(<AttributeSelector attribute={engravingAttribute} selection={undefined} onSelect={jest.fn()} onChangeText={onChangeText} />);
    expect(screen.getByText('Text to engrave *')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByTestId('attribute-7-text'), 'Hello');
    expect(onChangeText).toHaveBeenCalledWith('Hello');
  });

  it('explains unsupported attributes', async () => {
    await render(
      <AttributeSelector attribute={{ ...ramAttribute, controlType: 'unsupported' }} selection={undefined} onSelect={jest.fn()} onChangeText={jest.fn()} />,
    );
    expect(screen.getByText('This option can only be set on the website.')).toBeOnTheScreen();
  });
});

describe('CartItemRow', () => {
  it('shows the item and forwards quantity changes and removal', async () => {
    const onChangeQuantity = jest.fn();
    const onRemove = jest.fn();
    const item = cartItem(3, 2, { attributeInfo: 'RAM: 8 GB', imageUrl: 'http://store/p3.png' });
    await render(<CartItemRow item={item} onChangeQuantity={onChangeQuantity} onRemove={onRemove} />);

    expect(screen.getByText('Product 3')).toBeOnTheScreen();
    expect(screen.getByText('RAM: 8 GB')).toBeOnTheScreen();
    expect(screen.getByText('$10.00 each')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('cart-item-3-quantity-increase'));
    expect(onChangeQuantity).toHaveBeenCalledWith(3);
    await fireEvent.press(screen.getByTestId('cart-item-3-remove'));
    expect(onRemove).toHaveBeenCalled();
  });

  it('ignores input while busy', async () => {
    const onRemove = jest.fn();
    await render(<CartItemRow item={cartItem(3)} onChangeQuantity={jest.fn()} onRemove={onRemove} busy />);
    await fireEvent.press(screen.getByTestId('cart-item-3-remove'));
    expect(onRemove).not.toHaveBeenCalled();
  });
});

describe('ChoiceList', () => {
  it('renders choices and reports selection', async () => {
    const onSelect = jest.fn();
    await render(
      <ChoiceList
        testID="ship"
        choices={[
          { key: 'a', title: 'Ground', subtitle: 'By land', trailing: '$5.00' },
          { key: 'b', title: 'Air' },
        ]}
        selectedKey="a"
        onSelect={onSelect}
      />,
    );
    expect(screen.getByText('By land')).toBeOnTheScreen();
    expect(screen.getByTestId('ship-a')).toBeChecked();
    await fireEvent.press(screen.getByTestId('ship-b'));
    expect(onSelect).toHaveBeenCalledWith('b');
  });
});

describe('SelectField', () => {
  const options = [
    { value: 1, label: 'Canada' },
    { value: 2, label: 'United States' },
  ];

  it('opens a searchable list and selects an option', async () => {
    const onChange = jest.fn();
    await render(<SelectField label="Country" value={null} options={options} onChange={onChange} testID="country" />);
    expect(screen.getByText('Select…')).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('country'));
    await fireEvent.changeText(screen.getByTestId('country-filter'), 'united');
    expect(screen.queryByTestId('country-option-1')).toBeNull();
    await fireEvent.press(screen.getByTestId('country-option-2'));
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it('shows the selected label and closes without selecting', async () => {
    const onChange = jest.fn();
    await render(<SelectField label="Country" value={1} options={options} onChange={onChange} />);
    expect(screen.getByText('Canada')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('select'));
    await fireEvent.press(screen.getByTestId('select-close'));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('PriceText', () => {
  it('shows old and current prices', async () => {
    await render(<PriceText price={price(90, { oldFormatted: '$100.00' })} large />);
    expect(screen.getByText('$90.00')).toBeOnTheScreen();
    expect(screen.getByText('$100.00')).toBeOnTheScreen();
  });

  it('renders nothing without a formatted price', async () => {
    await render(<PriceText price={price(0, { formatted: null })} />);
    expect(screen.toJSON()).toBeNull();
  });
});

describe('ProductCard and ProductGrid', () => {
  it('renders products and reports taps', async () => {
    const onPress = jest.fn();
    await render(<ProductCard product={{ ...productSummary(1), imageUrl: null }} onPress={onPress} />);
    await fireEvent.press(screen.getByTestId('product-card-1'));
    expect(onPress).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
  });

  it('renders the header, empty state and loading footer', async () => {
    await render(<ProductGrid products={[]} onPressProduct={jest.fn()} header={<Text>Header</Text>} empty={<Text>Nothing</Text>} loadingMore />);
    expect(screen.getByText('Header')).toBeOnTheScreen();
    expect(screen.getByText('Nothing')).toBeOnTheScreen();
  });
});

describe('state views', () => {
  it('render loading, error, empty and error-list states', async () => {
    const onRetry = jest.fn();
    await render(
      <>
        <LoadingView label="Wait" />
        <ErrorView message="Broken" onRetry={onRetry} />
        <EmptyView message="Empty" />
        <ErrorList errors={['A', 'B']} />
        <ErrorList errors={[]} testID="no-errors" />
      </>,
    );
    expect(screen.getByText('Wait')).toBeOnTheScreen();
    expect(screen.getByText('Empty')).toBeOnTheScreen();
    expect(screen.getByTestId('error-list')).toHaveTextContent('AB');
    expect(screen.queryByTestId('no-errors')).toBeNull();
    await fireEvent.press(screen.getByText('Try again'));
    expect(onRetry).toHaveBeenCalled();
  });
});

describe('TextField', () => {
  it('labels the input', async () => {
    const onChangeText = jest.fn();
    await render(<TextField label="Email" value="" onChangeText={onChangeText} multiline />);
    await fireEvent.changeText(screen.getByLabelText('Email'), 'a@b.co');
    expect(onChangeText).toHaveBeenCalledWith('a@b.co');
  });
});

describe('TotalsTable', () => {
  it('shows only the totals that apply', async () => {
    const totals = {
      ...cart([cartItem(1)]).totals,
      subTotalDiscount: '$1.00',
      orderTotalDiscount: '$2.00',
      paymentMethodFee: '$3.00',
      total: null,
    };
    await render(<TotalsTable totals={totals} />);
    expect(screen.getByText('-$1.00')).toBeOnTheScreen();
    expect(screen.getByText('-$2.00')).toBeOnTheScreen();
    expect(screen.getByText('Payment fee')).toBeOnTheScreen();
    expect(screen.getByText('Calculated during checkout')).toBeOnTheScreen();

    await render(<TotalsTable totals={{ ...totals, requiresShipping: false }} />);
    expect(screen.queryByText('Shipping')).toBeNull();
  });
});
