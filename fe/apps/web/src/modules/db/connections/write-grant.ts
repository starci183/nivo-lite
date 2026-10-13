"use server"
import "server-only"

import { dbFailure } from "@/modules/db/outcome"
import type { DbOutcome } from "@/modules/db/outcome"
import { getPrincipal } from "@/modules/db/principal"
import { grantSchema, FAILURE_KEYS, sendDone } from "./connections.mapper"

/** Gives, changes or removes one agent access to one connection (owner); saved at once from either picker. */
export const writeGrant = async (input: unknown): Promise<DbOutcome<true>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", FAILURE_KEYS.refused)
    const parsed = grantSchema.safeParse(input)
    if (!parsed.success) return dbFailure("invalid", FAILURE_KEYS.invalid)
    return sendDone(parsed.data)
}
