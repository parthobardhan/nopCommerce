/** Visual tokens for the storefront, loosely following the nopCommerce default theme. */
export const colors = {
  background: '#f6f7f9',
  surface: '#ffffff',
  surfaceMuted: '#eef0f3',
  border: '#dfe3e8',
  text: '#1f2933',
  textMuted: '#616e7c',
  primary: '#4ab2f1',
  primaryDark: '#248ece',
  primaryText: '#ffffff',
  accent: '#f17a4a',
  danger: '#d64545',
  success: '#2f9e44',
  warning: '#b7791f',
  demoBanner: '#fff4d6',
  demoBannerText: '#7a5600',
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { sm: 6, md: 10, lg: 16 } as const;

export const typography = {
  title: { fontSize: 22, fontWeight: '700' as const, color: colors.text },
  heading: { fontSize: 18, fontWeight: '600' as const, color: colors.text },
  body: { fontSize: 15, color: colors.text },
  caption: { fontSize: 13, color: colors.textMuted },
  price: { fontSize: 17, fontWeight: '700' as const, color: colors.text },
};
