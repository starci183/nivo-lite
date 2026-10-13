"use server"
import "server-only"

import type { Outcome } from "../outcome"
import type { FirstEventState } from "@/modules/types"
import { firstEventSchema, FAILURE_KEYS, sendCommand, invalid } from "./connections.mapper"

/** The wizard poll: has the first event arrived for this connection (owner or manager). */
export const writeFirstEvent = async (input: unknown): Promise<Outcome<FirstEventState>> => {
    const parsed = firstEventSchema.safeParse(input)
    if (!parsed.success) return invalid(FAILURE_KEYS.invalid)
    return sendCommand<FirstEventState>(parsed.data)
}
