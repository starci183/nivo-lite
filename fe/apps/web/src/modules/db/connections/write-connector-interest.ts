"use server"
import "server-only"

import { dbFailure } from "@/modules/db/outcome"
import type { DbOutcome } from "@/modules/db/outcome"
import { getPrincipal } from "@/modules/db/principal"
import { interestSchema, FAILURE_KEYS, sendDone } from "./connections.mapper"

/** Says the workspace wants a planned connector (owner or manager); recorded once per workspace. */
export const writeConnectorInterest = async (input: unknown): Promise<DbOutcome<true>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", FAILURE_KEYS.refused)
    const parsed = interestSchema.safeParse(input)
    if (!parsed.success) return dbFailure("invalid", FAILURE_KEYS.invalid)
    return sendDone(parsed.data)
}
