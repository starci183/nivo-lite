import type { DocumentStatus } from "@/modules/types"

/** The four stages a document goes through before agents may use it, in order: read, index, extract facts, challenge them. */
export const INGEST_STAGES = ["read", "index", "facts", "critic"] as const

/** One of the stages of taking a document in. */
export type IngestStage = (typeof INGEST_STAGES)[number]

/** The stage a worker is on for a document status; null for a status no worker is on. */
export const ingestStageOf = (status: DocumentStatus): IngestStage | null => {
    if (status === "pending" || status === "queued" || status === "reading") return "read"
    if (status === "indexing") return "index"
    return status === "extracting_facts" ? "facts" : null
}
