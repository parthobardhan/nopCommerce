import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useStoreApi } from '../api';
import type { AddressModelDto, RegisterRequest } from '../api/types';
import { useSession } from '../state/session';

export const queryKeys = {
  homeCategories: ['catalog', 'home-categories'] as const,
  homeProducts: ['catalog', 'home-products'] as const,
  catalogRoot: ['catalog', 'root'] as const,
  category: (id: number, page: number) => ['catalog', 'category', id, page] as const,
  search: (term: string) => ['catalog', 'search', term] as const,
  product: (id: number) => ['catalog', 'product', id] as const,
  cart: ['cart'] as const,
  cartTotals: ['cart', 'totals'] as const,
  billing: ['checkout', 'billing'] as const,
  shipping: ['checkout', 'shipping'] as const,
  payment: ['checkout', 'payment'] as const,
  confirm: ['checkout', 'confirm'] as const,
  orders: ['orders'] as const,
  order: (id: number) => ['orders', id] as const,
  customer: ['customer'] as const,
};

export function useHomepageCategories() {
  const api = useStoreApi();
  return useQuery({ queryKey: queryKeys.homeCategories, queryFn: () => api.getHomepageCategories() });
}

export function useHomepageProducts() {
  const api = useStoreApi();
  return useQuery({ queryKey: queryKeys.homeProducts, queryFn: () => api.getHomepageProducts() });
}

export function useCatalogRoot() {
  const api = useStoreApi();
  return useQuery({ queryKey: queryKeys.catalogRoot, queryFn: () => api.getCatalogRoot() });
}

export function useCategory(id: number, page = 1) {
  const api = useStoreApi();
  return useQuery({
    queryKey: queryKeys.category(id, page),
    queryFn: () => api.getCategory(id, { pageNumber: page, pageSize: 20 }),
    enabled: Number.isInteger(id) && id > 0,
  });
}

export function useSearch(term: string) {
  const api = useStoreApi();
  const trimmed = term.trim();
  return useQuery({
    queryKey: queryKeys.search(trimmed),
    queryFn: () => api.search(trimmed),
    enabled: trimmed.length >= 2,
  });
}

export function useProduct(id: number) {
  const api = useStoreApi();
  return useQuery({
    queryKey: queryKeys.product(id),
    queryFn: () => api.getProductDetails(id),
    enabled: Number.isInteger(id) && id > 0,
  });
}

export function useCart() {
  const api = useStoreApi();
  return useQuery({ queryKey: queryKeys.cart, queryFn: () => api.getCart() });
}

export function useCartTotals(enabled = true) {
  const api = useStoreApi();
  return useQuery({ queryKey: queryKeys.cartTotals, queryFn: () => api.getCartTotals(), enabled });
}

function useInvalidateCart() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.cart });
}

export function useAddToCart() {
  const api = useStoreApi();
  const invalidate = useInvalidateCart();
  return useMutation({
    mutationFn: ({ productId, quantity }: { productId: number; quantity: number }) => api.addToCart(productId, quantity),
    onSuccess: invalidate,
  });
}

export function useUpdateCartItem() {
  const api = useStoreApi();
  const invalidate = useInvalidateCart();
  return useMutation({
    mutationFn: ({ itemId, quantity }: { itemId: number; quantity: number }) => api.updateCartItemQuantity(itemId, quantity),
    onSuccess: invalidate,
  });
}

export function useRemoveCartItem() {
  const api = useStoreApi();
  const invalidate = useInvalidateCart();
  return useMutation({ mutationFn: (itemId: number) => api.removeCartItem(itemId), onSuccess: invalidate });
}

export function useBillingAddress(enabled: boolean) {
  const api = useStoreApi();
  return useQuery({ queryKey: queryKeys.billing, queryFn: () => api.getBillingAddress(), enabled });
}

export function useSaveBilling() {
  const api = useStoreApi();
  return useMutation({
    mutationFn: ({ address, shipToSame }: { address: AddressModelDto; shipToSame: boolean }) => api.saveBillingAddress(address, shipToSame),
  });
}

export function useShippingMethods(enabled: boolean) {
  const api = useStoreApi();
  return useQuery({ queryKey: queryKeys.shipping, queryFn: () => api.getShippingMethods(), enabled });
}

export function useSaveShipping() {
  const api = useStoreApi();
  return useMutation({ mutationFn: (option: string) => api.saveShippingMethod(option) });
}

export function usePaymentMethods(enabled: boolean) {
  const api = useStoreApi();
  return useQuery({ queryKey: queryKeys.payment, queryFn: () => api.getPaymentMethods(), enabled });
}

export function useSavePayment() {
  const api = useStoreApi();
  return useMutation({ mutationFn: (systemName: string) => api.savePaymentMethod(systemName) });
}

export function useConfirmOrder() {
  const api = useStoreApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.confirmOrder(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cart });
      queryClient.invalidateQueries({ queryKey: queryKeys.orders });
    },
  });
}

export function useOrders(enabled: boolean) {
  const api = useStoreApi();
  return useQuery({ queryKey: queryKeys.orders, queryFn: () => api.getCustomerOrders(), enabled });
}

export function useOrder(id: number) {
  const api = useStoreApi();
  return useQuery({ queryKey: queryKeys.order(id), queryFn: () => api.getOrderDetails(id), enabled: id > 0 });
}

export function useCustomerInfo(enabled: boolean) {
  const api = useStoreApi();
  return useQuery({ queryKey: queryKeys.customer, queryFn: () => api.getCustomerInfo(), enabled });
}

export function useLogin() {
  const api = useStoreApi();
  const queryClient = useQueryClient();
  const setCustomer = useSession((s) => s.setCustomer);
  return useMutation({
    mutationFn: ({ username, password }: { username: string; password: string }) => api.login(username, password, true),
    onSuccess: (token) => {
      setCustomer({ customerId: token.customer_id, username: token.username ?? null });
      queryClient.invalidateQueries();
    },
  });
}

export function useRegister() {
  const api = useStoreApi();
  const queryClient = useQueryClient();
  const setCustomer = useSession((s) => s.setCustomer);
  return useMutation({
    mutationFn: (request: RegisterRequest) => api.register(request),
    onSuccess: (response) => {
      if (response.success && response.token) {
        setCustomer({ customerId: response.token.customer_id, username: response.token.username ?? null });
        queryClient.invalidateQueries();
      }
    },
  });
}

export function useLogout() {
  const api = useStoreApi();
  const queryClient = useQueryClient();
  const setCustomer = useSession((s) => s.setCustomer);
  return useMutation({
    mutationFn: () => api.getGuestToken(),
    onSuccess: (token) => {
      setCustomer({ customerId: token.customer_id, username: null });
      queryClient.clear();
    },
  });
}
