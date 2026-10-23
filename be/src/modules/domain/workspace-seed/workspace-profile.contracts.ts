import type { RuleMode } from "@modules/domain/authority-rules"
import type { InstallationRecord, InstallationStatus } from "@modules/domain/module-installations"

/** One MCP gateway tool granted to an agent (no grant = never). */
export interface ProfileToolGrant {
    /** The namespaced tool, `<connector>.<tool>`, or `<connector>.*`. */
    readonly tool: string
    /** auto, ask or never. */
    readonly mode: RuleMode
    /** Amount at or above which the call needs approval, VND; null for none. */
    readonly limitVnd: number | null
    /** Bounds on named arguments of the tool: a call with a larger value needs approval; empty for none. */
    readonly constraints: ReadonlyArray<ProfileArgBound>
}

/** A bound on one named argument of a tool, written as profile data. */
export interface ProfileArgBound {
    /** The argument name of the tool's input schema. */
    readonly arg: string
    /** The largest value the agent may pass alone. */
    readonly max: number
}

/** The answer of one gate of a module's setup checklist, confirmed in the setup chat as the owner's own wording. */
export interface ProfileSetupAnswer {
    /** The gate key of the module definition. */
    readonly gate: string
    /** The business answer; a fact the owner has not given yet stays the documents' placeholder. */
    readonly evidence: string
}

/** One agent a profile installs, found again by its handle. */
export interface ProfileAgent {
    /** The module (agent type): content, video, chatbot, accounting. */
    readonly module: string
    /** The display name. */
    readonly name: string
    /** The @handle, unique in the workspace; the idempotency key. */
    readonly handle: string
    /** The one-line role. */
    readonly role: string
    /** The owner-facing instructions (behavior only; business knowledge lives in the documents). */
    readonly instructions: string
    /** The Hub department room that is the agent's home; null keeps the room the rooms function chose. */
    readonly room: string | null
    /** The gateway tools the agent may call. */
    readonly tools: ReadonlyArray<ProfileToolGrant>
    /** The answers of every gate of its module, applied through the setup chat as the first context version. */
    readonly setup: ReadonlyArray<ProfileSetupAnswer>
}

/** One authority grant of a profile: an action of the registry, its mode and its limit. */
export interface ProfileRule {
    /** The module the action belongs to. */
    readonly department: string
    /** The action key of the registry. */
    readonly action: string
    /** auto, ask or never. */
    readonly mode: RuleMode
    /** The action runs alone strictly below this amount, VND; null for none. */
    readonly limit_vnd: number | null
    /** Fields that must be present. */
    readonly required_fields: ReadonlyArray<string>
    /** The note shown with the rule. */
    readonly note: string
}

/** One workspace document (Second Brain, layer 2) a profile loads through the knowledge ingestion; found again by its title. */
export interface ProfileDocument {
    /** The title; the idempotency key together with the profile origin. */
    readonly title: string
    /** The topic label. */
    readonly topic: string
    /** The module that reads it; null = every module. */
    readonly module: string | null
    /** public: customer-facing agents may answer from it; internal: staff and internal agents only. */
    readonly visibility: "public" | "internal"
    /** The markdown text. */
    readonly content: string
}

/** One remote MCP connector a profile registers; its endpoint comes from the private profile input. */
export interface ProfileConnector {
    /** The namespace key of the connector. */
    readonly key: string
    /** The display name. */
    readonly name: string
    /** True when the server takes a bearer credential; an owner or manager enters it in the console, where it is sealed. */
    readonly needsCredential: boolean
    /** The contract version the connector implements. */
    readonly contractVersion: string
}

/** The private input of a profile run: the endpoint of each connector, by key. */
export interface ProfileInput {
    /** The endpoint URL of each connector, by key. */
    readonly urls: ReadonlyMap<string, string>
}

/** A named configuration of one workspace: brand, agents, grants and documents. Configuration only, never business records. */
export interface WorkspaceProfile {
    /** The profile key given on the command line. */
    readonly key: string
    /** The workspace name the private seed input must name. */
    readonly workspaceName: string
    /** The brand name shown in the console. */
    readonly displayName: string
    /** The logo: app-relative path or https URL. */
    readonly logoUrl: string
    /** The agents. */
    readonly agents: ReadonlyArray<ProfileAgent>
    /** The authority grants. */
    readonly rules: ReadonlyArray<ProfileRule>
    /** The remote MCP connectors the agents call. */
    readonly connectors: ReadonlyArray<ProfileConnector>
    /** The documents. */
    readonly documents: ReadonlyArray<ProfileDocument>
}

/** What `seed-workspace profile` is asked to do, as the command line parsed it: every option may be absent. */
export interface ProfileCommand {
    /** The profile key; absent names no profile. */
    readonly profile?: string
    /** The owner email the private input must hold; absent matches no owner. */
    readonly owner?: string
    /** True writes; absent or false = dry run: validate and print the plan, write nothing. */
    readonly execute?: boolean
}

/** How many documents a run inserted, re-queued because their text changed, or left as they were. */
export interface ProfileDocumentCounts {
    /** New documents queued for indexing. */
    readonly inserted: number
    /** Changed documents queued again. */
    readonly requeued: number
    /** Unchanged documents. */
    readonly unchanged: number
}

/** What a run left one connector in: the tools its pinned catalog holds and whether an owner already approved that catalog. */
export interface ProfileConnectorState {
    /** Tools in the pinned catalog (0 in a dry run). */
    readonly tools: number
    /** True once a person approved the catalog in the console; a run never approves it. */
    readonly approved: boolean
}

/** The public receipt of a profile run; it never holds credentials. */
export interface ProfileReport {
    /** The receipt protocol. */
    readonly schema: "nivo/workspace-profile@1"
    /** The profile key. */
    readonly profile: string
    /** False for a dry run. */
    readonly executed: boolean
    /** The workspace; null in a dry run. */
    readonly workspaceId: string | null
    /** Agents in the profile (dry run) or ensured. */
    readonly agents: number
    /** Grants in the profile (dry run) or saved. */
    readonly rules: number
    /** Tool grants in the profile (dry run) or written by the grants owner. */
    readonly toolGrants: number
    /** Each connector of the profile by key: planned (dry run) or registered, with its catalog state. */
    readonly connectors: Readonly<Record<string, ProfileConnectorState>>
    /** Documents in the profile (dry run: all counted as inserted) or their outcome. */
    readonly documents: ProfileDocumentCounts
    /** The status each installation is in after its setup was applied and its connections checked, by agent handle; planned in a dry run. */
    readonly installations: Readonly<Record<string, InstallationStatus | "planned">>
    /** ready = department rooms ensured; absent = the Hub rooms function is not installed; planned = dry run. */
    readonly rooms: "ready" | "absent" | "planned"
}

/** The workspace a profile is applied to and the owner who writes it. */
export interface ProfileTarget {
    /** The workspace. */
    readonly workspaceId: string
    /** The authenticated owner. */
    readonly ownerId: string
}

/** One installation a profile run kept, with the setup answers of its agent. */
export interface ProfileInstallation {
    /** The agent handle the receipt reports it by. */
    readonly handle: string
    /** The installation that drives the agent. */
    readonly installation: InstallationRecord
    /** The answers of its module's gates. */
    readonly answers: ReadonlyArray<ProfileSetupAnswer>
}

/** The status each installation of a run settled in, by agent handle. */
export type ProfileStatuses = Readonly<Record<string, InstallationStatus>>
