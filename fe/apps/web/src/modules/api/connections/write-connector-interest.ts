"use server"
import "server-only"

import type { Outcome } from "../outcome"
import { interestSchema, FAILURE_KEYS, sendDone, invalid } from "./connections.mapper"

/** Says the workspace wants a planned connector (owner or manager); recorded once per workspace. */
export const writeConnectorInterest = async (input: unknown): Promise<Outcome<true>> => {
    const parsed = interestSchema.safeParse(input)
    if (!parsed.success) return invalid(FAILURE_KEYS.invalid)
    return sendDone(parsed.data)
}
