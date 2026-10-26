import type { SourceDetail, SourceRecord, SourceSummary } from "./knowledge-sources.contracts"
import type { KnowledgeSourcesRow, SourceListRow } from "./persistence/knowledge-sources.rows"

/** A source as the jobs read it, from the row the database answers. */
export const toSourceRecord = (row: KnowledgeSourcesRow): SourceRecord => ({
    id: row.id,
    workspaceId: row.workspace_id,
    module: row.module,
    installationId: row.installation_id,
    kind: row.kind,
    topic: row.topic,
    visibility: row.visibility,
    title: row.title,
    content: row.content,
    status: row.status,
    storagePath: row.storage_path,
    sourceUrl: row.source_url,
    createdBy: row.created_by,
    updatedAt: new Date(row.updated_at).toISOString(),
})

/** A source as the Knowledge page lists it, from the row the database answers. */
export const toSourceSummary = (row: SourceListRow): SourceSummary => ({
    id: row.id,
    workspaceId: row.workspace_id,
    module: row.module,
    installationId: row.installation_id,
    kind: row.kind,
    topic: row.topic,
    tags: row.tags,
    visibility: row.visibility,
    title: row.title,
    status: row.status,
    error: row.error,
    chunkCount: row.chunk_count,
    progress: row.progress,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
})

/** A source with its text, from the row the database answers. */
export const toSourceDetail = (row: SourceListRow): SourceDetail => ({
    ...toSourceSummary(row),
    content: row.content ?? "",
})
