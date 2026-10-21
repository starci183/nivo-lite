import type { Locale } from "@modules/platform/i18n"

/** The pgmq queue of the lead generation flow: what follows a finished lead_gen step runs here, one step per job. */
export const LEAD_GEN_QUEUE = "lead_gen"

/** The job that continues a prospect's chain after a finished step and runs the steps it queued. */
export const CONTINUE_LEAD_GEN_JOB = "lead-gen.continue"

/** A proposal field as the queue carries it. */
export type LeadGenFieldValue = string | number | null

/** The finished lead_gen step a continuation starts from (a snapshot of its work item). */
export interface LeadGenFinishedStep {
    /** The work item. */
    readonly id: string
    /** Its action. */
    readonly action: string
    /** The lead. */
    readonly leadId: string | null
    /** The chain it belongs to. */
    readonly chainId: string | null
    /** The fields of its proposal. */
    readonly fields: Readonly<Record<string, LeadGenFieldValue>>
    /** Its draft, for the comment that follows a public reply. */
    readonly draft: string
}

/** The payload of one continuation. */
export interface LeadGenContinuePayload {
    /** The workspace. */
    readonly workspaceId: string
    /** The language of the generated texts. */
    readonly locale: Locale
    /** The inbound event the chain started from: its queued steps run after the continuation. */
    readonly inboundEventId: string | null
    /** The finished step. */
    readonly step: LeadGenFinishedStep
}

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

/** True for a delivery that carries a lead generation continuation. */
export const isLeadGenContinuePayload = (value: unknown): value is LeadGenContinuePayload =>
    isRecord(value) &&
    typeof value.workspaceId === "string" &&
    (value.locale === "vi" || value.locale === "en") &&
    (value.inboundEventId === null || typeof value.inboundEventId === "string") &&
    isRecord(value.step) &&
    typeof value.step.id === "string" &&
    typeof value.step.action === "string" &&
    isRecord(value.step.fields)
