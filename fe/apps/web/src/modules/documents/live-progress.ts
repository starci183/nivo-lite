import type {
    KnowledgeProgressPush,
    KnowledgeProgressStage,
} from "@/modules/api/sse/knowledge/stream-knowledge-progress"
import type { KnowledgeDocument } from "@/modules/types"
import { toSourceStatus } from "./knowledge.mapper"
import { isDocumentActive } from "./status"

/** Where a worker is on a document while it indexes it: the stage and how many passages of it are done. */
export interface LiveProgress {
    readonly stage: KnowledgeProgressStage | null
    /** Passages of the stage that are done, or null when the stage has no count. */
    readonly done: number | null
    /** Passages of the stage in all, or null when the stage has no count. */
    readonly total: number | null
    /** 0 to 100. */
    readonly percent: number
}

/** The processing row of one document with every word resolved. */
export interface KnowledgeProgressRowView {
    /** What is going on: "Dang xu ly". */
    readonly title: string
    /** The stage a worker is on. */
    readonly stage: string
    /** How many passages of the stage are done, or null when the stage has no count. */
    readonly count: string | null
    /** 0 to 100. */
    readonly value: number
    /** What the bar measures, for assistive technology. */
    readonly label: string
}

/** The catalog key (`knowledge` namespace) of the name of each stage. */
export const KNOWLEDGE_STAGE_KEYS: Readonly<Record<KnowledgeProgressStage, string>> = {
    read: "stage_read",
    chunk: "stage_chunk",
    embed: "stage_embed",
    store: "stage_store",
    facts: "stage_facts",
}

/** The document with the pushed state laid over it when that state is the newer one; the stored list wins when it is. */
export const overlayPush = (document: KnowledgeDocument, push: KnowledgeProgressPush | undefined): KnowledgeDocument =>
    push === undefined || push.at < document.updatedAt
        ? document
        : {
              ...document,
              status: toSourceStatus(push.status),
              progress: push.progress,
              error: push.error,
              chunkCount: push.chunkCount,
              updatedAt: push.at,
          }

/** The stage a stored text names, or null for none or one this page does not know. */
const stageOf = (value: string | null): KnowledgeProgressStage | null =>
    value === "read" || value === "chunk" || value === "embed" || value === "store" || value === "facts" ? value : null

/** What a worker is doing on a document, or null when no worker is on it. */
export const liveOf = (document: KnowledgeDocument, push: KnowledgeProgressPush | undefined): LiveProgress | null => {
    if (!isDocumentActive(document.status)) return null
    const fresh = push !== undefined && push.at >= document.updatedAt
    return {
        stage: stageOf(fresh ? push.stage : document.stage),
        done: fresh ? push.done : document.stageDone,
        total: fresh ? push.total : document.stageTotal,
        percent: document.progress,
    }
}
