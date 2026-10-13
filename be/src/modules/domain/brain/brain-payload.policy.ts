import { isKnowledgeSourcePayload } from "@modules/queues/knowledge"
import type { KnowledgeSourcePayload } from "@modules/queues/knowledge"

/** The payload of a facts job, or null when it has another shape (such a job cannot get better by waiting). */
export const sourcePayloadOf = (payload: object): KnowledgeSourcePayload | null =>
    isKnowledgeSourcePayload(payload) ? payload : null
