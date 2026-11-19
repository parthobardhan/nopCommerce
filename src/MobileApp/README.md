# nopCommerce mobile shopping app

A cross-platform (Android / iOS) shopping app for nopCommerce built with [Expo](https://expo.dev) (SDK 58, React Native 0.88, Expo Router, TypeScript).

Customers can:

- browse the category tree and category product lists (with paging and sorting)
- search products
- open product details, choose product attributes (dropdowns, radio buttons, checkboxes, color/image squares, text) and add to cart
- manage the cart (change quantity, remove items, see subtotal, shipping, tax and total)
- check out as a guest or a registered customer: address, shipping method, payment method, required checkout attributes (e.g. gift wrapping), review and place the order
- register, log in and log out (a guest cart is kept on registration and merged into the account on login)
- view their order history and order details

## How the app talks to nopCommerce

nopCommerce has no storefront API in this repository: the bundled `Misc.WebApi.Frontend` and `Misc.NopMobileApp` plugins only contain configuration pages that point to nopCommerce's separately sold Web API and mobile app products. This change therefore adds a small plugin, **`Misc.MobileApi`** (`src/Plugins/Nop.Plugin.Misc.MobileApi`), that exposes a JSON API under `/api/mobile/v1`. It is a thin layer over the regular nopCommerce services (`IShoppingCartService`, `IOrderProcessingService`, `ICustomerRegistrationService`, `IShippingService`, …), so prices, discounts, taxes, stock, cart and checkout validation, ACL and store mappings behave exactly as on the website. The app has no business logic of its own beyond simple form checks.

### Authentication

The API uses opaque bearer tokens instead of the storefront's cookies:

1. On first launch the app calls `POST /session`, which creates a guest customer and returns a random 256-bit token. The app keeps the token in the device keychain/keystore (`expo-secure-store`).
2. Every request sends `Authorization: Bearer <token>` (an `X-Mobile-Token` header works too). `MobileApiAuthenticationMiddleware` runs right after routing and before nopCommerce's cookie authentication. It resolves the customer and makes them the current customer (`IWorkContext`), so all nopCommerce services see the right cart, currency, language and customer roles.
3. `POST /auth/register` turns the guest into a registered customer and keeps the same token, cart and addresses. `POST /auth/login` validates the credentials, merges the guest cart into the account, revokes the guest token and returns a new one. `POST /auth/logout` revokes the token.

Only a SHA-256 hash of each token is stored, as a generic attribute of the customer, so a database leak does not expose usable tokens. A customer can be signed in on several devices at once. Tokens of deleted or inactive customers, or of customers flagged for re-login, are rejected.

### Endpoints

All paths are relative to `/api/mobile/v1`. Responses are camelCase JSON. Validation problems return `400` with an `errors` array (or an `error` string), missing/invalid tokens return `401`, and unknown resources return `404`.

| Area | Endpoints |
| --- | --- |
| Session & account | `POST /session`, `GET /customer`, `POST /auth/login`, `POST /auth/register`, `POST /auth/logout` |
| Catalog (no token needed) | `GET /categories` (tree), `GET /categories/{id}/products?page=&pageSize=&orderBy=`, `GET /products/featured`, `GET /products/search?q=&page=&pageSize=&orderBy=`, `GET /products/{id}` |
| Cart | `GET /cart`, `POST /cart/items` `{productId, quantity, attributes:[{id, valueIds, text}]}`, `PUT /cart/items/{id}` `{quantity}` (0 removes), `DELETE /cart/items/{id}` |
| Checkout | `GET /countries`, `GET /countries/{id}/states`, `GET /checkout` (state of every step plus `canConfirm`), `POST /checkout/address`, `GET /checkout/shipping-methods`, `POST /checkout/shipping-method`, `POST /checkout/attributes`, `GET /checkout/payment-methods`, `POST /checkout/payment-method`, `POST /checkout/confirm` |
| Orders | `GET /orders`, `GET /orders/{id}` |

`orderBy` takes the numeric nopCommerce `ProductSortingEnum` values (0 position, 5 name A–Z, 10 price low–high, 11 price high–low, 15 newest).

## Running it locally

### 1. Backend

1. Build the solution. The plugin is part of `src/NopCommerce.sln` and builds into `Presentation/Nop.Web/Plugins/Misc.MobileApi`:

   ```bash
   cd src
   dotnet build NopCommerce.sln
   ```

2. Run the store and complete the installation wizard (installing the sample data gives you a catalog to browse):

   ```bash
   cd src/Presentation/Nop.Web
   dotnet run --no-launch-profile --urls http://0.0.0.0:5000
   ```

   Binding to `0.0.0.0` lets the emulator or a phone on your network reach it.

3. In the admin area go to **Configuration → Local plugins** and install **Mobile storefront API** (group *Misc*). nopCommerce asks for a restart; once it is back, `curl -X POST http://localhost:5000/api/mobile/v1/session` should return a token.

4. Make sure at least one payment method the app can complete is active (for example **Check / Money Order**; see *Limitations*), and that a shipping method is active if you sell shippable products.

### 2. App

Requires Node.js 20+ and either the Android emulator or a device with [Expo Go](https://expo.dev/go).

```bash
cd src/MobileApp
npm install
npx expo start          # press "a" to open it in a running Android emulator
```

The store URL defaults to `http://10.0.2.2:5000`, which is the host machine as seen from the Android emulator. To point the app somewhere else, set `EXPO_PUBLIC_API_URL` (for example `EXPO_PUBLIC_API_URL=http://192.168.1.20:5000 npx expo start` for a phone on your Wi-Fi) or change `expo.extra.apiUrl` in `app.json`. The app talks plain HTTP to a development store. Production builds should use HTTPS.

## Project layout

```
src/
  app/          Expo Router routes (thin files that re-export screens), tab and stack layouts
  screens/      one component per screen (home, category, search, product, cart, checkout, account, register, orders)
  components/   reusable UI (product grid/card, attribute selector, quantity stepper, form fields, totals, state views)
  context/      SessionContext (token + current customer), CartContext (cart and badge count)
  api/          typed fetch client and API types
  hooks/        useAsync, usePagedProducts
  storage/      secure token storage
test/           Jest tests (unit, component and screen tests) and helpers (fake API, fixtures, render helpers)
```

## Tests

### App

```bash
cd src/MobileApp
npm test              # jest-expo + React Native Testing Library
npm run coverage      # with a coverage report (coverage/lcov-report/index.html)
npm run typecheck
npm run lint
```

Screen tests render real screens and providers against an in-memory fake of the API (`test/fakeApi.ts`), so they cover the request flow as well as the UI. Current coverage: 98.5 % statements, 92.3 % branches, 98.1 % functions, 98.8 % lines (143 tests).

### Plugin

```bash
cd src
dotnet test Tests/Nop.Plugin.Misc.MobileApi.Tests --collect:"XPlat Code Coverage" \
  -- DataCollectionRunSettings.DataCollectors.DataCollector.Configuration.Include="[Nop.Plugin.Misc.MobileApi]*"
```

The tests build on the shared `Nop.Tests` harness: an in-memory SQLite store with the sample data and the test tax, shipping and payment providers. They run the real plugin services, middleware and controllers end to end, from token authentication through a placed order. Current coverage of the plugin assembly: 99.4 % lines, 92.3 % branches (108 tests).

## Limitations

- **Payment:** only payment methods that need neither a redirect to a payment page nor input on a payment form are offered (e.g. Check / Money Order). Card forms, PayPal and other redirect or button methods are hidden. Supporting them needs a payment-provider SDK or an in-app browser flow.
- **Products the app cannot sell:** grouped products, rental products, gift cards, products with customer-entered prices, and products with required attributes the app can't render (file upload, date picker). They can still be browsed; their detail page explains why they must be bought on the website.
- **Not implemented yet:** wishlist, product reviews, discount/gift card codes, the customer address book (each checkout enters an address, used for both billing and shipping), pickup points, password recovery, multiple currencies/languages switching in the app, and push notifications.
- **Customer settings:** registration follows the store's registration type. With email validation or admin approval, registration succeeds but the customer has to activate their account before logging in. The app collects only email, password, first and last name. Other customer fields the store enables (phone, date of birth, custom customer attributes, newsletter or GDPR consents) are not asked for.
