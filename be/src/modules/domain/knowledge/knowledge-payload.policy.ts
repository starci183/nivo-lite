import { isKnowledgeSourcePayload, type KnowledgeSourcePayload } from "@modules/queues/knowledge"

/** The payload of an index or facts job, or null when it has another shape (such a job cannot get better by waiting). */
export const sourcePayloadOf = (payload: object): KnowledgeSourcePayload | null =>
    isKnowledgeSourcePayload(payload) ? payload : null
