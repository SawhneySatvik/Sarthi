const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "..");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(projectRoot);

// Root watch coverage is required because the shared framework-clean core lives
// beside—not inside—the Expo project. Babel rewrites aliases to relative imports;
// this Metro map is a matching resolver contract for tools that retain an alias.
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.join(projectRoot, "node_modules"),
  path.join(workspaceRoot, "node_modules"),
];
// The shared root is source (not a published package with an exports map), so
// classic extension resolution is required for its typed subpaths.
config.resolver.unstable_enablePackageExports = false;
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules ?? {}),
  "@mobile": path.join(projectRoot, "src"),
  "@core": path.join(workspaceRoot, "core"),
  "@schema": path.join(workspaceRoot, "data", "schema"),
  "@contracts": path.join(workspaceRoot, "core", "contracts"),
  "@providers": path.join(workspaceRoot, "providers"),
  "sarthi-shared": workspaceRoot,
  "node:crypto": path.join(projectRoot, "src", "shims", "node-crypto.ts"),
};

module.exports = config;
