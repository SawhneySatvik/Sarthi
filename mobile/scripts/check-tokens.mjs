import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const checkedPaths = [
  path.join(projectRoot, "src", "app", "_layout.tsx"),
  path.join(projectRoot, "src", "app", "index.tsx"),
  path.join(projectRoot, "src", "components", "primitives"),
  path.join(projectRoot, "src", "features"),
];
const sourceExtensions = new Set([".ts", ".tsx"]);
const colorLiteral = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?)\s*\(/i;
const rawVisualProperty = /\b(?:fontSize|lineHeight|letterSpacing|border(?:Top|Right|Bottom|Left)?(?:Width|Radius)|borderRadius|padding(?:Top|Right|Bottom|Left|Horizontal|Vertical)?|margin(?:Top|Right|Bottom|Left|Horizontal|Vertical)?|gap|rowGap|columnGap|minHeight|maxHeight|minWidth|maxWidth|width|height|shadow(?:Radius|Opacity)|elevation|duration)\s*:\s*-?\d+(?:\.\d+)?\b/g;

function collectFiles(entryPath) {
  if (!fs.existsSync(entryPath)) return [];
  if (!fs.statSync(entryPath).isDirectory()) return sourceExtensions.has(path.extname(entryPath)) ? [entryPath] : [];
  return fs.readdirSync(entryPath, { withFileTypes: true }).flatMap((entry) => collectFiles(path.join(entryPath, entry.name)));
}

const violations = [];
for (const filePath of checkedPaths.flatMap(collectFiles)) {
  const source = fs.readFileSync(filePath, "utf8");
  const relativePath = path.relative(projectRoot, filePath);

  if (colorLiteral.test(source)) violations.push(`${relativePath}: raw color literal`);
  for (const match of source.matchAll(rawVisualProperty)) {
    violations.push(`${relativePath}: raw visual literal (${match[0]})`);
  }
}

const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, "package.json"), "utf8"));
if (packageJson.dependencies?.["expo-av"] || packageJson.devDependencies?.["expo-av"]) {
  violations.push("package.json: expo-av is forbidden; use expo-audio for native audio");
}

if (violations.length > 0) {
  console.error("Sarthi native token check failed:\n" + violations.map((violation) => `- ${violation}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log("Sarthi native token check passed.");
}
