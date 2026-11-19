import type { Attribute, SelectedAttribute } from '../api/types';

export interface AttributeSelection {
  valueIds: number[];
  text: string;
}

export type AttributeSelections = Record<number, AttributeSelection>;

const SINGLE_VALUE_TYPES = new Set(['dropdown', 'radio', 'color', 'image']);

export function isTextAttribute(attribute: Attribute): boolean {
  return attribute.controlType === 'text' || attribute.controlType === 'multiline';
}

/** Pre-selected values become the initial selection, like on the nopCommerce product page */
export function initialSelections(attributes: Attribute[]): AttributeSelections {
  const selections: AttributeSelections = {};
  for (const attribute of attributes) {
    const preselected = attribute.values.filter((value) => value.isPreSelected).map((value) => value.id);
    selections[attribute.id] = {
      valueIds: SINGLE_VALUE_TYPES.has(attribute.controlType) ? preselected.slice(0, 1) : preselected,
      text: '',
    };
  }
  return selections;
}

/** Select a value: single-value controls replace the selection, checkboxes toggle it */
export function selectValue(
  selections: AttributeSelections,
  attribute: Attribute,
  valueId: number,
): AttributeSelections {
  const current = selections[attribute.id] ?? { valueIds: [], text: '' };
  let valueIds: number[];
  if (attribute.controlType === 'checkboxes') {
    valueIds = current.valueIds.includes(valueId)
      ? current.valueIds.filter((id) => id !== valueId)
      : [...current.valueIds, valueId];
  } else {
    valueIds = [valueId];
  }
  return { ...selections, [attribute.id]: { ...current, valueIds } };
}

export function setText(selections: AttributeSelections, attribute: Attribute, text: string): AttributeSelections {
  const current = selections[attribute.id] ?? { valueIds: [], text: '' };
  return { ...selections, [attribute.id]: { ...current, text } };
}

/** @returns names of required attributes without a selection */
export function missingRequired(attributes: Attribute[], selections: AttributeSelections): string[] {
  return attributes
    .filter((attribute) => attribute.isRequired && attribute.controlType !== 'unsupported')
    .filter((attribute) => {
      const selection = selections[attribute.id];
      if (!selection) return true;
      return isTextAttribute(attribute) ? !selection.text.trim() : selection.valueIds.length === 0;
    })
    .map((attribute) => attribute.name);
}

export function toSelectedAttributes(attributes: Attribute[], selections: AttributeSelections): SelectedAttribute[] {
  return attributes
    .filter((attribute) => selections[attribute.id])
    .map((attribute) => {
      const selection = selections[attribute.id];
      return isTextAttribute(attribute)
        ? { id: attribute.id, valueIds: [], text: selection.text.trim() }
        : { id: attribute.id, valueIds: selection.valueIds };
    })
    .filter((selected) => selected.valueIds.length > 0 || !!selected.text);
}
