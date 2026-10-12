import { listModules, type ModuleKey } from "./module-registry";
/** Client-safe: which connection providers each module can use (see PURPOSE in connection-actions for what each means). */
export const MODULE_PROVIDERS: Readonly<Record<ModuleKey, ReadonlyArray<string>>> = Object.fromEntries(
  listModules().map((m) => [m.key, m.connectionProviders]),
) as Record<ModuleKey, ReadonlyArray<string>>;
