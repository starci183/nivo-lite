import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve as pathResolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = pathResolve(dirname(fileURLToPath(import.meta.url)), "..");
const EXT = [".ts", ".tsx", ".mjs", ".js", ".json"];
const tryFile = (base) => {
  if (existsSync(base) && statSync(base).isFile()) return base;
  for (const e of EXT) if (existsSync(base + e)) return base + e;
  for (const e of [".ts", ".tsx"]) if (existsSync(pathResolve(base, "index" + e))) return pathResolve(base, "index" + e);
  return null;
};

export async function resolve(specifier, context, next) {
  if (specifier === "server-only") return { url: "data:text/javascript,export {}", shortCircuit: true };
  if (specifier.startsWith("next/")) {
    const f = tryFile(pathResolve(root, "node_modules", specifier));
    if (f) return { url: pathToFileURL(f).href, shortCircuit: true, ...(f.endsWith(".ts") ? { format: "module-typescript" } : {}) };
  }
  if (specifier.startsWith("@/")) {
    const f = tryFile(pathResolve(root, "src", specifier.slice(2)));
    if (f) return { url: pathToFileURL(f).href, shortCircuit: true, ...(f.endsWith(".ts") ? { format: "module-typescript" } : {}) };
  }
  if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.startsWith("file:")) {
    const f = tryFile(pathResolve(dirname(fileURLToPath(context.parentURL)), specifier));
    if (f) return { url: pathToFileURL(f).href, shortCircuit: true, ...(f.endsWith(".ts") ? { format: "module-typescript" } : {}) };
  }
  return next(specifier, context);
}

export async function load(url, context, next) {
  if (url.endsWith(".json") && url.startsWith("file:")) {
    return { format: "module", source: `export default ${readFileSync(fileURLToPath(url), "utf8")}`, shortCircuit: true };
  }
  if (process.env.TS_LOADER_TRACE) (await import("node:fs")).appendFileSync("loader-trace.txt", `${url} ${context.format}
`);
  return next(url, context);
}
