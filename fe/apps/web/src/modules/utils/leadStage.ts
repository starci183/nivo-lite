import type { LeadStageId } from "@/modules/types"

/** The five stages of one customer record, in the order the deal moves through them. */
const LEAD_STAGES: ReadonlyArray<LeadStageId> = ["new", "qualified", "proposal", "won", "lost"]

const STAGE_IDS: ReadonlySet<string> = new Set(LEAD_STAGES)

/** Whether a stored stage is one of the five. */
export const isLeadStage = (value: string): value is LeadStageId => STAGE_IDS.has(value)

/** The stage of a stored text; a text that is none of the five reads as a customer that is new. */
export const leadStageOf = (value: string): LeadStageId => LEAD_STAGES.find((stage) => stage === value) ?? "new"

/** A translator that carries the five `leadStage_*` words of a desk. */
type LeadStageTranslator = (key: `leadStage_${LeadStageId}`) => string

/** The one word of a stage, the same on the Chatbot desk and the Sales desk: New, Qualified, Proposal, Won, Lost. */
export const leadStageLabel = (t: LeadStageTranslator, stage: LeadStageId): string => t(`leadStage_${stage}`)
