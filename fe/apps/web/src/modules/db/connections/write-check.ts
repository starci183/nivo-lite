"use server"
import "server-only"

import { dbFailure } from "../outcome"
import type { DbOutcome } from "../outcome"
import { getPrincipal } from "../principal"
import type { ConnectionCheck } from "@/modules/types"
import { checkSchema, FAILURE_KEYS, sendCommand, invalid } from "./command.mapper"

/** Asks the provider what it knows about a connection (owner or manager); the server also refreshes the stored status. */
export const writeCheck = async (input: unknown): Promise<DbOutcome<ConnectionCheck>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", FAILURE_KEYS.refused)
    const parsed = checkSchema.safeParse(input)
    if (!parsed.success) return invalid(FAILURE_KEYS.invalid)
    return sendCommand<ConnectionCheck>(parsed.data)
}
