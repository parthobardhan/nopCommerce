"use strict";

const path = require("node:path");
const { flipFuses, FuseVersion, FuseV1Options } = require("@electron/fuses");
const { PACKAGED_FUSES } = require("../dist/packaged-fuses.js");

function electronBinary(context) {
  const platform = context.electronPlatformName;
  if (platform === "darwin" || platform === "mas") {
    const name = context.packager.appInfo.productFilename;
    return path.join(context.appOutDir, `${name}.app`, "Contents", "MacOS", name);
  }
  if (platform === "win32") {
    return path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.exe`);
  }
  return path.join(context.appOutDir, context.packager.executableName);
}

exports.default = async function afterPack(context) {
  const binary = electronBinary(context);
  await flipFuses(binary, {
    version: FuseVersion.V1,
    resetAdHocDarwinSignature: context.electronPlatformName === "darwin",
    [FuseV1Options.RunAsNode]: PACKAGED_FUSES.runAsNode,
    [FuseV1Options.EnableCookieEncryption]: PACKAGED_FUSES.enableCookieEncryption,
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: PACKAGED_FUSES.enableNodeOptionsEnvironmentVariable,
    [FuseV1Options.EnableNodeCliInspectArguments]: PACKAGED_FUSES.enableNodeCliInspectArguments,
    [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: PACKAGED_FUSES.enableEmbeddedAsarIntegrityValidation,
    [FuseV1Options.OnlyLoadAppFromAsar]: PACKAGED_FUSES.onlyLoadAppFromAsar,
    [FuseV1Options.LoadBrowserProcessSpecificV8Snapshot]: PACKAGED_FUSES.loadBrowserProcessSpecificV8Snapshot,
    [FuseV1Options.GrantFileProtocolExtraPrivileges]: PACKAGED_FUSES.grantFileProtocolExtraPrivileges,
  });
  console.log(`Flipped Electron fuses on ${binary}`);
};
