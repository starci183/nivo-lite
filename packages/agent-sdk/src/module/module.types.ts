/** A text in both product languages. */
export interface Bilingual {
    /** The Vietnamese text. */
    readonly vi: string
    /** The English text. */
    readonly en: string
}

/** A list of texts in both product languages. */
export interface BilingualList {
    /** The Vietnamese items. */
    readonly vi: ReadonlyArray<string>
    /** The English items. */
    readonly en: ReadonlyArray<string>
}

/** Who a module's agent talks to: customers through the channels, or the people of the workspace. */
export type ModuleAudience = "customer" | "internal"

/**
 * A connector capability role: what a tool does, never which connector plays it. A module names the roles its agent needs; the MCP
 * gateway resolves each to a workspace's installed and approved tool.
 */
export type ModuleCapabilityRole =
    | "identity.find"
    | "identity.upsert"
    | "receivable.find"
    | "receivable.recordPayment"
    | "payment.credits.list"
    | "payment.debits.list"
    | "invoice.list"

/** How often a clock trigger a module seeds fires. */
export type ModuleTriggerPreset = "every_15m" | "hourly" | "daily_at" | "weekdays_at"

/** How much an authority action may do without a person. */
export type ModuleAuthorityMode = "auto" | "ask" | "never"

/** The kinds of subject a setup gate may write a Second Brain fact about. */
export type ModuleFactSubject =
    "business" | "product" | "service" | "policy" | "customer" | "person" | "supplier" | "place" | "other"

/** What a setup answer writes: a Second Brain fact, or one field of an action's rule. */
export type ModuleGateWrite =
    | {
          readonly kind: "fact"
          readonly subjectType: ModuleFactSubject
          readonly attributeLabel: string
          readonly scope: "public" | "internal" | "restricted"
      }
    | { readonly kind: "rule"; readonly action: string; readonly field: "mode" | "limit_vnd" }

/** One thing a module must know before it may act. */
export interface ModuleTemplateGate {
    /** The stable gate key. */
    readonly key: string
    /** The Vietnamese gate title. */
    readonly label_vi: string
    /** The English gate title. */
    readonly label_en: string
    /** The Vietnamese hint under the gate. */
    readonly hint_vi: string
    /** The English hint under the gate. */
    readonly hint_en: string
    /** What the setup chat writes from the answer, when anything. */
    readonly writes?: ReadonlyArray<ModuleGateWrite>
}

/** One action of a module that the authority matrix governs: a branch of the seed graph. */
export interface ModuleTemplateAction {
    /** The stable action key, unique across every module. */
    readonly action: string
    /** The action title. */
    readonly label: Bilingual
    /** The default authority mode. */
    readonly mode: ModuleAuthorityMode
    /** The default amount limit in VND: a template parameter the owner can change. */
    readonly limitVnd: number | null
    /** The fields a request for this action must carry. */
    readonly requiredFields: ReadonlyArray<string>
    /** Whether an amount limit is meaningful for the action. */
    readonly amountLimit: boolean
    /** The facts a decide point on this action reads from real records, the first being its amount. */
    readonly graphFacts?: ReadonlyArray<string> | undefined
    /** The loosest mode the action can ever take. */
    readonly maxMode: "ask" | "never" | null
    /** A note shown with the action. */
    readonly note: string
    /** The actions this one chains to. */
    readonly next: ReadonlyArray<string>
}

/** One command the module accepts from other agents on the command bus. */
export interface ModuleTemplateCommand {
    /** The stable command key, unique within the module. */
    readonly command: string
    /** The authority action that governs the command. */
    readonly action: string
    /** The kind of subject the command acts on. */
    readonly subjectType: string
    /** The payload keys a sender must supply. */
    readonly requiredFields: ReadonlyArray<string>
    /** What the command does. */
    readonly description: Bilingual
}

/** The agent a module installs with. */
export interface ModuleTemplateAgent {
    /** The role the agent carries in its default name. */
    readonly label: Bilingual
    /** The agent's mention handle. */
    readonly handle: string
    /** The one-line summary of the agent. */
    readonly summary: Bilingual
    /** What the agent can do. */
    readonly capabilities: BilingualList
    /** The default role text of the agent. */
    readonly role: Bilingual
    /** The default instructions of the agent. */
    readonly instructions: Bilingual
}

/** The connector roles an agent needs and the ones it uses when present. */
export interface ModuleTemplateRoles {
    /** The roles the agent cannot work without. */
    readonly requires: ReadonlyArray<ModuleCapabilityRole>
    /** The roles the agent uses when the workspace has them. */
    readonly uses: ReadonlyArray<ModuleCapabilityRole>
}

/** What a workspace should have for the module to work well; never blocks installing. */
export interface ModuleTemplateRequirements {
    /** The capability names the workspace should provide. */
    readonly capabilities: ReadonlyArray<string>
    /** The connection providers the workspace should have connected. */
    readonly connections: ReadonlyArray<string>
    /** The connector roles the agent needs and uses; absent means none. */
    readonly roles?: ModuleTemplateRoles | undefined
}

/** A clock trigger a module seeds for its agent. */
export interface ModuleTemplateTrigger {
    /** The stable key the trigger is seeded under. */
    readonly key: string
    /** How often it fires. */
    readonly preset: ModuleTriggerPreset
    /** The time of day (`HH:MM`) of a daily preset. */
    readonly atTime?: string | undefined
    /** The probe that decides whether a fire has work. */
    readonly probeKey?: string | undefined
}

/**
 * The template of a module: the catalogue entry, the agent, the setup gates, and the actions and commands its seed graph is built from.
 * It is data only; the host derives the seed graph from it under its own checks.
 */
export interface ModuleTemplate {
    /** The stable module key, short lowercase ASCII. */
    readonly key: string
    /** The display order in the catalogue. */
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
    /** Whether the module is stable or early access. */
    readonly status: "stable" | "early"
    /** Who the module's agent talks to. */
    readonly audience: ModuleAudience
    /** The module comes with every workspace. */
    readonly includedWithWorkspace: boolean
    /** The module can be added from the catalogue. */
    readonly available: boolean
    /** The folder of the NIVO base knowledge for the module. */
    readonly knowledgeFolder: string
    /** The key of the module's workbench, when it has one; the workbench registration carries the same key. */
    readonly workbench: string | null
    /** The key of the module's extra settings, when it has any. */
    readonly settingsExtras: string | null
    /** What the workspace should have for the module. */
    readonly requires: ModuleTemplateRequirements
    /** The connection providers the module's agent can use. */
    readonly connectionProviders: ReadonlyArray<string>
    /** How a new installation starts running. */
    readonly defaultOperatingMode: "assist" | "autopilot"
    /** A workspace may install several agents of this type. */
    readonly multiInstance: boolean
    /** The agent the module installs. */
    readonly agent: ModuleTemplateAgent
    /** What the module must know before it may act. */
    readonly gates: ReadonlyArray<ModuleTemplateGate>
    /** The actions the authority matrix governs. */
    readonly authorityActions: ReadonlyArray<ModuleTemplateAction>
    /** The commands other agents may ask the module to run. */
    readonly accepts: ReadonlyArray<ModuleTemplateCommand>
    /** The clock triggers seeded for the module's agent; none when absent. */
    readonly triggers?: ReadonlyArray<ModuleTemplateTrigger>
}

/** The words a module adds to the vocabulary a graph may use. */
export interface ModuleServerVocabulary {
    /** The tool providers the module adds; none when absent. */
    readonly providers?: ReadonlyArray<string>
    /** The steps the module adds, by provider; none when absent. */
    readonly steps?: Readonly<Record<string, ReadonlyArray<string>>>
}

/** The server half of a module: its template and the words it adds to a graph, React-free so a back end loads it. */
export interface ModuleServer {
    /** The module key; equal to the template's. */
    readonly key: string
    /** The template the host seeds the module's agent from. */
    readonly template: ModuleTemplate
    /** Tool providers and steps the module adds to the words a graph may use; none when absent. */
    readonly vocabulary?: ModuleServerVocabulary
}

/** The codes a module list is refused with. */
export type ModuleListProblemCode =
    "MODULE_KEY_DUPLICATE" | "MODULE_KEY_MISMATCH" | "MODULE_ACTION_DUPLICATE" | "MODULE_COMMAND_UNKNOWN_ACTION"

/** Why a module list was refused, and the key it is about. */
export interface ModuleListProblem {
    /** Which rule of the list the module broke. */
    readonly code: ModuleListProblemCode
    /** The module key, or the action or command the problem is about. */
    readonly key: string
}
