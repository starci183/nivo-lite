import type { AgentTriggerPreset } from "@modules/domain/agent-work"
import type { CapabilityRole } from "@modules/domain/mcp-gateway"
import type { ModuleAudience } from "@modules/domain/module-audiences"
import type { InstallationLifecycle, InstallationRecord } from "@modules/domain/module-installations"

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

/** Whether the module is production ready or still early access. */
export type ModuleStatus = "stable" | "early"

/** How a freshly installed agent runs: it proposes everything (assist) or follows the authority rules alone (autopilot). */
export type OperatingMode = "assist" | "autopilot"

/** How much an authority action may do without a person. */
export type AuthorityMode = "auto" | "ask" | "never"

/** The kinds of subject a setup gate may write a Second Brain fact about. */
export type FactSubjectType =
    "business" | "product" | "service" | "policy" | "customer" | "person" | "supplier" | "place" | "other"

/** Who may read a Second Brain fact. */
export type FactScope = "public" | "internal" | "restricted"

/** One category the catalogue groups modules by. */
export interface ModuleCategory {
    /** The stable category key. */
    readonly key: string
    /** The category title. */
    readonly label: Bilingual
}

/** What a setup answer writes to the Second Brain: a fact about a subject. */
export interface FactWrite {
    /** Discriminator: a Second Brain fact. */
    readonly kind: "fact"
    /** What the fact is about. */
    readonly subjectType: FactSubjectType
    /** The label of the attribute the fact states. */
    readonly attributeLabel: string
    /** Who may read the fact. */
    readonly scope: FactScope
}

/** What a setup answer writes to the authority rules: one field of an action's rule. */
export interface RuleWrite {
    /** Discriminator: an authority rule field. */
    readonly kind: "rule"
    /** The authority action the rule belongs to. */
    readonly action: string
    /** The rule field the answer sets. */
    readonly field: "mode" | "limit_vnd"
}

/** One thing the setup chat extracts from the owner's answer to a gate. */
export type GateWrite = FactWrite | RuleWrite

/** One thing a module must know before it may act; every gate is confirmed to apply a setup. */
export interface ModuleGate {
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
    readonly writes?: ReadonlyArray<GateWrite>
}

/** One action of a module that the authority matrix governs. */
export interface AuthorityActionDefinition {
    /** The stable action key, unique across every module. */
    readonly action: string
    /** The action title. */
    readonly label: Bilingual
    /** The default authority mode. */
    readonly mode: AuthorityMode
    /** The default amount limit in VND, when one applies. */
    readonly limitVnd: number | null
    /** The fields a request for this action must carry. */
    readonly requiredFields: ReadonlyArray<string>
    /** Whether an amount limit is meaningful for the action. */
    readonly amountLimit: boolean
    /** The facts a decide point on this action reads from real records, the first being its amount; none for an action that has no such facts. */
    readonly graphFacts?: ReadonlyArray<string> | undefined
    /** The loosest mode the action can ever take: set means it can never run alone. */
    readonly maxMode: "ask" | "never" | null
    /** A note shown with the action. */
    readonly note: string
    /** The actions this one chains to. */
    readonly next: ReadonlyArray<string>
}

/** One command a module accepts from other agents: its declared contract on the command bus. */
export interface AcceptedCommand {
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

/** What a workspace must have for the module to work well; never blocks installing or applying. */
export interface ModuleRequirements {
    /** The capability names the workspace should provide. */
    readonly capabilities: ReadonlyArray<string>
    /** The connection providers the workspace should have connected. */
    readonly connections: ReadonlyArray<string>
    /** The connector capability roles the module's agent needs, never a named connector; absent means none. */
    readonly roles?: ModuleRoles
}

/** The capability roles of a module: without every required one the agent waits for a connection; a used one only feeds a feature. */
export interface ModuleRoles {
    /** The roles the agent cannot run without. */
    readonly requires: ReadonlyArray<CapabilityRole>
    /** The roles a feature of the agent uses when they are there (it shows "not connected" honestly otherwise). */
    readonly uses: ReadonlyArray<CapabilityRole>
}

/** The agent a module installs with. */
export interface ModuleAgent {
    /** The agent's display name. */
    readonly name: string
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

/** A clock trigger a module seeds for its agent when it is installed or applied. */
export interface ModuleTrigger {
    /** The stable key the trigger is seeded under: a re-install finds the row it wrote, and a base graph's start node names it. */
    readonly key: string
    /** How often it fires; the owner can change it later. */
    readonly preset: AgentTriggerPreset
    /** The time of day (`HH:MM`) of a daily preset. */
    readonly atTime?: string
    /** The probe that decides whether a fire has work; always works when absent. */
    readonly probeKey?: string
}

/** One module of the catalogue: everything the product knows about an installable agent type. */
export interface ModuleDefinition {
    /** The stable module key, short lowercase ASCII. */
    readonly key: string
    /** The display order in the catalogue. */
    readonly order: number
    /** The full module name. */
    readonly name: Bilingual
    /** The short department name used in the authority matrix and activity lines. */
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
    readonly status: ModuleStatus
    /** Who the module's agent talks to. */
    readonly audience: ModuleAudience
    /** The module comes with every workspace. */
    readonly includedWithWorkspace: boolean
    /** The module can be added from the catalogue. */
    readonly available: boolean
    /** The folder of the NIVO base knowledge for the module. */
    readonly knowledgeFolder: string
    /** The key of the module's workbench, when it has one. */
    readonly workbench: string | null
    /** The key of the module's extra settings, when it has any. */
    readonly settingsExtras: string | null
    /** What the workspace should have for the module. */
    readonly requires: ModuleRequirements
    /** The connection providers the module's agent can use. */
    readonly connectionProviders: ReadonlyArray<string>
    /** How a new installation starts running. */
    readonly defaultOperatingMode: OperatingMode
    /** A workspace may install several agents of this type (one per branch or page). */
    readonly multiInstance: boolean
    /** The agent the module installs. */
    readonly agent: ModuleAgent
    /** What the module must know before it may act. */
    readonly gates: ReadonlyArray<ModuleGate>
    /** The actions the authority matrix governs. */
    readonly authorityActions: ReadonlyArray<AuthorityActionDefinition>
    /** The commands other agents may ask the module to run. */
    readonly accepts: ReadonlyArray<AcceptedCommand>
    /** The clock triggers seeded for the module's agent; none when absent. */
    readonly triggers?: ReadonlyArray<ModuleTrigger>
}

/** The whole catalogue as the front end reads it. */
export interface ModulesCatalog {
    /** The categories, in display order. */
    readonly categories: ReadonlyArray<ModuleCategory>
    /** The modules, in display order. */
    readonly modules: ReadonlyArray<ModuleDefinition>
}

/** The terminal output supplied by an operator command. */
export interface ModulesOutput {
    /** Writes the supplied text without changing its line endings. */
    write(text: string): unknown
}

/** What a catalogue sync did. */
export interface ModulesSyncReport {
    /** How many module rows were upserted. */
    readonly modules: number
    /** How many authority action rows were upserted. */
    readonly actions: number
    /** The module keys the database holds that the catalogue no longer lists; they are reported, never deleted. */
    readonly staleModules: ReadonlyArray<string>
    /** The action keys the database holds that the catalogue no longer lists; they are reported, never deleted. */
    readonly staleActions: ReadonlyArray<string>
}

/** A capability role an installation's module requires and no usable connector plays, with the connectors that could play it. */
export interface ConnectionNeed {
    /** The missing role. */
    readonly role: CapabilityRole
    /** The display names of the workspace's connectors that declare the role (installed or installable). */
    readonly providers: ReadonlyArray<string>
}

/** How far the setup of an installation got: the required gates the owner confirmed on the newest draft, of all of them. */
export interface SetupProgress {
    /** The gates confirmed. */
    readonly confirmed: number
    /** The gates the module requires. */
    readonly total: number
}

/** An installation as the product shows it: the record with its agent and version, and what it still needs connected to run (empty when ready). */
export interface InstallationView extends InstallationRecord {
    /** The display name of the agent; empty when it has none. */
    readonly agentName: string
    /** The mention handle of the agent. */
    readonly agentHandle: string
    /** The HTTPS address of the agent's picture; null for the generated avatar or when there is no agent. */
    readonly agentAvatarUrl: string | null
    /** The number of the version in use; null before the first apply. */
    readonly activeVersion: number | null
    /** The missing required roles, each with its possible providers. */
    readonly connectionNeeds: ReadonlyArray<ConnectionNeed>
    /** What the product may say about the installation, derived from the facts (see InstallationLifecycle). */
    readonly lifecycle: InstallationLifecycle
    /** The required setup gates confirmed on the newest draft, of all of them; none confirmed before the setup chat opened. */
    readonly setupProgress: SetupProgress
}
