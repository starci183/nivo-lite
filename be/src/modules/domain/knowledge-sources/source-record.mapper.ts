import type { SourceDetail, SourceRecord, SourceSummary } from "./knowledge-sources.contracts"
import type { KnowledgeSourceEntity } from "./persistence/entities"

/** A row of the document list: every column but the text, which only a single-document read carries. */
type SourceListEntity = Omit<KnowledgeSourceEntity, "content"> & { readonly content?: string }

/** A source as the jobs read it, from the row the database answers. */
export const toSourceRecord = (row: KnowledgeSourceEntity): SourceRecord => ({
    id: row.id,
    workspaceId: row.workspaceId,
    module: row.module,
    installationId: row.installationId,
    kind: row.kind,
    topic: row.topic,
    visibility: row.visibility,
    title: row.title,
    content: row.content,
    status: row.status,
    storagePath: row.storagePath,
    sourceUrl: row.sourceUrl,
    createdBy: row.createdBy,
    updatedAt: row.updatedAt.toISOString(),
})

/** A source as the Knowledge page lists it, from the row the database answers. */
export const toSourceSummary = (row: SourceListEntity): SourceSummary => ({
    id: row.id,
    workspaceId: row.workspaceId,
    module: row.module,
    installationId: row.installationId,
    kind: row.kind,
    topic: row.topic,
    tags: row.tags,
    visibility: row.visibility,
    title: row.title,
    status: row.status,
    error: row.error,
    chunkCount: row.chunkCount,
    sizeBytes: row.sizeBytes,
    progress: row.progress,
    stage: row.stage,
    stageDone: row.stageDone,
    stageTotal: row.stageTotal,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
})

/** A source with its text, from the row the database answers. */
export const toSourceDetail = (row: SourceListEntity): SourceDetail => ({
    ...toSourceSummary(row),
    content: row.content ?? "",
})
