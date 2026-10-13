import "server-only"

import { lensFor, lensSources } from "@/lib/knowledge/lens"
import type { SourceChoice } from "@/modules/video"
import { dbFailure, dbOk } from "../outcome"
import type { DbOutcome } from "../outcome"

/** How many public sources the picker offers. */
const SOURCE_LIMIT = 40

/** How many characters of a source the picker previews. */
const EXCERPT_CHARS = 220

/** Reads the public business sources a video may be based on (customer-facing output: never internal knowledge). */
export const readSources = async (workspaceId: string): Promise<DbOutcome<ReadonlyArray<SourceChoice>>> => {
    try {
        const rows = (await lensSources(lensFor(workspaceId, "video"), 200)).reverse().slice(0, SOURCE_LIMIT)
        return dbOk(
            rows.map((row) => ({
                id: row.id,
                title: row.title,
                topic: row.topic,
                excerpt: row.content.replace(/\s+/g, " ").trim().slice(0, EXCERPT_CHARS),
            })),
        )
    } catch {
        return dbFailure("unavailable", "sources")
    }
}
