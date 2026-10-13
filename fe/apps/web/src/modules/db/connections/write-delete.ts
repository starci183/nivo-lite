"use server"
import "server-only"

import { dbFailure } from "@/modules/db/outcome"
import type { DbOutcome } from "@/modules/db/outcome"
import { getPrincipal } from "@/modules/db/principal"
import { deleteSchema, FAILURE_KEYS, sendDone } from "./connections.mapper"

/** Removes a disconnected connection and its saved keys (owner). */
export const writeDelete = async (input: unknown): Promise<DbOutcome<true>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", FAILURE_KEYS.refused)
    const parsed = deleteSchema.safeParse(input)
    if (!parsed.success) return dbFailure("invalid", FAILURE_KEYS.invalid)
    return sendDone(parsed.data)
}
