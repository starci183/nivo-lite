/** The queue name: the contract between the producers and the processors of the sync-agents and generate-with-agent jobs (a pgmq queue name). */
export const AGENTS_QUEUE = "agents"

/** The jobs of the agents queue; the value is the job name inside the queue and the prefix of the dedupe key. */
export enum AgentsJob {
    /** Rebuilds the OpenClaw copy of one installation, of every installation of a workspace, or of every installation on OpenClaw (a scheduler tick). */
    Sync = "agents.sync",
    /** Runs one queued text generation on the workspace's internal OpenClaw agent. */
    Generate = "agents.generate",
    /** Answers one owner message of the setup chat of an agent: one model call, merged into the draft, with the confirm cards it implies. */
    SetupTurn = "agents.setup_turn",
}

/** The payload of a sync job: its scope is the installation, else the workspace, else every installation on OpenClaw (the empty tick). */
export interface SyncAgentsPayload {
    /** The workspace to sync; absent on the scheduler tick that syncs everything. */
    readonly workspaceId?: string
    /** The one installation to sync; absent syncs the whole workspace. */
    readonly installationId?: string
    /** Also sync an installation that is not on OpenClaw yet (the "sync again" button). */
    readonly force?: boolean
    /** When the sync was asked for, epoch ms: bursts inside one minute are one job. */
    readonly requestedAt?: number
}

/** The payload of a generate job: the ai_generations row to run, ids only. */
export interface GenerateWithAgentPayload {
    /** The ai_generations row. */
    readonly generationId: string
    /** The workspace that owns it: the workspace concurrency limit is keyed on it. */
    readonly workspaceId: string
}

/** The payload of a setup-turn job: the owner message to answer, ids only. */
export interface SetupTurnPayload {
    /** The workspace that owns the chat. */
    readonly workspaceId: string
    /** The owner message the turn answers. */
    readonly messageId: string
    /** The session the message belongs to. */
    readonly setupSessionId: string
    /** The language of the reply. */
    readonly locale: "vi" | "en"
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null

const isOptional = (value: unknown, type: "string" | "boolean" | "number"): boolean =>
    value === undefined || typeof value === type

/** True when a job payload is the payload of a sync job (a tick has no member at all). */
export const isSyncAgentsPayload = (value: unknown): value is SyncAgentsPayload =>
    isRecord(value) &&
    isOptional(value.workspaceId, "string") &&
    isOptional(value.installationId, "string") &&
    isOptional(value.force, "boolean") &&
    isOptional(value.requestedAt, "number")

/** True when a job payload is the payload of a generate job. */
export const isGenerateWithAgentPayload = (value: unknown): value is GenerateWithAgentPayload =>
    isRecord(value) && typeof value.generationId === "string" && typeof value.workspaceId === "string"

/** True when a job payload is the payload of a setup-turn job. */
export const isSetupTurnPayload = (value: unknown): value is SetupTurnPayload =>
    isRecord(value) &&
    typeof value.workspaceId === "string" &&
    typeof value.messageId === "string" &&
    typeof value.setupSessionId === "string" &&
    (value.locale === "vi" || value.locale === "en")

const MINUTE_MS = 60_000

/**
 * The dedupe key of an agents job: `<job>:<subject>` plus the minute the request fell in, so a burst of edits is one sync job while a
 * later edit is a new one. A sync scope that names no installation is `ws:<workspace id>`, the scheduler tick is `all`.
 */
export const agentsDedupeKey = (job: AgentsJob, subject: string, requestedAt?: number): string =>
    requestedAt === undefined ? `${job}:${subject}` : `${job}:${subject}:${Math.floor(requestedAt / MINUTE_MS)}`

/** The subject a sync payload is keyed on in its dedupe key. */
export const syncSubjectOf = (payload: SyncAgentsPayload): string => {
    if (payload.installationId !== undefined) return payload.installationId
    return payload.workspaceId === undefined ? "all" : `ws:${payload.workspaceId}`
}
