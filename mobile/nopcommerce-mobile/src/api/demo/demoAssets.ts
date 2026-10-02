import type { ImageSource } from 'expo-image';
import { DEMO_ASSET_SCHEME } from './fixtures';

const DEMO_ASSETS: Record<string, number> = {
  category_computers: require('../../../assets/demo/category_computers.jpeg'),
  category_electronics: require('../../../assets/demo/category_electronics.jpeg'),
  category_apparel: require('../../../assets/demo/category_apparel.jpeg'),
  category_shoes: require('../../../assets/demo/category_shoes.jpeg'),
  category_book: require('../../../assets/demo/category_book.jpeg'),
  category_jewelry: require('../../../assets/demo/category_jewelry.jpeg'),
  product_macbook_1: require('../../../assets/demo/product_macbook_1.jpeg'),
  product_macbook_2: require('../../../assets/demo/product_macbook_2.jpeg'),
  product_asuspc_N551JK: require('../../../assets/demo/product_asuspc_N551JK.jpeg'),
  product_LenovoThinkpad: require('../../../assets/demo/product_LenovoThinkpad.jpeg'),
  product_iphone_16_128: require('../../../assets/demo/product_iphone_16_128.png'),
  product_samsung_galaxy_s24: require('../../../assets/demo/product_samsung_galaxy_s24.png'),
  product_NikeFloralShoe_1: require('../../../assets/demo/product_NikeFloralShoe_1.jpg'),
  product_NikeFloralShoe_2: require('../../../assets/demo/product_NikeFloralShoe_2.jpg'),
  product_adidas: require('../../../assets/demo/product_adidas.jpg'),
  product_LeviJeans_1: require('../../../assets/demo/product_LeviJeans_1.jpg'),
  product_Fahrenheit451: require('../../../assets/demo/product_Fahrenheit451.jpeg'),
  product_FlowerBracelet: require('../../../assets/demo/product_FlowerBracelet.jpg'),
  product_LeicaT: require('../../../assets/demo/product_LeicaT.jpeg'),
  product_NikeShirt: require('../../../assets/demo/product_NikeShirt.jpg'),
};

/**
 * Turns a picture URL from the API into an `expo-image` source. Demo fixtures
 * use `demo-asset://<name>` so they render offline; anything else is a URI.
 */
export function resolveImageSource(url: string | null | undefined): ImageSource | number | null {
  if (!url) return null;
  if (url.startsWith(DEMO_ASSET_SCHEME)) {
    const key = url.slice(DEMO_ASSET_SCHEME.length);
    return DEMO_ASSETS[key] ?? null;
  }
  if (/^https?:\/\//i.test(url)) return { uri: url };
  return null;
}
