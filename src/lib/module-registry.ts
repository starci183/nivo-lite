/**
 * The module registry, typed access. The data comes from resources/modules/<key>/module.json through the build-time generator
 * (scripts/gen-module-registry.mjs -> module-registry.generated.ts), so client and server read the same constants and nothing reads
 * the file system at runtime. Pure: safe in client components. Every hard-coded "chatbot | sales | accounting" check goes through here.
 */
import type { Locale } from "@/i18n/core";
import {
  ACTION_KEYS, MODULE_CATEGORIES, MODULE_KEYS, MODULE_REGISTRY,
  type ActionKey, type Bilingual, type ModuleCategory, type ModuleCategoryKey, type ModuleDef, type ModuleKey, type RegistryAction, type RegistryGate,
} from "./module-registry.generated";

export { ACTION_KEYS, MODULE_CATEGORIES, MODULE_KEYS, MODULE_REGISTRY };
export type { ActionKey, Bilingual, ModuleCategory, ModuleCategoryKey, ModuleDef, ModuleKey, RegistryAction, RegistryGate };

export const isModuleKey = (value: string | undefined | null): value is ModuleKey =>
  typeof value === "string" && Object.prototype.hasOwnProperty.call(MODULE_REGISTRY, value);
export const isActionKey = (value: string | undefined | null): value is ActionKey => typeof value === "string" && (ACTION_KEYS as ReadonlyArray<string>).includes(value);

/** The definition of a module; throws for a key that is not in the registry (use isModuleKey first on user input). */
export const moduleDef = (key: ModuleKey): ModuleDef => MODULE_REGISTRY[key];
/** Every module in display order. */
export const listModules = (): ReadonlyArray<ModuleDef> => MODULE_KEYS.map((k) => MODULE_REGISTRY[k]);

export const pick = (value: Bilingual, locale: Locale): string => (locale === "en" ? value.en : value.vi);
export const pickList = (value: { readonly vi: ReadonlyArray<string>; readonly en: ReadonlyArray<string> }, locale: Locale): ReadonlyArray<string> => (locale === "en" ? value.en : value.vi);

/** The module's full name ("Bán hàng"). */
export const moduleName = (key: ModuleKey, locale: Locale): string => pick(MODULE_REGISTRY[key].name, locale);
/** The module's short department name ("Sales AI"), used in the authority matrix and activity lines. */
export const moduleShortName = (key: ModuleKey, locale: Locale): string => pick(MODULE_REGISTRY[key].shortName, locale);

/** Modules grouped by category, in category order; empty categories are left out. */
export const modulesByCategory = (): ReadonlyArray<{ readonly category: ModuleCategory; readonly modules: ReadonlyArray<ModuleDef> }> =>
  MODULE_CATEGORIES.map((category) => ({ category, modules: listModules().filter((m) => m.category === category.key) })).filter((g) => g.modules.length > 0);

/** Which module owns each authority action (its department). */
export const ACTION_MODULE: Readonly<Record<ActionKey, ModuleKey>> = Object.fromEntries(
  listModules().flatMap((m) => m.authorityActions.map((a) => [a.action, m.key] as const)),
) as Record<ActionKey, ModuleKey>;
export const actionDef = (action: ActionKey): RegistryAction => {
  const found = MODULE_REGISTRY[ACTION_MODULE[action]].authorityActions.find((a) => a.action === action);
  if (!found) throw new Error(`unknown action ${action}`);
  return found;
};

/** Modules whose agent talks to customers: only public knowledge may reach their OpenClaw workspace. */
export const audienceOf = (key: ModuleKey): "customer" | "internal" => MODULE_REGISTRY[key].audience;
