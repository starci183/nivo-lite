"use server"
import "server-only"

import type { Outcome } from "../outcome"
import { agentConnectionsSchema, FAILURE_KEYS, sendDone, invalid } from "./connections.mapper"

/** Makes exactly these connections the ones an agent uses (owner): the agent settings, the same rules as the connection side. */
export const writeAgentConnections = async (input: unknown): Promise<Outcome<true>> => {
    const parsed = agentConnectionsSchema.safeParse(input)
    if (!parsed.success) return invalid(FAILURE_KEYS.invalid)
    return sendDone(parsed.data)
}
