/**
 * Applied only to the packaged Electron binary in scripts/after-pack.js.
 * The unpackaged `electron` binary used by `npm run dev` is left alone.
 *
 * EnableEmbeddedAsarIntegrityValidation stays false: electron-builder does not
 * embed an ASAR integrity hash, and the fuse would refuse to launch.
 * LoadBrowserProcessSpecificV8Snapshot stays false: there is no custom snapshot.
 * macOS hardened runtime stays false in electron-builder.yml until CSC_LINK is set.
 */
export const PACKAGED_FUSES = {
  runAsNode: false,
  enableCookieEncryption: true,
  enableNodeOptionsEnvironmentVariable: false,
  enableNodeCliInspectArguments: false,
  enableEmbeddedAsarIntegrityValidation: false,
  onlyLoadAppFromAsar: true,
  loadBrowserProcessSpecificV8Snapshot: false,
  grantFileProtocolExtraPrivileges: false,
} as const;
