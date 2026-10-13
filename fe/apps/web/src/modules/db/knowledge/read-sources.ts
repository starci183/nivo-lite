import "server-only"

import { dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { createServerDbClient } from "../server"
import { SOURCE_COLUMNS, toSource } from "./knowledge.mapper"
import type { SourceRow } from "./knowledge.mapper"
import type { KnowledgeDocument } from "@/modules/types"

const SOURCES_LIMIT = 500

/** Reads the documents of a workspace, newest first and without their text, under the row level security of the signed-in member. */
export const readKnowledgeSources = async (
    workspaceId: string,
): Promise<DbOutcome<ReadonlyArray<KnowledgeDocument>>> => {
    const client = await createServerDbClient()
    const rows = toOutcome(
        await client
            .from("knowledge_sources")
            .select(SOURCE_COLUMNS)
            .eq("workspace_id", workspaceId)
            .order("created_at", { ascending: false })
            .limit(SOURCES_LIMIT)
            .overrideTypes<Array<SourceRow>>(),
    )
    return rows.kind === "ok" ? dbOk(rows.value.map(toSource)) : rows
}
