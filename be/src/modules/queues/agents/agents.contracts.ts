import { isRecord } from "@modules/platform/primitives"

/** The queue name: the contract between the producers and the processors of the generate-with-agent and setup-turn jobs (the durable queue name). */
export const AGENTS_QUEUE = "agents"

/** The jobs of the agents queue; the value is the job name inside the queue and the prefix of the dedupe key. */
export enum AgentsJob {
    /** Runs one queued text generation. */
    Generate = "agents.generate",
    /** Answers one owner message of the setup chat of an agent: one model call, merged into the draft, with the confirm cards it implies. */
    SetupTurn = "agents.setup_turn",
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

/** The dedupe key of an agents job: `<job>:<subject>`, one job per subject. */
export const agentsDedupeKey = (job: AgentsJob, subject: string): string => `${job}:${subject}`
