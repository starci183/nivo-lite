import type { ActionKey, ModuleCategoryKey, ModuleKey } from "./catalog.keys"

/** A text in both product languages. */
export type Bilingual = { readonly vi: string; readonly en: string }
/** A list of texts in both product languages. */
export type BilingualList = { readonly vi: ReadonlyArray<string>; readonly en: ReadonlyArray<string> }
/** Whether a module is production ready or early access. */
export type ModuleStatus = "stable" | "early"
/** Who a module's agent talks to. */
export type ModuleAudience = "customer" | "internal"
/** What a setup answer writes to the Second Brain or to the authority rules. */
export type GateWrite =
    | {
          readonly kind: "fact"
          readonly subjectType:
              "business" | "product" | "service" | "policy" | "customer" | "person" | "supplier" | "place" | "other"
          readonly attributeLabel: string
          readonly scope: "public" | "internal" | "restricted"
      }
    | { readonly kind: "rule"; readonly action: ActionKey; readonly field: "mode" | "limit_vnd" }
/** One setup gate of a module. */
export type RegistryGate = {
    readonly key: string
    readonly label_vi: string
    readonly label_en: string
    readonly hint_vi: string
    readonly hint_en: string
    readonly writes?: ReadonlyArray<GateWrite>
}
/** One authority action of a module. */
export type RegistryAction = {
    readonly action: ActionKey
    readonly label: Bilingual
    readonly mode: "auto" | "ask" | "never"
    readonly limitVnd: number | null
    readonly requiredFields: ReadonlyArray<string>
    readonly amountLimit: boolean
    readonly maxMode: "ask" | "never" | null
    readonly note: string
    readonly next: ReadonlyArray<ActionKey>
}
/** One command a module accepts from other agents. */
export type RegistryCommand = {
    readonly command: string
    readonly action: ActionKey
    readonly subjectType: string
    readonly requiredFields: ReadonlyArray<string>
    readonly description: Bilingual
}
/** One module of the catalogue. */
export type ModuleDef = {
    readonly key: ModuleKey
    readonly order: number
    readonly name: Bilingual
    readonly shortName: Bilingual
    readonly description: Bilingual
    readonly points: BilingualList
    readonly purpose: string
    readonly icon: string
    readonly glyph: string
    readonly mascot: string
    readonly category: ModuleCategoryKey
    readonly status: ModuleStatus
    readonly audience: ModuleAudience
    readonly includedWithWorkspace: boolean
    readonly available: boolean
    readonly knowledgeFolder: string
    readonly workbench: string | null
    readonly settingsExtras: string | null
    readonly requires: { readonly capabilities: ReadonlyArray<string>; readonly connections: ReadonlyArray<string> }
    readonly connectionProviders: ReadonlyArray<string>
    readonly defaultOperatingMode: "assist" | "autopilot"
    /** Several installations (instances) of this type may exist in one workspace. */
    readonly multiInstance: boolean
    readonly agent: {
        readonly name: string
        readonly handle: string
        readonly summary: Bilingual
        readonly capabilities: BilingualList
        readonly role: Bilingual
        readonly instructions: Bilingual
    }
    readonly gates: ReadonlyArray<RegistryGate>
    readonly authorityActions: ReadonlyArray<RegistryAction>
    /** The command contract: what other agents may ask this module to do. */
    readonly accepts: ReadonlyArray<RegistryCommand>
}
/** One category of the catalogue. */
export type ModuleCategory = { readonly key: ModuleCategoryKey; readonly label: Bilingual }
