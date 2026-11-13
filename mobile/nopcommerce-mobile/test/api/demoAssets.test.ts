import { resolveImageSource } from '../../src/api/demo/demoAssets';

describe('resolveImageSource', () => {
  const base = 'https://shop.example.com/store';

  it('passes absolute URLs through', () => {
    expect(resolveImageSource('https://cdn.example.com/a.jpg', base)).toEqual({ uri: 'https://cdn.example.com/a.jpg' });
  });

  it('resolves root-relative nopCommerce picture URLs against the store origin', () => {
    expect(resolveImageSource('/images/thumbs/0000020_apple-macbook-pro_415.jpeg', base)).toEqual({
      uri: 'https://shop.example.com/images/thumbs/0000020_apple-macbook-pro_415.jpeg',
    });
  });

  it('resolves protocol-relative CDN URLs with the store scheme', () => {
    expect(resolveImageSource('//cdn.example.com/a.jpg', 'http://localhost:5000')).toEqual({ uri: 'http://cdn.example.com/a.jpg' });
    expect(resolveImageSource('//cdn.example.com/a.jpg')).toEqual({ uri: 'https://cdn.example.com/a.jpg' });
  });

  it('returns null for empty or unresolvable values', () => {
    expect(resolveImageSource(null, base)).toBeNull();
    expect(resolveImageSource('/images/a.jpg')).toBeNull();
    expect(resolveImageSource('demo-asset://missing', base)).toBeNull();
  });
});
