import type { SourceRecord } from "./knowledge-sources.contracts"
import type { KnowledgeSourcesRow } from "./persistence/knowledge-sources.rows"

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
    updatedAt: row.updated_at,
})
