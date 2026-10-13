import "server-only"

import { generateWithOpenClaw } from "@/lib/openclaw-generate"
import { dbFailure, dbOk } from "../outcome"
import type { DbOutcome } from "../outcome"
import { parseJsonObject } from "@/modules/content"

/** What one generation call is for and what it is told. */
export type GenerateJsonInput = Parameters<typeof generateWithOpenClaw>[0]

/** A parsed JSON answer with the facts of the call. */
export interface JsonAnswer {
    readonly parsed: Record<string, unknown>
    readonly generationId: string
    readonly model: string | null
    readonly timings: Record<string, number>
}

const ATTEMPTS = 2

/**
 * One OpenClaw JSON call. OpenClaw is the only text AI; it writes ideas and drafts only. When the answer is not a JSON object the call is
 * repeated once (the model sometimes wraps or truncates it). Fails with ai_busy when OpenClaw cannot answer and ai_unreadable when the
 * answer cannot be read.
 */
export const generateJson = async (input: GenerateJsonInput, attempt = 1): Promise<DbOutcome<JsonAnswer>> => {
    const answer = await generateWithOpenClaw(input)
    if (!answer.ok) {
        return answer.reason === "quota" ? dbFailure("refused", "ai_quota") : dbFailure("unavailable", "ai_busy")
    }
    const parsed = parseJsonObject(answer.output)
    if (parsed !== null) {
        return dbOk({
            parsed,
            generationId: answer.generationId,
            model: answer.usage?.model ?? null,
            timings: answer.timings,
        })
    }
    return attempt < ATTEMPTS ? generateJson(input, attempt + 1) : dbFailure("unavailable", "ai_unreadable")
}
