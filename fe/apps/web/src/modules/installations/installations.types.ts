import type { ModuleKey } from "@/modules/catalog"

/**
 * Where an installed agent stands: being installed, in setup, ready to go live, live, paused, or waiting for a connection its module
 * requires (`needs_connection`: applied but not running until a connector that plays the missing role is connected).
 */
export type InstallationStatus = "installing" | "setup" | "ready" | "live" | "paused" | "needs_connection"

/**
 * One capability role an agent waits for and the connectors in the catalog that play it (display names, data from the back end;
 * never a fixed connector name).
 */
export type InstallationConnectionNeed = { readonly role: string; readonly providers: ReadonlyArray<string> }

/** How an installed agent runs: it proposes everything (assist) or follows the authority rules alone (autopilot). */
export type OperatingMode = "assist" | "autopilot"

/**
 * One installed agent of a workspace: an INSTANCE of a module type. Single-instance types (accounting, inventory...) have one per
 * workspace; multi-instance types (chatbot, booking, lead_gen) may have several, each with its own name, agent, connections and setup.
 */
export type Installation = {
    readonly id: string
    readonly workspaceId: string
    readonly moduleKey: ModuleKey
    /** The instance label; the type name for the first instance and every single-instance type. */
    readonly name: string
    /** The type allows several instances (copied from the catalogue at insert). */
    readonly isMulti: boolean
    readonly agentId: string | null
    /** The display name and handle of the agent (read-through, for headers and mentions). */
    readonly agentName: string
    readonly agentHandle: string
    readonly status: InstallationStatus
    /** The roles a `needs_connection` agent waits for, each with the connectors that would satisfy it; empty otherwise. */
    readonly connectionNeeds: ReadonlyArray<InstallationConnectionNeed>
    readonly operatingMode: OperatingMode
    readonly liveEnabled: boolean
    readonly activeContextVersionId: string | null
    /** Number of the active context version, null before the first apply. */
    readonly activeVersion: number | null
    readonly settings: Readonly<Record<string, unknown>>
    readonly createdAt: string
}

/** One short fact the setup chat noted. */
export type SetupFact = { readonly key: string; readonly text: string }

/** Whether the owner has confirmed what a gate asks for. */
export type GateStatus = "missing" | "proposed" | "confirmed"

/** The evidence behind one gate. */
export type GateEntry = {
    readonly status: GateStatus
    readonly evidence: string
    readonly confirmed_by?: string | null
    readonly confirmed_at?: string | null
}

/** The evidence of every gate of a module, by gate key. */
export type GateEvidence = Readonly<Record<string, GateEntry>>

/** The draft being built in the setup chat. */
export type DraftSnapshot = { readonly summary: string; readonly facts: Array<SetupFact> }

/** What a context version freezes: the draft plus the confirmed evidence per gate. */
export type ContextSnapshot = DraftSnapshot & { readonly gates: GateEvidence }

/** An applied, immutable version of the business context of a module. */
export type ContextVersion = {
    readonly id: string
    readonly installationId: string
    readonly version: number
    readonly snapshot: ContextSnapshot
    readonly appliedBy: string
    readonly appliedAt: string
}

/** The setup chat session of an installation. */
export type SetupSession = {
    readonly id: string
    readonly workspaceId: string
    readonly installationId: string
    readonly revision: number
    readonly status: "draft" | "applied" | "discarded"
    readonly draft: DraftSnapshot
    readonly gateEvidence: GateEvidence
    readonly createdAt: string
}

/** One revision of the setup chat of an installation (the history dividers). */
export type SetupRevision = { readonly id: string; readonly revision: number; readonly status: SetupSession["status"] }

/** One message of the setup chat. */
export type SetupMessage = {
    readonly id: string
    readonly setupSessionId: string
    readonly role: "user" | "assistant"
    readonly author: string
    readonly body: string
    readonly createdAt: string
}

/** What the extra settings card of a module receives, rendered under the common settings cards of an agent. */
export type SettingsExtraProps = { readonly installation: Installation; readonly canEdit: boolean }
