import Constants from 'expo-constants';

import { getApiUrl } from '../../src/config';
import { tokenStorage } from '../../src/storage/tokenStorage';
import { initialSelections, isTextAttribute, missingRequired, selectValue, setText, toSelectedAttributes } from '../../src/utils/attributes';
import { findCategory } from '../../src/utils/categories';
import { formatDate } from '../../src/utils/format';
import { htmlToText } from '../../src/utils/html';
import { isValidEmail, validateAddress, validateLogin, validateRegistration } from '../../src/utils/validation';
import { address, categories, engravingAttribute, giftWrapping, ramAttribute, softwareAttribute } from '../fixtures';

jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: null } }));

describe('attributes', () => {
  const colorAttribute = {
    ...ramAttribute,
    id: 9,
    controlType: 'color' as const,
    values: ramAttribute.values.map((value) => ({ ...value, isPreSelected: true })),
  };

  it('preselects values, keeping one for single-value controls', () => {
    expect(initialSelections([softwareAttribute, giftWrapping, colorAttribute, engravingAttribute])).toEqual({
      5: { valueIds: [10], text: '' },
      1: { valueIds: [1], text: '' },
      9: { valueIds: [3], text: '' },
      7: { valueIds: [], text: '' },
    });
  });

  it('replaces single values and toggles checkboxes', () => {
    let selections = selectValue({}, ramAttribute, 3);
    selections = selectValue(selections, ramAttribute, 4);
    expect(selections[2].valueIds).toEqual([4]);

    selections = selectValue(selections, softwareAttribute, 10);
    selections = selectValue(selections, softwareAttribute, 11);
    expect(selections[5].valueIds).toEqual([10, 11]);
    selections = selectValue(selections, softwareAttribute, 10);
    expect(selections[5].valueIds).toEqual([11]);
  });

  it('stores text for text attributes', () => {
    expect(setText({}, engravingAttribute, 'Hi')).toEqual({ 7: { valueIds: [], text: 'Hi' } });
    expect(isTextAttribute(engravingAttribute)).toBe(true);
    expect(isTextAttribute({ ...engravingAttribute, controlType: 'multiline' })).toBe(true);
    expect(isTextAttribute(ramAttribute)).toBe(false);
  });

  it('lists required attributes without a selection', () => {
    const unsupported = { ...ramAttribute, id: 20, name: 'Upload', controlType: 'unsupported' as const };
    const attributes = [ramAttribute, softwareAttribute, engravingAttribute, unsupported];
    expect(missingRequired(attributes, {})).toEqual(['RAM', 'Engraving']);
    expect(missingRequired(attributes, { 2: { valueIds: [3], text: '' }, 7: { valueIds: [], text: '  ' } })).toEqual(['Engraving']);
    expect(missingRequired(attributes, { 2: { valueIds: [3], text: '' }, 7: { valueIds: [], text: 'x' } })).toEqual([]);
  });

  it('converts selections to the API format, dropping empty ones', () => {
    const selections = {
      2: { valueIds: [4], text: '' },
      5: { valueIds: [], text: '' },
      7: { valueIds: [], text: ' Happy birthday ' },
    };
    expect(toSelectedAttributes([ramAttribute, softwareAttribute, engravingAttribute, giftWrapping], selections)).toEqual([
      { id: 2, valueIds: [4] },
      { id: 7, valueIds: [], text: 'Happy birthday' },
    ]);
  });
});

describe('validation', () => {
  it('validates emails', () => {
    expect(isValidEmail(' jane@example.com ')).toBe(true);
    expect(isValidEmail('jane@example')).toBe(false);
    expect(isValidEmail('')).toBe(false);
  });

  it('validates login', () => {
    expect(validateLogin('bad', '')).toEqual(['Enter a valid email address', 'Enter your password']);
    expect(validateLogin('a@b.co', 'x')).toEqual([]);
  });

  it('validates registration', () => {
    expect(validateRegistration({ email: 'x', password: '123', confirmPassword: '124', firstName: ' ', lastName: '' })).toEqual([
      'First name is required',
      'Last name is required',
      'Enter a valid email address',
      'Password must be at least 6 characters',
      'Passwords do not match',
    ]);
    expect(validateRegistration({ email: 'a@b.co', password: '123456', confirmPassword: '123456', firstName: 'A', lastName: 'B' })).toEqual([]);
  });

  it('validates addresses', () => {
    expect(validateAddress(address, true)).toEqual([]);
    const empty = { ...address, firstName: '', lastName: '', email: '', countryId: null, stateProvinceId: null, city: '', address1: '', zipPostalCode: '', phoneNumber: '' };
    expect(validateAddress(empty, true)).toHaveLength(9);
    expect(validateAddress(empty, false)).not.toContain('State / province is required');
  });
});

describe('htmlToText', () => {
  it('strips tags, keeps line structure and decodes entities', () => {
    expect(htmlToText('<p>Fast &amp; light</p><ul><li>One</li><li>Two&nbsp;items</li></ul>Line<br/>break &copy;')).toBe(
      'Fast & light\n\n• One\n• Two items\nLine\nbreak &copy;',
    );
  });

  it('handles empty input', () => {
    expect(htmlToText(null)).toBe('');
    expect(htmlToText(undefined)).toBe('');
  });
});

describe('findCategory', () => {
  it('finds nested categories', () => {
    expect(findCategory(categories, 5)?.name).toBe('Notebooks');
    expect(findCategory(categories, 2)?.name).toBe('Electronics');
    expect(findCategory(categories, 99)).toBeNull();
  });
});

describe('formatDate', () => {
  it('formats ISO dates and passes through invalid ones', () => {
    expect(formatDate('2026-11-19T21:48:00Z')).toBe(new Date('2026-11-19T21:48:00Z').toLocaleDateString());
    expect(formatDate('not a date')).toBe('not a date');
  });
});

describe('getApiUrl', () => {
  const originalEnv = process.env.EXPO_PUBLIC_API_URL;
  const expoConfig = Constants.expoConfig;

  afterEach(() => {
    process.env.EXPO_PUBLIC_API_URL = originalEnv;
    (Constants as { expoConfig: unknown }).expoConfig = expoConfig;
  });

  it('prefers the environment variable and trims trailing slashes', () => {
    process.env.EXPO_PUBLIC_API_URL = 'https://shop.example.com//';
    expect(getApiUrl()).toBe('https://shop.example.com');
  });

  it('falls back to app.json extra, then the emulator host', () => {
    delete process.env.EXPO_PUBLIC_API_URL;
    (Constants as { expoConfig: unknown }).expoConfig = { extra: { apiUrl: 'http://192.168.1.5:5000/' } };
    expect(getApiUrl()).toBe('http://192.168.1.5:5000');

    (Constants as { expoConfig: unknown }).expoConfig = null;
    expect(getApiUrl()).toBe('http://10.0.2.2:5000');
  });
});

describe('tokenStorage', () => {
  it('saves, loads and clears the token in secure storage', async () => {
    expect(await tokenStorage.load()).toBeNull();
    await tokenStorage.save('t1');
    expect(await tokenStorage.load()).toBe('t1');
    await tokenStorage.clear();
    expect(await tokenStorage.load()).toBeNull();
  });
});
