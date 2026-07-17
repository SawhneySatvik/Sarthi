import { existsSync, readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, extname, relative, resolve, sep } from "node:path";
import ts from "typescript";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "..");
const sourceExtensions = new Set([".ts", ".tsx"]);

function collectSourceFiles(directory) {
  if (!existsSync(directory)) {
    return [];
  }

  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      return collectSourceFiles(entryPath);
    }
    return entry.isFile() && sourceExtensions.has(extname(entry.name)) ? [entryPath] : [];
  });
}

function sourceScriptKind(sourceFile) {
  return extname(sourceFile) === ".tsx" ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
}

function stringSpecifier(node) {
  if (!node) {
    return null;
  }

  if (ts.isLiteralTypeNode(node)) {
    return ts.isStringLiteralLike(node.literal) ? node.literal.text : null;
  }

  return ts.isStringLiteralLike(node) ? node.text : null;
}

function collectSpecifiers(sourceFile, source) {
  const parsed = ts.createSourceFile(sourceFile, source, ts.ScriptTarget.Latest, true, sourceScriptKind(sourceFile));
  const specifiers = [];
  const addSpecifier = (node) => {
    const specifier = stringSpecifier(node);
    if (specifier !== null) {
      specifiers.push(specifier);
    }
  };

  const visit = (node) => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      addSpecifier(node.moduleSpecifier);
    } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
      addSpecifier(node.moduleReference.expression);
    } else if (ts.isImportTypeNode(node)) {
      addSpecifier(node.argument);
    } else if (ts.isCallExpression(node)) {
      const isDynamicImport = node.expression.kind === ts.SyntaxKind.ImportKeyword;
      const isRequireCall = ts.isIdentifier(node.expression) && node.expression.text === "require";
      if (isDynamicImport || isRequireCall) {
        addSpecifier(node.arguments[0]);
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(parsed);
  return specifiers;
}

function resolvesUnderProviders(specifier, sourceFile, root) {
  if (specifier === "providers" || specifier.startsWith("providers/")) {
    return true;
  }
  if (specifier === "@/providers" || specifier.startsWith("@/providers/")) {
    return true;
  }

  let resolvedImport;
  if (specifier.startsWith("@/")) {
    resolvedImport = resolve(root, specifier.slice(2));
  } else if (specifier.startsWith(".")) {
    resolvedImport = resolve(dirname(sourceFile), specifier);
  } else {
    return false;
  }

  const providersDirectory = resolve(root, "providers");
  return resolvedImport === providersDirectory || resolvedImport.startsWith(`${providersDirectory}${sep}`);
}

function boundaryRule(specifier, sourceFile, root) {
  if (specifier === "next" || specifier.startsWith("next/")) {
    return "core may not import Next.js";
  }
  if (specifier === "react" || specifier.startsWith("react/")) {
    return "core may not import React";
  }
  if (specifier === "drizzle-orm" || specifier.startsWith("drizzle-orm/")) {
    return "core may not import Drizzle";
  }
  if (specifier.startsWith("@supabase/")) {
    return "core may not import Supabase";
  }
  if (specifier.startsWith("@ai-sdk/")) {
    return "core may not import a concrete AI SDK provider";
  }
  if (resolvesUnderProviders(specifier, sourceFile, root)) {
    return "core may not import concrete providers";
  }
  return null;
}

export function scanCoreBoundary(root = repositoryRoot) {
  const coreDirectory = resolve(root, "core");
  const violations = [];

  for (const sourceFile of collectSourceFiles(coreDirectory)) {
    const source = readFileSync(sourceFile, "utf8");
    for (const specifier of collectSpecifiers(sourceFile, source)) {
      const rule = boundaryRule(specifier, sourceFile, root);
      if (rule) {
        violations.push({
          file: relative(root, sourceFile),
          specifier,
          rule,
        });
      }
    }
  }

  return violations;
}

function report(violations) {
  for (const violation of violations) {
    console.error(`${violation.file}: ${violation.specifier} — ${violation.rule}`);
  }
}

const invokedAsScript = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedAsScript) {
  const violations = scanCoreBoundary();
  if (violations.length > 0) {
    report(violations);
    process.exitCode = 1;
  } else {
    console.log("check:core-boundary: clean.");
  }
}
