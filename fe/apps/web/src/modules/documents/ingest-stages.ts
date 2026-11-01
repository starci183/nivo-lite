import type { DocumentStatus } from "@/modules/types"

/** The four stages a document goes through before agents may use it, in order: read, index, extract facts, challenge them. */
export const INGEST_STAGES = ["read", "index", "facts", "critic"] as const

/** One of the stages of taking a document in. */
export type IngestStage = (typeof INGEST_STAGES)[number]

/** The stage a document is at: the fourth while the critic checks its dossier, else the one a worker is on for its status; null for a document no step is on. */
export const ingestStageOf = (status: DocumentStatus, stage: string | null): IngestStage | null => {
    if (status === "ready" && stage === "critic") return "critic"
    if (status === "pending" || status === "queued" || status === "reading") return "read"
    if (status === "indexing") return "index"
    return status === "extracting_facts" ? "facts" : null
}
