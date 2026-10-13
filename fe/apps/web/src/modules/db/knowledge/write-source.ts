"use server"
import "server-only"

import { dbFailure, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { getPrincipal } from "../principal"
import { createServerDbClient } from "../server"
import { enqueueSchema } from "./knowledge.mapper"

/** Adds a document and queues its indexing in one transaction (a manager of the workspace only); answers the new document id. */
export const writeKnowledgeSource = async (input: unknown): Promise<DbOutcome<string>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", "principal")
    const parsed = enqueueSchema.safeParse(input)
    if (!parsed.success) return dbFailure("invalid", "source-input")
    const client = await createServerDbClient()
    return toOutcome(
        await client.rpc("knowledge_enqueue_source", {
            p_workspace: parsed.data.workspaceId,
            p_kind: parsed.data.kind,
            p_title: parsed.data.title,
            p_storage_path: parsed.data.storagePath ?? "",
            p_url: parsed.data.url ?? "",
            p_meta: parsed.data.meta,
        }),
    )
}
