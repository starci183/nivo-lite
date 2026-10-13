"use server"
import "server-only"

import { dbFailure } from "../outcome"
import type { DbOutcome } from "../outcome"
import { getPrincipal } from "../principal"
import { disconnectSchema, FAILURE_KEYS, sendDone, invalid } from "./command.mapper"

/** Stops using a connection (owner): the server removes the webhook and wipes the credential, and keeps the row as disconnected. */
export const writeDisconnect = async (input: unknown): Promise<DbOutcome<true>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", FAILURE_KEYS.refused)
    const parsed = disconnectSchema.safeParse(input)
    if (!parsed.success) return invalid(FAILURE_KEYS.invalid)
    return sendDone(parsed.data)
}
