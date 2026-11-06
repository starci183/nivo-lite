import type { LeadRecordType } from "@/hooks/swr"
import type { LeadRecord, LeadStageId, StepStatus } from "@/modules/types"
import { type BadgeTone } from "@starci/grammar/common"

/** Whether a queued job has ended, in success or in failure. */
export const isTerminal = (status: string): boolean => status === "succeeded" || status === "failed"

/** The stages in journey order, as the tabs and the stage choice list them. */
const STAGE_ORDER: ReadonlyArray<LeadStageId> = ["new", "qualified", "proposal", "won", "lost"]

/** The badge tone of each step status. */
export const STATUS_TONES: Readonly<Record<StepStatus, BadgeTone>> = {
    open: "neutral",
    waiting_approval: "warning",
    done: "success",
}

/** The catalog key of the label of each step status. */
export const STATUS_KEYS: {
    readonly open: "statusOpen"
    readonly waiting_approval: "statusWaiting"
    readonly done: "statusDone"
} = {
    open: "statusOpen",
    waiting_approval: "statusWaiting",
    done: "statusDone",
} as const satisfies Record<StepStatus, string>

/** How long ago an instant was, in the largest whole unit; the reader formats it. */
export type AgeUnit = "now" | "minutes" | "hours" | "days" | "older"

/** The lead record every lead read carries, with the stage narrowed to a known one (an unknown stage reads as new). */
export const leadRecordOf = (lead: LeadRecordType): LeadRecord => {
    const { id, company, channel, need } = lead
    return {
        id,
        contact_name: lead.contactName,
        phone: lead.phone ?? null,
        company,
        channel,
        need,
        stage: STAGE_ORDER.find((stage) => stage === lead.stage) ?? "new",
        context_summary: lead.contextSummary ?? null,
        created_at: lead.createdAt,
    }
}
