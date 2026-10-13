import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the knowledge capability. */
export enum KnowledgeErrorCode {
    /** The agent the question is asked as does not exist. */
    ModuleUnknown = "KNOWLEDGE_MODULE_UNKNOWN",
    /** The embeddings provider could not be reached; the job is retried. */
    EmbeddingUnavailable = "KNOWLEDGE_EMBEDDING_UNAVAILABLE",
}

/** How each knowledge code travels. */
export const KNOWLEDGE_ERROR_KINDS: Record<KnowledgeErrorCode, ErrorKind> = {
    [KnowledgeErrorCode.ModuleUnknown]: "invalid",
    [KnowledgeErrorCode.EmbeddingUnavailable]: "unavailable",
}

/** The one error class of the knowledge capability. */
export class KnowledgeError extends DomainError<KnowledgeErrorCode> {}
