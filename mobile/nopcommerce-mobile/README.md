# nopCommerce mobile (customer storefront)

Expo (React Native) + TypeScript app for iOS and Android that talks to a nopCommerce store through the
[Web API Frontend plugin](https://www.nopcommerce.com/web-api). It covers the customer journey:
browse categories, search, product detail, cart, checkout, account (sign in / register) and order history.

The app ships with a clearly marked **demo mode** (default) that uses bundled fixtures shaped like the Web API
responses, so it runs without any backend. Point it at a real store from the **Settings** screen or via env vars.

## Run

```bash
cd mobile/nopcommerce-mobile
npm install
npx expo start            # then press a (Android emulator) / i (iOS simulator, macOS only) / scan with Expo Go
```

Useful scripts:

| Command | What it does |
|---|---|
| `npm test` | Jest unit/component tests (API client, demo store, cart/checkout logic, screens) |
| `npm run lint` | ESLint (`eslint-config-expo`) |
| `npm run typecheck` | `tsc --noEmit` |
| `npx expo prebuild` | Generate native `android/` and `ios/` projects (CNG); they are git-ignored |
| `npx expo run:android` | Local debug build on a connected device/emulator |
| `npm run build:android:preview` | EAS internal APK (requires an Expo account) |
| `npm run build:ios:preview` | EAS iOS simulator build (requires an Expo account) |

### Pointing at a real store

Either set env vars before starting (copy `.env.example` to `.env`):

```
EXPO_PUBLIC_STORE_URL=https://shop.example.com
EXPO_PUBLIC_DEMO_MODE=false
```

or open **Account → Store settings**, turn off *Demo mode*, enter the store root URL and press *Test connection*.
The client appends `/api-frontend`, requests a guest JWT from `Authenticate/GetToken` and sends it as a bearer
token. Tokens are stored with `expo-secure-store`.

Only `http(s)` origins are accepted; Android cleartext is enabled so a local store such as `http://10.0.2.2:5000`
works from the emulator.

## Architecture

```
app/                      expo-router screens ((tabs), category, product, checkout, orders, auth, settings)
src/api/types.ts          DTOs mirroring the Web API Frontend (snake_case)
src/api/storeApi.ts       StoreApi interface shared by live and demo implementations
src/api/httpStoreApi.ts   fetch-based client: URL building, bearer auth, 401 retry, error mapping
src/api/validation.ts     runtime guards for responses crossing the network boundary
src/api/demo/             in-memory DemoStoreApi + fixtures + bundled sample images
src/domain/               pure logic: cart math, checkout steps & address validation, URL normalisation
src/hooks/queries.ts      TanStack Query hooks per resource
src/state/                zustand stores (settings persisted in AsyncStorage, session)
src/ui/                   theme tokens and shared components
test/                     Jest suites
```

## API mapping

| Feature | Endpoint |
|---|---|
| Guest / customer token | `POST Authenticate/GetToken` |
| Home | `GET Catalog/HomepageCategories`, `GET Product/HomepageProducts` |
| Browse | `GET Catalog/GetCatalogRoot`, `GET Catalog/GetCategory/{id}` |
| Search | `GET Catalog/Search?q=` |
| Product | `GET Product/GetProductDetails/{id}` |
| Cart | `POST ShoppingCart/AddProductToCartFromCatalog/{id}/1/{qty}`, `GET ShoppingCart/Cart`, `GET ShoppingCart/CartTotal`, `POST ShoppingCart/UpdateCart` |
| Checkout | `Checkout/BillingAddress` + `SaveBilling`, `ShippingMethod` + `SaveShippingMethod`, `PaymentMethod` + `SavePaymentMethod`, `Confirm` + `ConfirmOrder` |
| Account | `GET Customer/Info`, `POST Customer/Register` |
| Orders | `GET Order/CustomerOrders`, `GET Order/Details/{id}` |

The DTOs are modelled on the plugin's public Swagger. Responses are checked by lightweight guards; a shape
mismatch surfaces as a readable "Unexpected response from store API" error instead of a crash.

## Limitations

- Payment: only offline payment methods exposed by the store are offered (no card entry, no processor secrets).
- Product attributes/variants, wishlist, reviews, multi-currency and multi-language are not implemented.
- The public demo store (`demo.nopcommerce.com`) sits behind a Cloudflare challenge that blocks non-browser
  clients; use your own store with the Web API plugin for live mode.
