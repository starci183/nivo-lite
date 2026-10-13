"use server"
import "server-only"

import type { Outcome } from "../outcome"
import { connectionAgentsSchema, FAILURE_KEYS, sendDone, invalid } from "./connections.mapper"

/** Makes exactly these agents the users of a connection (owner): the wizards' last step. An agent left out loses its access to this connection only. */
export const writeConnectionAgents = async (input: unknown): Promise<Outcome<true>> => {
    const parsed = connectionAgentsSchema.safeParse(input)
    if (!parsed.success) return invalid(FAILURE_KEYS.invalid)
    return sendDone(parsed.data)
}
