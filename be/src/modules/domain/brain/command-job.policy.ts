import { isKnowledgeCommandPayload } from "@modules/queues/knowledge"
import type { KnowledgeCommandPayload } from "@modules/queues/knowledge"

/** The payload of a brain command job, or null when it has another shape (such a job cannot get better by waiting). */
export const commandPayloadOf = (payload: object): KnowledgeCommandPayload | null =>
    isKnowledgeCommandPayload(payload) ? payload : null
