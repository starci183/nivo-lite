/** The jobs of the knowledge queue; the value is the job name inside the queue and the prefix of the dedupe key. */
export enum KnowledgeJob {
    /** Reads the source (storage object, link, Drive file or text), chunks and embeds it; on success enqueues the facts job. */
    Index = "knowledge.index",
    /** Reads facts out of a ready source into brain_facts proposals (conflicts surfaced); chained after the index job. */
    Facts = "knowledge.facts",
    /** Re-embeds the chunks of a workspace made by another model than the one in use. */
    Reembed = "knowledge.reembed",
}

/** The payload of the index and facts jobs: the source to work on, ids only (the handler re-reads the current state). */
export interface KnowledgeSourcePayload {
    /** The knowledge source to read, chunk and embed, or to read facts from. */
    readonly sourceId: string
    /** The workspace that owns it: the workspace concurrency limit is keyed on it. */
    readonly workspaceId: string
}

/** The payload of the reembed job. */
export interface KnowledgeReembedPayload {
    /** The workspace whose chunks are re-embedded. */
    readonly workspaceId: string
    /** The model to re-embed with; the model in use when absent. */
    readonly model?: string
}

/** The failure reason recorded when a workspace has no credits left: the job fails WITHOUT retrying and the owner tops up, then retries. */
export const KNOWLEDGE_BLOCKED_CREDITS = "blocked_credits"

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null

/** True when a job payload is the payload of an index or facts job. */
export const isKnowledgeSourcePayload = (value: unknown): value is KnowledgeSourcePayload =>
    isRecord(value) && typeof value.sourceId === "string" && typeof value.workspaceId === "string"

/** True when a job payload is the payload of a reembed job. */
export const isKnowledgeReembedPayload = (value: unknown): value is KnowledgeReembedPayload =>
    isRecord(value) &&
    typeof value.workspaceId === "string" &&
    (value.model === undefined || typeof value.model === "string")

/**
 * The dedupe key of a knowledge job: `<job>:<subject>` plus an optional suffix for a deliberate re-run (`retry:<ms>`). The same key
 * enqueued twice is one job; the SQL functions knowledge_enqueue_source and knowledge_retry_source build the same keys.
 */
export const knowledgeDedupeKey = (job: KnowledgeJob, subject: string, suffix?: string): string =>
    suffix === undefined ? `${job}:${subject}` : `${job}:${subject}:${suffix}`
