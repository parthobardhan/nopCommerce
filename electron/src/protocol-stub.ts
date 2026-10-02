import { DEEP_LINK_PROTOCOL } from "./deep-link";

export type ProtocolClientInvocation = {
  protocol: string;
  execPath?: string;
  args?: string[];
};

export function findDeepLink(argv: readonly string[]): string | undefined {
  return argv.find((arg) => arg.startsWith(`${DEEP_LINK_PROTOCOL}:`));
}

/**
 * Unpackaged `electron .` must register the electron binary plus the app path.
 * A packaged build registers its own executable. OS registration from an
 * unpackaged process often returns false; handling an already-delivered URL
 * does not depend on that call succeeding.
 */
export function protocolClientInvocation(options: {
  isDefaultApp: boolean;
  execPath: string;
  argv: readonly string[];
}): ProtocolClientInvocation {
  if (options.isDefaultApp && options.argv.length >= 2) {
    return {
      protocol: DEEP_LINK_PROTOCOL,
      execPath: options.execPath,
      args: [options.argv[1]],
    };
  }
  return { protocol: DEEP_LINK_PROTOCOL };
}
