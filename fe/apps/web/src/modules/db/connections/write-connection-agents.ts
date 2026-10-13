"use server"
import "server-only"

import { dbFailure } from "@/modules/db/outcome"
import type { DbOutcome } from "@/modules/db/outcome"
import { getPrincipal } from "@/modules/db/principal"
import { connectionAgentsSchema, FAILURE_KEYS, sendDone } from "./connections.mapper"

/** Makes exactly these agents the users of a connection (owner): the wizards' last step. An agent left out loses its access to this connection only. */
export const writeConnectionAgents = async (input: unknown): Promise<DbOutcome<true>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", FAILURE_KEYS.refused)
    const parsed = connectionAgentsSchema.safeParse(input)
    if (!parsed.success) return dbFailure("invalid", FAILURE_KEYS.invalid)
    return sendDone(parsed.data)
}
