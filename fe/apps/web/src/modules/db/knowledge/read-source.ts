import "server-only"

import { dbFailure, dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { createServerDbClient } from "../server"
import { SOURCE_COLUMNS, toSource } from "./knowledge.mapper"
import type { SourceRow } from "./knowledge.mapper"
import type { DocumentPassage, KnowledgeDocumentDetail } from "@/modules/types"

const CHUNKS_LIMIT = 500

/** One document with its text and the passages agents retrieve from it, under the caller's row level security. */
export interface KnowledgeSourceView {
    readonly source: KnowledgeDocumentDetail
    readonly chunks: ReadonlyArray<DocumentPassage>
}

/** Reads one document of a workspace with its text and its passages; a document of another workspace is not found. */
export const readKnowledgeSource = async (
    workspaceId: string,
    sourceId: string,
): Promise<DbOutcome<KnowledgeSourceView>> => {
    const client = await createServerDbClient()
    const [found, chunks] = await Promise.all([
        client
            .from("knowledge_sources")
            .select(`${SOURCE_COLUMNS}, content`)
            .eq("workspace_id", workspaceId)
            .eq("id", sourceId)
            .limit(1)
            .overrideTypes<Array<SourceRow & { readonly content: string }>>(),
        client
            .from("knowledge_chunks")
            .select("id, ord, content, has_embedding:embedding")
            .eq("workspace_id", workspaceId)
            .eq("source_id", sourceId)
            .order("ord")
            .limit(CHUNKS_LIMIT),
    ])
    const rows = toOutcome(found)
    if (rows.kind !== "ok") return rows
    const first = rows.value[0]
    if (first === undefined) return dbFailure("not-found", "source")
    const passages = toOutcome(chunks)
    if (passages.kind !== "ok") return passages
    return dbOk({
        source: { ...toSource(first), content: first.content },
        chunks: passages.value.map((chunk) => ({
            id: chunk.id,
            ord: chunk.ord,
            content: chunk.content,
            hasEmbedding: chunk.has_embedding !== null,
        })),
    })
}
