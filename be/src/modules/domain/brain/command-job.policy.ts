import { isKnowledgeCommandPayload, type KnowledgeCommandPayload } from "@modules/queues/knowledge"

/**
 * The payload the tick `brain-upkeep` (`JOB_TICKS`, platform/jobs) puts on the brain command job: no command row, no person; the
 * runner answers it with the timed upkeep (`BrainService.upkeep`). Written there as a literal (platform may not import a domain).
 */
export const BRAIN_UPKEEP_PAYLOAD = { upkeep: "brain" } as const

/** Whether a brain command job is the timed upkeep tick. */
export const isUpkeepTick = (payload: object): boolean =>
    Object.keys(payload).length === 1 && Object.entries(payload).some(([key, value]) => key === "upkeep" && value === BRAIN_UPKEEP_PAYLOAD.upkeep)

/** The payload of a brain command job, or null when it has another shape (such a job cannot get better by waiting). */
export const commandPayloadOf = (payload: object): KnowledgeCommandPayload | null =>
    isKnowledgeCommandPayload(payload) ? payload : null
