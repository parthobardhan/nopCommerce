import AccountRoute from '../../src/app/(tabs)/account';
import CartRoute from '../../src/app/(tabs)/cart';
import HomeRoute from '../../src/app/(tabs)/index';
import SearchRoute from '../../src/app/(tabs)/search';
import CategoryRoute from '../../src/app/category/[id]';
import CheckoutRoute from '../../src/app/checkout';
import OrderRoute from '../../src/app/orders/[id]';
import OrdersRoute from '../../src/app/orders/index';
import ProductRoute from '../../src/app/product/[id]';
import RegisterRoute from '../../src/app/register';
import AccountScreen from '../../src/screens/AccountScreen';
import CartScreen from '../../src/screens/CartScreen';
import CategoryScreen from '../../src/screens/CategoryScreen';
import CheckoutScreen from '../../src/screens/CheckoutScreen';
import HomeScreen from '../../src/screens/HomeScreen';
import OrderDetailsScreen from '../../src/screens/OrderDetailsScreen';
import OrdersScreen from '../../src/screens/OrdersScreen';
import ProductScreen from '../../src/screens/ProductScreen';
import RegisterScreen from '../../src/screens/RegisterScreen';
import SearchScreen from '../../src/screens/SearchScreen';

it.each([
  ['/', HomeRoute, HomeScreen],
  ['/search', SearchRoute, SearchScreen],
  ['/cart', CartRoute, CartScreen],
  ['/account', AccountRoute, AccountScreen],
  ['/category/[id]', CategoryRoute, CategoryScreen],
  ['/product/[id]', ProductRoute, ProductScreen],
  ['/checkout', CheckoutRoute, CheckoutScreen],
  ['/register', RegisterRoute, RegisterScreen],
  ['/orders', OrdersRoute, OrdersScreen],
  ['/orders/[id]', OrderRoute, OrderDetailsScreen],
])('route %s renders its screen', (_route, route, screen) => {
  expect(route).toBe(screen);
});
