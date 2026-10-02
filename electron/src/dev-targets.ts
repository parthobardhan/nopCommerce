import { DEFAULT_STORE_URL } from "./store-url";

/**
 * `Properties/launchSettings.json` is gitignored, so `dotnet run` has no
 * repo-owned port. Kestrel's default without that file or ASPNETCORE_URLS
 * is http://localhost:5000. Docker publishes 80 (see DEFAULT_STORE_URL).
 */
export const DOTNET_STORE_URL = "http://localhost:5000";

export const DEV_TARGETS = {
  docker: DEFAULT_STORE_URL,
  dotnet: DOTNET_STORE_URL,
} as const;

export type DevTargetName = keyof typeof DEV_TARGETS;
