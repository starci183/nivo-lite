import type { Installation } from "@/modules/installations"
import type { ConnectionStatus } from "@/modules/types"

/** The longest name of an agent. */
export const AGENT_NAME_MAX = 40

/** The longest label of an instance. */
export const INSTANCE_NAME_MAX = 80

/** How long a customer waits for the agent by default before the app answers directly, in seconds. */
const DEFAULT_REPLY_TIMEOUT_SEC = 25

/** The shortest time a customer waits for the agent before the app answers directly, in seconds. */
export const REPLY_TIMEOUT_MIN = 5

/** The longest time a customer waits for the agent before the app answers directly, in seconds. */
export const REPLY_TIMEOUT_MAX = 120

/** The longest holding message. */
export const HOLDING_MAX = 400

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

/** The reply timeout an installation holds in its settings, else the default. */
export const replyTimeoutOf = (settings: unknown): number => {
    const saved = isRecord(settings) ? Number(settings.openclawTimeoutSec) : Number.NaN
    return Number.isFinite(saved) && saved >= REPLY_TIMEOUT_MIN ? Math.round(saved) : DEFAULT_REPLY_TIMEOUT_SEC
}

/** The holding message an installation holds in its settings; empty when it has none. */
export const holdingMessageOf = (settings: unknown): string => {
    const saved = isRecord(settings) ? settings.holdingMessage : undefined
    return typeof saved === "string" ? saved : ""
}

const CONNECTION_STATUSES: ReadonlyArray<ConnectionStatus> = ["pending", "connected", "error", "disconnected"]

/** One connection the agent can work through. */
export interface AgentConnectionView {
    readonly id: string
    readonly label: string
    readonly status: ConnectionStatus
    /** What the agent does through it; empty when it is only a data source. */
    readonly purpose: string
    /** The level of the agent: one of read, ask, auto, or empty for none. */
    readonly access: string
}

interface AgentConnectionWire {
    readonly id: string
    readonly name: string
    readonly status: string
    readonly purpose: string
    readonly access: string
}

/** One back end connection of an agent; a status outside the closed set reads as an error. */
export const toAgentConnection = (row: AgentConnectionWire): AgentConnectionView => ({
    id: row.id,
    label: row.name,
    status: CONNECTION_STATUSES.find((status) => status === row.status) ?? "error",
    purpose: row.purpose,
    access: row.access,
})

/** Whether the agent talks through at least one live connection. */
export const hasBoundConnection = (rows: ReadonlyArray<AgentConnectionView>): boolean =>
    rows.some((row) => row.status !== "disconnected" && row.access !== "")

/** Where the OpenClaw copy of an agent stands. */
export type AgentSyncState = "none" | "syncing" | "ok" | "error"

/** The OpenClaw copy of an agent against the context version in use. */
export interface AgentSyncView {
    readonly state: AgentSyncState
    /** The version OpenClaw holds; null when there is no copy. */
    readonly syncedVersion: number | null
    /** The version in use. */
    readonly activeVersion: number | null
    readonly checkedAt: string | null
    readonly error: string | null
}

/** What the card shows before the first answer. */
export const UNKNOWN_SYNC: AgentSyncView = {
    state: "none",
    syncedVersion: null,
    activeVersion: null,
    checkedAt: null,
    error: null,
}

const SYNC_STATES: ReadonlyArray<AgentSyncState> = ["none", "syncing", "ok", "error"]

interface AgentSyncWire {
    readonly state: string
    readonly syncedVersion?: number | null
    readonly activeVersion?: number | null
    readonly checkedAt?: string | null
    readonly error?: string | null
}

/** One back end sync status; a state outside the closed set reads as none. */
export const toAgentSync = (row: AgentSyncWire): AgentSyncView => ({
    state: SYNC_STATES.find((state) => state === row.state) ?? "none",
    syncedVersion: row.syncedVersion ?? null,
    activeVersion: row.activeVersion ?? null,
    checkedAt: row.checkedAt ?? null,
    error: row.error ?? null,
})

/** Poll the sync status this often while a sync is queued or running. */
export const SYNC_POLL_BUSY_MS = 2500

/** Poll the sync status this often while idle, so a background sync shows up on its own. */
export const SYNC_POLL_IDLE_MS = 20_000

/** How an agent runs: it proposes everything (assist) or follows the authority rules alone (autopilot). */
export type AgentMode = "assist" | "autopilot"

/** The facts of one installed agent the settings cards draw. */
export interface AgentInstallationView {
    readonly id: string
    readonly agentId: string | null
    readonly agentName: string
    readonly agentHandle: string
    /** The instance label. */
    readonly name: string
    /** The type allows several instances. */
    readonly isMulti: boolean
    readonly mode: AgentMode
    readonly isLive: boolean
    /** A context version was applied. */
    readonly hasVersion: boolean
    readonly timeoutSec: number
    readonly holdingMessage: string
}

/** The settings facts of an installed agent. */
export const toAgentInstallationView = (installation: Installation): AgentInstallationView => ({
    id: installation.id,
    agentId: installation.agentId,
    agentName: installation.agentName,
    agentHandle: installation.agentHandle,
    name: installation.name,
    isMulti: installation.isMulti,
    mode: installation.operatingMode,
    isLive: installation.liveEnabled,
    hasVersion: installation.activeContextVersionId !== null,
    timeoutSec: replyTimeoutOf(installation.settings),
    holdingMessage: holdingMessageOf(installation.settings),
})
