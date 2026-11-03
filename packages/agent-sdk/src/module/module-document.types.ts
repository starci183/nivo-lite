import type { DataRight } from "../rights/rights.types"
import type { Namespaced, SpecText } from "../schema/schema.types"
import type { SpecDocument } from "../spec/spec.types"
import type {
    Bilingual,
    BilingualList,
    ModuleAudience,
    ModuleAuthorityMode,
    ModuleGateWrite,
    ModuleTemplateAgent,
    ModuleTemplateCommand,
    ModuleTemplateRequirements,
    ModuleTemplateTrigger,
} from "./module.types"

/** The schema id of a module document. */
export type ModuleDocumentSchemaId = "nivo/module@1"

/** The catalogue entry of a module: what the catalogue shows before it is installed. */
export interface ModuleManifest {
    readonly order: number
    readonly name: Bilingual
    readonly shortName: Bilingual
    readonly description: Bilingual
    readonly points: BilingualList
    readonly purpose: string
    readonly icon: string
    readonly glyph: string
    readonly mascot: string
    readonly category: string
    readonly status: "stable" | "early"
    readonly audience: ModuleAudience
    readonly includedWithWorkspace: boolean
    readonly available: boolean
    readonly knowledgeFolder: string
    readonly settingsExtras: string | null
    readonly requires: ModuleTemplateRequirements
    readonly connectionProviders: ReadonlyArray<string>
    readonly defaultOperatingMode: "assist" | "autopilot"
    readonly multiInstance: boolean
}

/** One thing a module must know before it may act. */
export interface ModuleDocumentGate {
    readonly key: string
    readonly label: Bilingual
    readonly hint: Bilingual
    readonly writes?: ReadonlyArray<ModuleGateWrite> | undefined
}

/** One action the authority matrix governs. */
export interface ModuleDocumentAction {
    readonly action: string
    readonly label: Bilingual
    readonly mode: ModuleAuthorityMode
    readonly limitVnd: number | null
    readonly requiredFields: ReadonlyArray<string>
    readonly amountLimit: boolean
    readonly graphFacts?: ReadonlyArray<string> | undefined
    readonly maxMode: "ask" | "never" | null
    readonly note: Bilingual
    readonly next: ReadonlyArray<string>
}

/** What an install seeds: the agent, its gates, actions, commands, triggers and its data rights. */
export interface ModuleAgentTemplate {
    readonly agent: ModuleTemplateAgent
    readonly gates: ReadonlyArray<ModuleDocumentGate>
    readonly authorityActions: ReadonlyArray<ModuleDocumentAction>
    readonly accepts: ReadonlyArray<ModuleTemplateCommand>
    readonly triggers: ReadonlyArray<ModuleTemplateTrigger>
    /** The grant an agent of this type is seeded with: default deny, never a wildcard field. */
    readonly rights: ReadonlyArray<DataRight>
}

/** A limit a prompt carries. */
export interface LimitSpec {
    readonly text: SpecText
    readonly member?: string | undefined
    readonly trusts?: ReadonlyArray<"outsider" | "member" | "manager" | "system"> | undefined
}

/** A bounded JSON Schema subset: every string has maxLength, every array maxItems, every number bounds. */
export type MemberSpec =
    | {
          readonly type: "string"
          readonly maxLength: number
          readonly enum?: ReadonlyArray<string> | undefined
          readonly nullable?: boolean | undefined
      }
    | {
          readonly type: "integer" | "number"
          readonly minimum: number
          readonly maximum: number
          readonly nullable?: boolean | undefined
      }
    | { readonly type: "boolean" }
    | {
          readonly type: "array"
          readonly items: MemberSpec
          readonly minItems?: number | undefined
          readonly maxItems: number
      }
    | {
          readonly type: "object"
          readonly properties: Readonly<Record<string, MemberSpec>>
          readonly required: ReadonlyArray<string>
          readonly nullable?: boolean | undefined
      }

/** A yes/no question the model answers on every turn. */
export interface SignalSpec {
    readonly key: string
    readonly question: SpecText
    readonly requires?: { readonly intent: string; readonly member: string } | undefined
}

/** A claim a reply may make only when an effect of the required kind was recorded in the turn. */
export interface ClaimSpec {
    readonly requires: Namespaced
    readonly phrases: { readonly vi: ReadonlyArray<string>; readonly en: ReadonlyArray<string> }
    readonly line?: SpecText | undefined
}

/** A catalogue fact a condition looks for. */
export interface FactRef {
    readonly subjectType: string
    readonly attributeLabel: string
}

/** What decides an outcome rule. */
export type OutcomeCondition =
    | { readonly signal: string }
    | { readonly missing: string }
    | { readonly check: string }
    | { readonly fact: FactRef }
    | { readonly all: ReadonlyArray<OutcomeCondition> }

/** What the engine does with a reading. */
export type OutcomeSpec = "act" | "reask_then_person" | "person" | "decline" | { readonly pending: string }

/** Ordered rules; the first whose `when` holds decides. */
export interface OutcomeRulesSpec {
    readonly rules: ReadonlyArray<{ readonly when: OutcomeCondition; readonly then: OutcomeSpec }>
    readonly otherwise: OutcomeSpec
}

/** The authoring form of one intent frame. */
export interface IntentSpec {
    readonly intent: string
    readonly triggers: ReadonlyArray<string>
    readonly answers: boolean
    readonly ownTurn: boolean
    readonly task: SpecText
    readonly limits: ReadonlyArray<string>
    readonly result: Namespaced
    readonly owns: ReadonlyArray<string>
    readonly required: ReadonlyArray<{ readonly member: string; readonly ask: SpecText }>
    readonly checks: ReadonlyArray<{
        readonly id: Namespaced
        readonly params?: Readonly<Record<string, string | number | boolean>> | undefined
    }>
    readonly claims: ReadonlyArray<string>
    readonly outcome: string | null
    readonly policy: Namespaced | null
}

/** Per-intent frames, members, signals, effects, claims and turn outcomes. */
export interface ModuleContracts {
    readonly limits: Readonly<Record<string, LimitSpec>>
    readonly members: Readonly<Record<string, MemberSpec>>
    readonly signals: ReadonlyArray<SignalSpec>
    readonly effects: ReadonlyArray<Namespaced>
    readonly claims: Readonly<Record<string, ClaimSpec>>
    readonly outcomes: Readonly<Record<string, OutcomeRulesSpec>>
    readonly intents: ReadonlyArray<IntentSpec>
}

/** One module version as a file and as a stored row: data only, never code. */
export interface ModuleDocument {
    readonly schema: ModuleDocumentSchemaId
    /** `/^[a-z][a-z0-9_]{1,23}$/`. */
    readonly key: string
    /** An integer of at least 1, strictly increasing per key. */
    readonly version: number
    /** At most 600 characters, shown on the update offer. */
    readonly changelog: string
    /** True: the owner must read the version before taking it. */
    readonly breaking: boolean
    readonly manifest: ModuleManifest
    readonly template: ModuleAgentTemplate
    readonly contracts: ModuleContracts
    /** Default specs by route; `main` is required. */
    readonly workbenches: Readonly<Record<string, SpecDocument>>
}

/** The codes a module document is refused with. */
export type ModuleProblemCode =
    | "MODULE_KEY_MALFORMED"
    | "MODULE_VERSION_INVALID"
    | "MODULE_CHANGELOG_TOO_LONG"
    | "MODULE_TEXT_LANGUAGE_MISSING"
    | "MODULE_WORKBENCH_MAIN_MISSING"
    | "MODULE_WORKBENCH_FOREIGN"
    | "MODULE_ACTION_DUPLICATE"
    | "MODULE_COMMAND_UNKNOWN_ACTION"
    | "MODULE_INTENT_UNKNOWN_ACTION"
    | "MODULE_SPEC_PROBLEM"

/** Why a module document was refused, and where. */
export interface ModuleProblem {
    readonly code: ModuleProblemCode
    readonly at: string
    /** For `MODULE_SPEC_PROBLEM`: the code of the spec problem. */
    readonly detail?: string | undefined
}
