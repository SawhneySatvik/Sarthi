const fs = require("node:fs");
const path = require("node:path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "..");
const mobileSourceRoot = path.join(projectRoot, "src");
const cryptoShim = path.join(mobileSourceRoot, "shims", "node-crypto");

function relativeImport(fromFile, absoluteTarget) {
  const relativeTarget = path.relative(path.dirname(fromFile), absoluteTarget).replaceAll(path.sep, "/");
  return relativeTarget.startsWith(".") ? relativeTarget : `./${relativeTarget}`;
}

function sharedImport(relativePath) {
  const candidates = [
    `${relativePath}.ios.ts`,
    `${relativePath}.native.ts`,
    `${relativePath}.ts`,
    `${relativePath}.tsx`,
    `${relativePath}/index.ts`,
    `${relativePath}/index.tsx`,
  ];
  const resolved = candidates.find((candidate) => fs.existsSync(path.join(workspaceRoot, candidate)));
  return `sarthi-shared/${resolved ?? relativePath}`;
}

function resolveSarthiAlias(moduleName, fromFile) {
  if (moduleName === "node:crypto") return relativeImport(fromFile, cryptoShim);

  if (moduleName === "@mobile") return relativeImport(fromFile, mobileSourceRoot);
  if (moduleName.startsWith("@mobile/")) return relativeImport(fromFile, path.join(mobileSourceRoot, moduleName.slice("@mobile/".length)));

  const sharedAliases = [
    ["@core", "core"],
    ["@schema", "data/schema"],
    ["@contracts", "core/contracts"],
    ["@providers", "providers"],
  ];

  for (const [alias, sharedPath] of sharedAliases) {
    if (moduleName === alias) return sharedImport(sharedPath);
    if (moduleName.startsWith(`${alias}/`)) return sharedImport(`${sharedPath}/${moduleName.slice(alias.length + 1)}`);
  }

  if (!moduleName.startsWith("@/")) return undefined;

  const sourceIsNative = fromFile.startsWith(`${mobileSourceRoot}${path.sep}`);
  const suffix = moduleName.slice(2);
  if (sourceIsNative && suffix.startsWith("assets/")) {
    return relativeImport(fromFile, path.join(projectRoot, suffix));
  }
  return sourceIsNative ? relativeImport(fromFile, path.join(mobileSourceRoot, suffix)) : sharedImport(suffix);
}

function sarthiAliasPlugin() {
  function rewriteModuleSource(pathNode, state) {
    const filename = state.file.opts.filename;
    const nextModuleName = resolveSarthiAlias(pathNode.node.value, filename);
    if (nextModuleName) pathNode.node.value = nextModuleName;
  }

  return {
    name: "sarthi-native-aliases",
    visitor: {
      ImportDeclaration(pathNode, state) {
        rewriteModuleSource(pathNode.get("source"), state);
      },
      ExportNamedDeclaration(pathNode, state) {
        if (pathNode.node.source) rewriteModuleSource(pathNode.get("source"), state);
      },
      ExportAllDeclaration(pathNode, state) {
        rewriteModuleSource(pathNode.get("source"), state);
      },
      CallExpression(pathNode, state) {
        const [argument] = pathNode.get("arguments");
        if (!pathNode.get("callee").isIdentifier({ name: "require" }) || !argument?.isStringLiteral()) return;
        const nextModuleName = resolveSarthiAlias(argument.node.value, state.file.opts.filename);
        if (nextModuleName) argument.replaceWithSourceString(JSON.stringify(nextModuleName));
      },
    },
  };
}

/**
 * Rewrites shared and native aliases to relative imports before Metro resolves
 * them. Unlike an absolute module-resolver target, this keeps workspace files in
 * Metro's dependency graph and its cold-start SHA cache.
 */
module.exports = function babelConfig(api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [sarthiAliasPlugin],
  };
};
