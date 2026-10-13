"use server"
import "server-only"

import { dbFailure } from "../outcome"
import type { DbOutcome } from "../outcome"
import { getPrincipal } from "../principal"
import { agentConnectionsSchema, FAILURE_KEYS, sendDone, invalid } from "./command.mapper"

/** Makes exactly these connections the ones an agent uses (owner): the agent settings, the same rules as the connection side. */
export const writeAgentConnections = async (input: unknown): Promise<DbOutcome<true>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", FAILURE_KEYS.refused)
    const parsed = agentConnectionsSchema.safeParse(input)
    if (!parsed.success) return invalid(FAILURE_KEYS.invalid)
    return sendDone(parsed.data)
}
