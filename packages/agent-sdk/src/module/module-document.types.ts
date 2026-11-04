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

/** The only document format this reader accepts, written into every module file. */
export type ModuleDocumentSchemaId = "nivo/module@1"

/** The catalogue entry of a module: what the catalogue shows before it is installed. */
export interface ModuleManifest {
    /** Position of the module in the catalogue list, lowest first. */
    readonly order: number
    /** The full name, in each language. */
    readonly name: Bilingual
    /** A short name for tight places such as tabs. */
    readonly shortName: Bilingual
    /** One or two sentences on what the module does. */
    readonly description: Bilingual
    /** Bullet points that sell the module, in each language. */
    readonly points: BilingualList
    /** Plain statement of what the agent of the module is for. */
    readonly purpose: string
    /** Key of the catalogue icon. */
    readonly icon: string
    /** Single-character mark shown beside the name. */
    readonly glyph: string
    /** Key of the mascot picture. */
    readonly mascot: string
    /** Catalogue group the module is listed under. */
    readonly category: string
    /** Whether the module is stable or still early. */
    readonly status: "stable" | "early"
    /** Who the module is for. */
    readonly audience: ModuleAudience
    /** True when every workspace has the module without installing it. */
    readonly includedWithWorkspace: boolean
    /** False hides the module from the catalogue. */
    readonly available: boolean
    /** Name of the knowledge folder the install creates. */
    readonly knowledgeFolder: string
    /** Key of an extra settings panel, or null when there is none. */
    readonly settingsExtras: string | null
    /** What a workspace must have before it can install the module. */
    readonly requires: ModuleTemplateRequirements
    /** The providers a workspace connects for the module to work. */
    readonly connectionProviders: ReadonlyArray<string>
    /** Whether a new install starts assisting or running on its own. */
    readonly defaultOperatingMode: "assist" | "autopilot"
    /** True when a workspace may install the module more than once. */
    readonly multiInstance: boolean
}

/** One thing a module must know before it may act. */
export interface ModuleDocumentGate {
    /** Stable key the gate is stored under. */
    readonly key: string
    /** What the gate asks, in each language. */
    readonly label: Bilingual
    /** Help text under the question. */
    readonly hint: Bilingual
    /** Where the answer is written once given; absent when it is only checked. */
    readonly writes?: ReadonlyArray<ModuleGateWrite> | undefined
}

/** One action the authority matrix governs. */
export interface ModuleDocumentAction {
    /** Stable key of the action. */
    readonly action: string
    /** What the owner reads for the action, in each language. */
    readonly label: Bilingual
    /** How the agent may act by default. */
    readonly mode: ModuleAuthorityMode
    /** Largest amount in VND the agent may commit alone, or null for no limit. */
    readonly limitVnd: number | null
    /** Fields that must be known before the action runs. */
    readonly requiredFields: ReadonlyArray<string>
    /** True when the action is bounded by an amount limit. */
    readonly amountLimit: boolean
    /** Graph facts the action reads; absent when none. */
    readonly graphFacts?: ReadonlyArray<string> | undefined
    /** The loosest mode an owner may pick, or null for no ceiling. */
    readonly maxMode: "ask" | "never" | null
    /** An explanation shown beside the action. */
    readonly note: Bilingual
    /** Keys of the actions that usually follow. */
    readonly next: ReadonlyArray<string>
}

/** What an install seeds: the agent, its gates, actions, commands, triggers and its data rights. */
export interface ModuleAgentTemplate {
    /** The agent the install creates. */
    readonly agent: ModuleTemplateAgent
    /** The questions the owner answers before the agent acts. */
    readonly gates: ReadonlyArray<ModuleDocumentGate>
    /** The actions the authority matrix governs. */
    readonly authorityActions: ReadonlyArray<ModuleDocumentAction>
    /** The commands the agent accepts. */
    readonly accepts: ReadonlyArray<ModuleTemplateCommand>
    /** What starts a turn of the agent. */
    readonly triggers: ReadonlyArray<ModuleTemplateTrigger>
    /** The grant an agent of this type is seeded with: default deny, never a wildcard field. */
    readonly rights: ReadonlyArray<DataRight>
}

/** A limit a prompt carries. */
export interface LimitSpec {
    /** The limit as the prompt states it. */
    readonly text: SpecText
    /** The member the limit applies to; absent when it applies to every turn. */
    readonly member?: string | undefined
    /** The trust levels the limit applies to; absent for all. */
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
    /** Stable key of the signal in the model reading. */
    readonly key: string
    /** The yes/no question put to the model. */
    readonly question: SpecText
    /** Intent and member that must be present for the question to be asked; absent when always asked. */
    readonly requires?: { readonly intent: string; readonly member: string } | undefined
}

/** The wording that counts as making a claim, per language. */
export interface ClaimPhrases {
    /** The Vietnamese wordings. */
    readonly vi: ReadonlyArray<string>
    /** The English wordings. */
    readonly en: ReadonlyArray<string>
}

/** A claim a reply may make only when an effect of the required kind was recorded in the turn. */
export interface ClaimSpec {
    /** The effect kind that must have been recorded this turn for the claim to be allowed. */
    readonly requires: Namespaced
    /** The wording, per language, that counts as making the claim. */
    readonly phrases: ClaimPhrases
    /** The sentence that replaces the claim when it is not backed; absent for a default. */
    readonly line?: SpecText | undefined
}

/** A catalogue fact a condition looks for. */
export interface FactRef {
    /** The type of subject the fact is about. */
    readonly subjectType: string
    /** The label of the attribute that must be present. */
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
    /** Rules tried in order; the first whose condition holds decides. */
    readonly rules: ReadonlyArray<{ readonly when: OutcomeCondition; readonly then: OutcomeSpec }>
    /** The outcome when no rule holds. */
    readonly otherwise: OutcomeSpec
}

/** The authoring form of one intent frame. */
export interface IntentSpec {
    /** Stable key of the intent. */
    readonly intent: string
    /** Phrases or keys that select this intent. */
    readonly triggers: ReadonlyArray<string>
    /** True when the intent replies to the person. */
    readonly answers: boolean
    /** True when the intent takes a turn of its own. */
    readonly ownTurn: boolean
    /** What the model is asked to do under this intent. */
    readonly task: SpecText
    /** Keys of the limits that apply. */
    readonly limits: ReadonlyArray<string>
    /** The namespaced kind the intent produces. */
    readonly result: Namespaced
    /** Members this intent fills in. */
    readonly owns: ReadonlyArray<string>
    /** Members that must be known, with the question to ask when missing. */
    readonly required: ReadonlyArray<{ readonly member: string; readonly ask: SpecText }>
    /** Checks to run, with their parameters. */
    readonly checks: ReadonlyArray<{
        readonly id: Namespaced
        readonly params?: Readonly<Record<string, string | number | boolean>> | undefined
    }>
    /** Keys of the claims the intent may make. */
    readonly claims: ReadonlyArray<string>
    /** Key of the outcome rules that decide the turn, or null. */
    readonly outcome: string | null
    /** Namespaced policy that gates the intent, or null. */
    readonly policy: Namespaced | null
}

/** Per-intent frames, members, signals, effects, claims and turn outcomes. */
export interface ModuleContracts {
    /** Limits by key. */
    readonly limits: Readonly<Record<string, LimitSpec>>
    /** Member shapes by key. */
    readonly members: Readonly<Record<string, MemberSpec>>
    /** Yes/no questions asked each turn. */
    readonly signals: ReadonlyArray<SignalSpec>
    /** The effect kinds the module may run. */
    readonly effects: ReadonlyArray<Namespaced>
    /** Claims by key. */
    readonly claims: Readonly<Record<string, ClaimSpec>>
    /** Outcome rules by key. */
    readonly outcomes: Readonly<Record<string, OutcomeRulesSpec>>
    /** The intents of the module. */
    readonly intents: ReadonlyArray<IntentSpec>
}

/** One module version as a file and as a stored row: data only, never code. */
export interface ModuleDocument {
    /** Identifies the document format, so a reader can refuse other versions. */
    readonly schema: ModuleDocumentSchemaId
    /** `/^[a-z][a-z0-9_]{1,23}$/`. */
    readonly key: string
    /** An integer of at least 1, strictly increasing per key. */
    readonly version: number
    /** At most 600 characters, shown on the update offer. */
    readonly changelog: string
    /** True: the owner must read the version before taking it. */
    readonly breaking: boolean
    /** What the catalogue shows before install. */
    readonly manifest: ModuleManifest
    /** What an install seeds. */
    readonly template: ModuleAgentTemplate
    /** How the module reads and answers turns. */
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
    /** Which rule the document broke. */
    readonly code: ModuleProblemCode
    /** Path inside the document where it broke. */
    readonly at: string
    /** For `MODULE_SPEC_PROBLEM`: the code of the spec problem. */
    readonly detail?: string | undefined
}
