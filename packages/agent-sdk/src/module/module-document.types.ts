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

/** The only version of the document format a module file or row may declare; another id is refused. */
export type ModuleDocumentSchemaId = "nivo/module@1"

/** The catalogue entry of a module: what the catalogue shows before it is installed. */
export interface ModuleManifest {
    /** The place of the module in the catalogue, lowest first. */
    readonly order: number
    /** The full module name. */
    readonly name: Bilingual
    /** The short department name. */
    readonly shortName: Bilingual
    /** The catalogue description. */
    readonly description: Bilingual
    /** The selling points shown under the description. */
    readonly points: BilingualList
    /** One English line that tells the setup prompt what the module is for. */
    readonly purpose: string
    /** The name of the icon of the design system. */
    readonly icon: string
    /** The svg path of the module glyph. */
    readonly glyph: string
    /** The path of the module mascot image. */
    readonly mascot: string
    /** The key of the category the module belongs to. */
    readonly category: string
    /** Whether the module is stable or in early access. */
    readonly status: "stable" | "early"
    /** Who the module's agent talks to. */
    readonly audience: ModuleAudience
    /** The module comes with every workspace without being added. */
    readonly includedWithWorkspace: boolean
    /** The module can be added from the catalogue. */
    readonly available: boolean
    /** The folder of the base knowledge the module starts with. */
    readonly knowledgeFolder: string
    /** The key of the module's extra settings, when it has any. */
    readonly settingsExtras: string | null
    /** What a workspace should have for the module to work well; it never blocks installing. */
    readonly requires: ModuleTemplateRequirements
    /** The connection providers the module's agent can use. */
    readonly connectionProviders: ReadonlyArray<string>
    /** How a new installation starts running. */
    readonly defaultOperatingMode: "assist" | "autopilot"
    /** A workspace may install several agents of this type. */
    readonly multiInstance: boolean
}

/** One thing a module must know before it may act. */
export interface ModuleDocumentGate {
    /** The stable gate key. */
    readonly key: string
    /** The gate title. */
    readonly label: Bilingual
    /** The hint under the gate. */
    readonly hint: Bilingual
    /** What the setup chat writes from the answer, when anything. */
    readonly writes?: ReadonlyArray<ModuleGateWrite> | undefined
}

/** One action the authority matrix governs. */
export interface ModuleDocumentAction {
    /** The stable action key, unique across every module. */
    readonly action: string
    /** The action title. */
    readonly label: Bilingual
    /** The default authority mode. */
    readonly mode: ModuleAuthorityMode
    /** The default amount limit in VND, which the owner can change; null when the action has none. */
    readonly limitVnd: number | null
    /** The fields a request for this action must carry. */
    readonly requiredFields: ReadonlyArray<string>
    /** Whether an amount limit is meaningful for the action. */
    readonly amountLimit: boolean
    /** The facts a decide point on this action reads from real records, the first being its amount. */
    readonly graphFacts?: ReadonlyArray<string> | undefined
    /** The loosest mode the action can ever take; null leaves it unrestricted. */
    readonly maxMode: "ask" | "never" | null
    /** A note shown with the action. */
    readonly note: Bilingual
    /** The actions this one chains to. */
    readonly next: ReadonlyArray<string>
}

/** What an install seeds: the agent, its gates, actions, commands, triggers and its data rights. */
export interface ModuleAgentTemplate {
    /** The agent the install creates. */
    readonly agent: ModuleTemplateAgent
    /** What the module must know before it may act. */
    readonly gates: ReadonlyArray<ModuleDocumentGate>
    /** The actions the authority matrix governs. */
    readonly authorityActions: ReadonlyArray<ModuleDocumentAction>
    /** The commands other agents may ask the module to run. */
    readonly accepts: ReadonlyArray<ModuleTemplateCommand>
    /** The clock triggers seeded for the agent. */
    readonly triggers: ReadonlyArray<ModuleTemplateTrigger>
    /** The grant an agent of this type is seeded with: default deny, never a wildcard field. */
    readonly rights: ReadonlyArray<DataRight>
}

/** A limit a prompt carries. */
export interface LimitSpec {
    /** The words of the limit the prompt states. */
    readonly text: SpecText
    /** The member of the reading that must hold for the limit to apply; absent applies it always. */
    readonly member?: string | undefined
    /** The kinds of speaker the limit applies to; absent applies it to every kind. */
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
    /** The stable key the answer is read under. */
    readonly key: string
    /** The question put to the model. */
    readonly question: SpecText
    /** The intent and member that must hold before the question is asked; absent asks it every turn. */
    readonly requires?: SignalGuard | undefined
}

/** The intent and member a signal waits for before its question is asked. */
interface SignalGuard {
    /** The intent the turn must have. */
    readonly intent: string
    /** The member of the reading that must be filled. */
    readonly member: string
}

/** A claim a reply may make only when an effect of the required kind was recorded in the turn. */
export interface ClaimSpec {
    /** The kind of effect that must have been recorded in the turn for the claim to stand. */
    readonly requires: Namespaced
    /** The phrases of a reply that make the claim, by language. */
    readonly phrases: BilingualList
    /** The line that replaces a reply whose claim has no recorded effect; absent leaves the reply as it is. */
    readonly line?: SpecText | undefined
}

/** A catalogue fact a condition looks for. */
export interface FactRef {
    /** The kind of subject the fact is about. */
    readonly subjectType: string
    /** The label of the attribute the fact states. */
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
    /** The rules in the order they are tried, each a condition and what the engine does when it holds. */
    readonly rules: ReadonlyArray<{ readonly when: OutcomeCondition; readonly outcome: OutcomeSpec }>
    /** What the engine does when no rule holds. */
    readonly otherwise: OutcomeSpec
}

/** The authoring form of one intent frame. */
export interface IntentSpec {
    /** The stable intent key. */
    readonly intent: string
    /** The phrases that point a message at the intent. */
    readonly triggers: ReadonlyArray<string>
    /** Whether the intent answers the person in the turn it is read. */
    readonly answers: boolean
    /** Whether the intent takes the whole turn, leaving no room for another. */
    readonly ownTurn: boolean
    /** The task the model is given for the intent. */
    readonly task: SpecText
    /** The keys of the limits the prompt states, from the document's `limits`. */
    readonly limits: ReadonlyArray<string>
    /** The kind of result the intent hands on. */
    readonly result: Namespaced
    /** The members of the reading the intent fills. */
    readonly owns: ReadonlyArray<string>
    /** The members that must be filled, each with the words that ask the person for it. */
    readonly required: ReadonlyArray<{ readonly member: string; readonly ask: SpecText }>
    /** The registered checks run over the reading before the intent acts, each with its literal parameters. */
    readonly checks: ReadonlyArray<{
        readonly id: Namespaced
        readonly params?: Readonly<Record<string, string | number | boolean>> | undefined
    }>
    /** The keys of the claims a reply to the intent may make, from the document's `claims`. */
    readonly claims: ReadonlyArray<string>
    /** The key of the outcome rules that decide the turn, from the document's `outcomes`; null leaves it to the engine. */
    readonly outcome: string | null
    /** The registered policy that judges the intent; null uses none. */
    readonly policy: Namespaced | null
}

/** Per-intent frames, members, signals, effects, claims and turn outcomes. */
export interface ModuleContracts {
    /** The limits a prompt can carry, by key. */
    readonly limits: Readonly<Record<string, LimitSpec>>
    /** The shape of each member of the reading, by name. */
    readonly members: Readonly<Record<string, MemberSpec>>
    /** The yes/no questions the model answers on every turn. */
    readonly signals: ReadonlyArray<SignalSpec>
    /** The kinds of effect a turn can record. */
    readonly effects: ReadonlyArray<Namespaced>
    /** The claims a reply may make, by key. */
    readonly claims: Readonly<Record<string, ClaimSpec>>
    /** The outcome rules that decide a turn, by key. */
    readonly outcomes: Readonly<Record<string, OutcomeRulesSpec>>
    /** The frame of each intent the module reads. */
    readonly intents: ReadonlyArray<IntentSpec>
}

/** One module version as a file and as a stored row: data only, never code. */
export interface ModuleDocument {
    /** The format of the document; another id is refused. */
    readonly schema: ModuleDocumentSchemaId
    /** `/^[a-z][a-z0-9_]{1,23}$/`. */
    readonly key: string
    /** An integer of at least 1, strictly increasing per key. */
    readonly version: number
    /** At most 600 characters, shown on the update offer. */
    readonly changelog: string
    /** True: the owner must read the version before taking it. */
    readonly breaking: boolean
    /** The catalogue entry of the module. */
    readonly manifest: ModuleManifest
    /** What an install seeds. */
    readonly template: ModuleAgentTemplate
    /** The frames, members, signals, effects, claims and outcomes of the module's turns. */
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
    /** Where in the document: a field path, a key or a workbench route. */
    readonly at: string
    /** For `MODULE_SPEC_PROBLEM`: the code of the spec problem. */
    readonly detail?: string | undefined
}
