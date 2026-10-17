import type { ModuleIconName } from "@/modules/types"
import type { ModulesCatalogQuery } from "@/modules/api"
import type { ActionKey, ModuleCategoryKey, ModuleKey } from "./catalog.keys"

/** The copy of a known module, read from the backend catalogue operation. */
export type ModuleCopy = Omit<ModulesCatalogQuery["modulesCatalog"]["modules"][number], "key"> & {
    readonly key: ModuleKey
}
/** A setup gate with its backend-owned display copy. */
export type RegistryGate = ModuleCopy["gates"][number]
/** A text in both product languages. */
export type Bilingual = { readonly vi: string; readonly en: string }
/** A list of texts in both product languages. */
export type BilingualList = { readonly vi: ReadonlyArray<string>; readonly en: ReadonlyArray<string> }
/** The frontend behavior of an authority action. */
export type RegistryAction = {
    readonly action: ActionKey
    readonly mode: "auto" | "ask" | "never"
    readonly limitVnd: number | null
    readonly requiredFields: ReadonlyArray<string>
    readonly amountLimit: boolean
    readonly maxMode: "ask" | "never" | null
    readonly next: ReadonlyArray<ActionKey>
}
/** The command keys accepted by a module. */
export type RegistryCommand = {
    readonly command: string
    readonly action: ActionKey
    readonly subjectType: string
    readonly requiredFields: ReadonlyArray<string>
}
/** Frontend routing, visuals and behavior; display copy comes from GraphQL. */
export type ModuleDef = {
    readonly key: ModuleKey
    readonly order: number
    readonly icon: string
    readonly glyph: ModuleIconName
    readonly mascot: string
    readonly category: ModuleCategoryKey
    readonly status: "stable" | "early"
    readonly audience: "customer" | "internal"
    readonly includedWithWorkspace: boolean
    readonly available: boolean
    readonly knowledgeFolder: string
    readonly workbench: string | null
    readonly settingsExtras: string | null
    readonly requires: { readonly capabilities: ReadonlyArray<string>; readonly connections: ReadonlyArray<string> }
    readonly connectionProviders: ReadonlyArray<string>
    readonly defaultOperatingMode: "assist" | "autopilot"
    readonly multiInstance: boolean
    readonly gates: ReadonlyArray<{ readonly key: string }>
    readonly authorityActions: ReadonlyArray<RegistryAction>
    readonly accepts: ReadonlyArray<RegistryCommand>
}
