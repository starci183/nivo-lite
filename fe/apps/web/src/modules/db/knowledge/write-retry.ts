"use server"
import "server-only"

import { dbFailure, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { getPrincipal } from "../principal"
import { createServerDbClient } from "../server"
import { isKnowledgeId } from "./knowledge.mapper"

/** Puts a failed or credit-blocked document back on the queue (a manager of its workspace only). */
export const writeRetrySource = async (sourceId: unknown): Promise<DbOutcome<string>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", "principal")
    if (!isKnowledgeId(sourceId)) return dbFailure("invalid", "source-id")
    const client = await createServerDbClient()
    return toOutcome(await client.rpc("knowledge_retry_source", { p_source: sourceId }))
}
