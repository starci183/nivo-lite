import { isKnowledgeReembedPayload, isKnowledgeSourcePayload } from "@modules/queues/knowledge"
import type { KnowledgeReembedPayload, KnowledgeSourcePayload } from "@modules/queues/knowledge"

/** The payload of an index or facts job, or null when it has another shape (such a job cannot get better by waiting). */
export const sourcePayloadOf = (payload: object): KnowledgeSourcePayload | null =>
    isKnowledgeSourcePayload(payload) ? payload : null

/** The payload of a re-embedding job, or null when it has another shape. */
export const reembedPayloadOf = (payload: object): KnowledgeReembedPayload | null =>
    isKnowledgeReembedPayload(payload) ? payload : null
