import { isRecord } from "@modules/platform/primitives"

/** The jobs of the knowledge queue; the value is the job name inside the queue and the prefix of the dedupe key. */
export enum KnowledgeJob {
    /** Reads the source (storage object, link, Drive file or text), chunks and embeds it; on success enqueues the facts job. */
    Index = "knowledge.index",
    /** Reads facts out of a ready source into brain_facts proposals (conflicts surfaced); chained after the index job. */
    Facts = "knowledge.facts",
    /** Carries out a command an owner or manager asked for on the Second Brain or Knowledge page (row in brain_commands). */
    BrainCommand = "brain.command",
    /** Carries out a run row (dossier_review_runs): one batch of the shop-document critiques that wait. */
    DossierReview = "dossier.review",
    /** Writes the text of a row of public_documents in the status drafting, from internal documents read through NIVO MCP, or looks for the internal answer to a customer question. */
    PublicDraft = "public.draft",
    /** Derives the shop's policies from the truth graph of a workspace: only the facts that changed are judged (brain_policies). */
    PolicyDerive = "brain.policies",
}

/** The payload of the index and facts jobs: the source to work on, ids only (the handler re-reads the current state). */
export interface KnowledgeSourcePayload {
    /** The knowledge source to read, chunk and embed, or to read facts from. */
    readonly sourceId: string
    /** The workspace that owns it: the workspace concurrency limit is keyed on it. */
    readonly workspaceId: string
    /**
     * A facts job only: the critic's verdict on the document changed (its critique ended, the founder answered or skipped a point) and
     * its waiting truths must be settled AGAIN by this job, whatever the reading was doing when the job was queued: ended, waiting,
     * or in the middle of a settle that read the verdict before the change.
     */
    readonly settleAgain?: boolean | undefined
}

/** The payload of the brain command job: the command row to carry out, ids only (the handler re-reads the current state). */
export interface KnowledgeCommandPayload {
    /** The brain_commands row. */
    readonly commandId: string
    /** The workspace it was asked in. */
    readonly workspaceId: string
}

/** The payload of the dossier review job: the run row to carry out, ids only. */
export interface DossierReviewPayload {
    /** The dossier_review_runs row. */
    readonly runId: string
    /** The workspace it reviews. */
    readonly workspaceId: string
}

/** The payload of the public draft job: the document row to write, ids only. */
export interface PublicDraftPayload {
    /** The public_documents row. */
    readonly documentId: string
    /** The workspace it belongs to. */
    readonly workspaceId: string
    /** The exact drafting revision this job may finish; the row increments it for every redraft. */
    readonly draftRevision: number
    /**
     * The Auth user of the member who asked for this draft (a draft or a redraft from the console), so the internal documents are read
     * as that person once node rights decide; absent for a draft no person asked for (a customer question's proposal) and for a job
     * queued before the member was carried.
     */
    readonly requestedBy?: string
}

/** The payload of the policy derive job: the workspace whose truth graph changed (the handler re-reads the current state). */
export interface PolicyDerivePayload {
    /** The workspace. */
    readonly workspaceId: string
}

/** The failure reason recorded when a workspace has no credits left: the job fails WITHOUT retrying and the owner tops up, then retries. */
export const KNOWLEDGE_BLOCKED_CREDITS = "blocked_credits"

/** True when a job payload is the payload of an index or facts job. */
export const isKnowledgeSourcePayload = (value: unknown): value is KnowledgeSourcePayload =>
    isRecord(value) && typeof value.sourceId === "string" && typeof value.workspaceId === "string"

/** True when a job payload is the payload of a brain command job. */
export const isKnowledgeCommandPayload = (value: unknown): value is KnowledgeCommandPayload =>
    isRecord(value) && typeof value.commandId === "string" && typeof value.workspaceId === "string"

/** True when a job payload is the payload of a dossier review job. */
export const isDossierReviewPayload = (value: unknown): value is DossierReviewPayload =>
    isRecord(value) && typeof value.runId === "string" && typeof value.workspaceId === "string"

/** True when a job payload is the payload of a public draft job. */
export const isPublicDraftPayload = (value: unknown): value is PublicDraftPayload =>
    isRecord(value) &&
    typeof value.documentId === "string" &&
    typeof value.workspaceId === "string" &&
    typeof value.draftRevision === "number" &&
    Number.isSafeInteger(value.draftRevision) &&
    value.draftRevision >= 0 &&
    (value.requestedBy === undefined || (typeof value.requestedBy === "string" && value.requestedBy !== ""))

/** True when a job payload is the payload of a policy derive job. */
export const isPolicyDerivePayload = (value: unknown): value is PolicyDerivePayload =>
    isRecord(value) && typeof value.workspaceId === "string"

/**
 * The dedupe key of a knowledge job: `<job>:<subject>` plus an optional suffix for a deliberate re-run (`retry:<ms>`). The same key
 * enqueued twice is one job; the SQL functions knowledge_enqueue_source and knowledge_retry_source build the same keys.
 */
export const knowledgeDedupeKey = (job: KnowledgeJob, subject: string, suffix?: string): string =>
    suffix === undefined ? `${job}:${subject}` : `${job}:${subject}:${suffix}`
