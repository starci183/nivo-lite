// Tiny Node loader so verification scripts can import the app's own TypeScript (src/lib/*, "@/..." aliases, extensionless imports, JSON, `server-only`).
// Usage: node --import ./scripts/ts-loader.mjs scripts/<script>.ts   (Node >= 23.6 strips the types itself).
import { register } from "node:module";
register("./ts-loader-hooks.mjs", import.meta.url);
