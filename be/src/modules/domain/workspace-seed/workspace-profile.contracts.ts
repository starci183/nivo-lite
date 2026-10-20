import type { RuleMode } from "@modules/domain/authority-rules"

/** One MCP gateway tool granted to an agent (table mcp_tool_grants of the gateway; no row = never). */
export interface ProfileToolGrant {
    /** The namespaced tool, or `<connector>.*`, e.g. `hakuen.booking.confirm`. */
    readonly tool: string
    /** auto, ask or never. */
    readonly mode: RuleMode
    /** Amount at or above which the call needs approval, VND; null for none. */
    readonly limitVnd: number | null
    /** Discount percent above which the call needs approval; null for none. */
    readonly limitPct: number | null
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
    /** The documents. */
    readonly documents: ReadonlyArray<ProfileDocument>
}

/** What `seed-workspace profile` is asked to do. */
export interface ProfileCommand {
    /** The profile key. */
    readonly profile: string
    /** The owner email the private input must hold. */
    readonly owner: string
    /** False = dry run: validate and print the plan, write nothing. */
    readonly execute: boolean
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
    /** Tool grants in the profile (dry run) or written; "absent" when the gateway grants table is not installed. */
    readonly toolGrants: number | "absent"
    /** Documents in the profile (dry run: all counted as inserted) or their outcome. */
    readonly documents: ProfileDocumentCounts
    /** ready = department rooms ensured; absent = the Hub rooms function is not installed; planned = dry run. */
    readonly rooms: "ready" | "absent" | "planned"
}
