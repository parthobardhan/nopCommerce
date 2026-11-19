import { API_PREFIX } from '../src/api/client';
import { cart as emptyCart, guestCustomer } from './fixtures';

export interface FakeRequest {
  method: string;
  path: string;
  query: URLSearchParams;
  body: any;
  token: string | null;
}

export interface FakeResponse {
  status: number;
  body: unknown;
}

/** A route returns a plain body (HTTP 200) or `reply(status, body)` */
export type Route = unknown | ((request: FakeRequest) => unknown);
export type Routes = Record<string, Route>;

const REPLY = Symbol('reply');

export function reply(status: number, body: unknown) {
  return { [REPLY]: true, status, body };
}

function toResponse(result: unknown): FakeResponse {
  if (result && typeof result === 'object' && REPLY in result) {
    const { status, body } = result as unknown as FakeResponse;
    return { status, body };
  }
  return { status: 200, body: result };
}

function matchRoute(pattern: string, method: string, path: string): boolean {
  const [routeMethod, routePath] = pattern.split(' ');
  if (routeMethod !== method) return false;
  const regex = new RegExp(`^${routePath.replace(/:[a-zA-Z]+/g, '[^/]+')}$`);
  return regex.test(path);
}

export const defaultRoutes: Routes = {
  'POST /session': { token: 'guest-token', customer: guestCustomer },
  'GET /customer': guestCustomer,
  'GET /cart': emptyCart([]),
};

/**
 * Fake nopCommerce Misc.MobileApi backend for component tests.
 * Routes are keyed "METHOD /path" (path params as `:name`); later keys win over `defaultRoutes`.
 */
export function createFakeApi(routes: Routes = {}) {
  const table: Routes = { ...defaultRoutes, ...routes };
  const requests: FakeRequest[] = [];

  const fetchImpl = jest.fn(async (input: string, init?: RequestInit) => {
    const url = new URL(input);
    const path = url.pathname.slice(API_PREFIX.length);
    const method = init?.method ?? 'GET';
    const headers = (init?.headers ?? {}) as Record<string, string>;
    const request: FakeRequest = {
      method,
      path,
      query: url.searchParams,
      body: init?.body ? JSON.parse(init.body as string) : undefined,
      token: headers.Authorization?.replace('Bearer ', '') ?? null,
    };
    requests.push(request);

    const key = Object.keys(table)
      .reverse()
      .find((pattern) => matchRoute(pattern, method, path));
    const route = key ? table[key] : undefined;
    const { status, body } = key
      ? toResponse(typeof route === 'function' ? (route as (r: FakeRequest) => unknown)(request) : route)
      : { status: 404, body: { error: `No fake route for ${method} ${path}` } };

    return {
      ok: status >= 200 && status < 300,
      status,
      text: async () => (body === undefined ? '' : JSON.stringify(body)),
    } as Response;
  });

  return {
    fetch: fetchImpl as unknown as typeof fetch,
    requests,
    /** Requests matching a route pattern, e.g. "POST /cart/items" */
    calls: (pattern: string) => requests.filter((request) => matchRoute(pattern, request.method, request.path)),
    set: (pattern: string, route: Route) => {
      table[pattern] = route;
    },
  };
}

export type FakeApi = ReturnType<typeof createFakeApi>;
