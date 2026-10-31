import { DocumentsError, isTransientDocumentsError } from "@modules/integrations/documents"
import { KnowledgeError, KnowledgeErrorCode } from "./errors/knowledge.error"
import { KnowledgeSourcesError, KnowledgeSourcesErrorCode, StoredNote } from "@modules/domain/knowledge-sources"

/** Why reading a source failed, as the source stores it, and whether trying again can help. */
export interface SourceFailure {
    /** The stored code the front end shows its own text for. */
    readonly note: string
    /** True when the failure is the network or the other side, so a later attempt may succeed. */
    readonly transient: boolean
}

/** The failure a thrown cause means: a documents or sources error keeps its own code, anything else is unreadable. */
export const failureOf = (cause: unknown): SourceFailure => {
    if (cause instanceof KnowledgeSourcesError) {
        return { note: cause.code, transient: cause.code === KnowledgeSourcesErrorCode.UploadUnavailable }
    }
    if (cause instanceof KnowledgeError) {
        return { note: StoredNote.Unreadable, transient: cause.code === KnowledgeErrorCode.EmbeddingUnavailable }
    }
    return {
        note: cause instanceof DocumentsError ? cause.code : StoredNote.Unreadable,
        transient: isTransientDocumentsError(cause),
    }
}
