import "server-only"

import { dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { createServerDbClient } from "../server"

/** A customer question the agent of a module could not answer yet. */
export type OpenGapRow = {
    readonly id: string
    readonly question: string
    readonly topic: string | null
    readonly attributeGuess: string | null
    readonly count: number
}

/** Reads the open customer questions of a module, most asked first. */
export const readOpenGaps = async (
    workspaceId: string,
    moduleKey: string,
    limit: number,
): Promise<DbOutcome<Array<OpenGapRow>>> => {
    const client = await createServerDbClient()
    const result = toOutcome(
        await client
            .from("knowledge_gaps")
            .select("id, question, topic, attribute_guess, count")
            .eq("workspace_id", workspaceId)
            .eq("module", moduleKey)
            .eq("status", "open")
            .order("count", { ascending: false })
            .limit(limit),
    )
    if (result.kind !== "ok") return result
    return dbOk(
        result.value.map((gap) => ({
            id: gap.id,
            question: gap.question,
            topic: gap.topic,
            attributeGuess: gap.attribute_guess,
            count: gap.count,
        })),
    )
}
