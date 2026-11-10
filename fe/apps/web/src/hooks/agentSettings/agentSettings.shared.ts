import { agentHref, isSetupPending } from "@/modules/installations"
import type { Installation, InstallationLifecycle } from "@/modules/installations"
import { workspaceHref } from "@/modules/routes"

/** The shortest name of an agent. */
export const AGENT_NAME_MIN = 2

/** The longest name of an agent. */
export const AGENT_NAME_MAX = 40

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

/** The working hours text an installation holds in its settings (JSON of the ranges per day); null when it holds none. */
export const workingHoursOf = (settings: unknown): string | null => {
    const saved = isRecord(settings) ? settings.workingHours : undefined
    if (typeof saved === "string") return saved
    return isRecord(saved) ? JSON.stringify(saved) : null
}

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
    /** The one display name of the agent. */
    readonly name: string
    readonly agentHandle: string
    /** The picture the owner gave the agent; null draws the default sprout. */
    readonly agentAvatarUrl: string | null
    /** The preset the owner chose ("initials" draws the initials); null when none was chosen. */
    readonly agentAvatarPreset: string | null
    /** The role of the agent, for its role mark. */
    readonly moduleKey: string
    /** The type allows several instances. */
    readonly isMulti: boolean
    readonly mode: AgentMode
    readonly isLive: boolean
    /** The one state of the agent, as the back end names it. */
    readonly lifecycle: InstallationLifecycle
    /** The agent has no applied setup yet (not set up or being set up): it cannot be switched on. */
    readonly isSetupPending: boolean
    /** The Setup tab of the agent: where every not-ready state sends the owner. */
    readonly setupHref: string
    /** A context version was applied: the same truth as the lifecycle, never read apart from it. */
    readonly hasVersion: boolean
    readonly timeoutSec: number
    readonly holdingMessage: string
    /** The weekly working hours text (JSON of the ranges per day); null when none is saved. */
    readonly workingHours: string | null
}

/** The settings facts of an installed agent. */
export const toAgentInstallationView = (installation: Installation, workspaceId: string): AgentInstallationView => ({
    id: installation.id,
    agentId: installation.agentId,
    name: installation.name,
    agentHandle: installation.agentHandle,
    agentAvatarUrl: installation.agentAvatarUrl,
    agentAvatarPreset: installation.agentAvatarPreset,
    moduleKey: installation.moduleKey,
    isMulti: installation.isMulti,
    mode: installation.operatingMode,
    isLive: installation.lifecycle === "running",
    lifecycle: installation.lifecycle,
    isSetupPending: isSetupPending(installation.lifecycle),
    setupHref: workspaceHref(workspaceId, agentHref(installation.moduleKey, installation.id)),
    hasVersion: !isSetupPending(installation.lifecycle),
    timeoutSec: replyTimeoutOf(installation.settings),
    holdingMessage: holdingMessageOf(installation.settings),
    workingHours: workingHoursOf(installation.settings),
})
