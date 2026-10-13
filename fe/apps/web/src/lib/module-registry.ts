/**
 * The module registry, typed access. The data is the catalogue mirror in modules/catalog (the typed catalogue of the back end is the
 * source, served by GET /modules), so client and server read the same constants and nothing reads the file system at runtime.
 * Pure: safe in client components. Every hard-coded "chatbot | sales | accounting" check goes through here.
 */
import type { Locale } from "@/i18n/core"
import {
    ACTION_KEYS,
    ACTION_MODULE,
    MODULE_CATEGORIES,
    MODULE_KEYS,
    MODULE_REGISTRY,
    actionDef,
    isActionKey,
    isModuleKey,
    type ActionKey,
    type Bilingual,
    type ModuleCategory,
    type ModuleCategoryKey,
    type ModuleDef,
    type ModuleKey,
    type RegistryAction,
    type RegistryCommand,
    type RegistryGate,
} from "@/modules/catalog"

export {
    ACTION_KEYS,
    ACTION_MODULE,
    MODULE_CATEGORIES,
    MODULE_KEYS,
    MODULE_REGISTRY,
    actionDef,
    isActionKey,
    isModuleKey,
}
export type {
    ActionKey,
    Bilingual,
    ModuleCategory,
    ModuleCategoryKey,
    ModuleDef,
    ModuleKey,
    RegistryAction,
    RegistryCommand,
    RegistryGate,
}

/** The definition of a module; throws for a key that is not in the registry (use isModuleKey first on user input). */
export const moduleDef = (key: ModuleKey): ModuleDef => MODULE_REGISTRY[key]
/** Every module in display order. */
export const listModules = (): ReadonlyArray<ModuleDef> => MODULE_KEYS.map((k) => MODULE_REGISTRY[k])

export const pick = (value: Bilingual, locale: Locale): string => (locale === "en" ? value.en : value.vi)
export const pickList = (
    value: { readonly vi: ReadonlyArray<string>; readonly en: ReadonlyArray<string> },
    locale: Locale,
): ReadonlyArray<string> => (locale === "en" ? value.en : value.vi)

/** The module's full name ("Bán hàng"). */
export const moduleName = (key: ModuleKey, locale: Locale): string => pick(MODULE_REGISTRY[key].name, locale)
/** The module's short department name ("Sales AI"), used in the authority matrix and activity lines. */
export const moduleShortName = (key: ModuleKey, locale: Locale): string => pick(MODULE_REGISTRY[key].shortName, locale)

/** Modules grouped by category, in category order; empty categories are left out. */
export const modulesByCategory = (): ReadonlyArray<{
    readonly category: ModuleCategory
    readonly modules: ReadonlyArray<ModuleDef>
}> =>
    MODULE_CATEGORIES.map((category) => ({
        category,
        modules: listModules().filter((m) => m.category === category.key),
    })).filter((g) => g.modules.length > 0)

/** Modules whose agent talks to customers: only public knowledge may reach their OpenClaw workspace. */
export const audienceOf = (key: ModuleKey): "customer" | "internal" => MODULE_REGISTRY[key].audience

/** The commands a module accepts from other agents (its declared contract in module.json `accepts`). */
export const acceptsOf = (key: ModuleKey): ReadonlyArray<RegistryCommand> => MODULE_REGISTRY[key].accepts
/** One accepted command of a module, or null when the module does not accept it. */
export const commandOf = (key: ModuleKey, command: string): RegistryCommand | null =>
    MODULE_REGISTRY[key].accepts.find((a) => a.command === command) ?? null

/**
 * Whether a workspace may install several agents of this type (module.json "multi_instance"): customer-facing types such as one Chatbot per
 * branch or Fanpage, one Booking agent per branch, one Lead-gen agent per page. Back-office types stay one per workspace (single ledger).
 */
export const isMultiInstance = (key: ModuleKey): boolean => MODULE_REGISTRY[key].multiInstance
