import { validateRegisterForm } from '../../src/domain/account';
import { normalizeStoreUrl } from '../../src/domain/settings';
import { parseRouteId, stripHtml } from '../../src/domain/text';

describe('normalizeStoreUrl', () => {
  it('adds https, strips trailing slashes and /api-frontend', () => {
    expect(normalizeStoreUrl('shop.example.com/')).toEqual({ ok: true, url: 'https://shop.example.com' });
    expect(normalizeStoreUrl('https://shop.example.com/store/api-frontend/')).toEqual({ ok: true, url: 'https://shop.example.com/store' });
    expect(normalizeStoreUrl('http://10.0.2.2:5000')).toEqual({ ok: true, url: 'http://10.0.2.2:5000' });
  });

  it('rejects empty, malformed, non-http and credentialed URLs', () => {
    expect(normalizeStoreUrl('   ')).toMatchObject({ ok: false });
    expect(normalizeStoreUrl('ftp://shop.example.com')).toMatchObject({ ok: false, reason: expect.stringMatching(/http/) });
    expect(normalizeStoreUrl('https://user:pw@shop.example.com')).toMatchObject({ ok: false, reason: expect.stringMatching(/Credentials/) });
    expect(normalizeStoreUrl('https://')).toMatchObject({ ok: false });
  });
});

describe('parseRouteId', () => {
  it('accepts positive integers only', () => {
    expect(parseRouteId('42')).toBe(42);
    expect(parseRouteId(['7', '8'])).toBe(7);
    expect(parseRouteId('0')).toBe(0);
    expect(parseRouteId('-3')).toBe(0);
    expect(parseRouteId('4abc')).toBe(0);
    expect(parseRouteId(undefined)).toBe(0);
  });
});

describe('stripHtml', () => {
  it('converts block tags to newlines and decodes entities', () => {
    expect(stripHtml('<p>Hello&nbsp;<b>world</b></p><p>Tom &amp; Jerry<br/>end</p>')).toBe('Hello world\nTom & Jerry\nend');
  });
});

describe('validateRegisterForm', () => {
  it('requires names, a valid email, 6+ char password and matching confirmation', () => {
    const errors = validateRegisterForm({ first_name: '', last_name: ' ', email: 'x@y', password: '123', confirm_password: '1234' });
    expect(Object.keys(errors).sort()).toEqual(['confirm_password', 'email', 'first_name', 'last_name', 'password']);
    expect(validateRegisterForm({ first_name: 'A', last_name: 'B', email: 'a@b.co', password: 'secret1', confirm_password: 'secret1' })).toEqual({});
  });
});
