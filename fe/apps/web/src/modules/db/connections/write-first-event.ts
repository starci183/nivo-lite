"use server"
import "server-only"

import { dbFailure } from "../outcome"
import type { DbOutcome } from "../outcome"
import { getPrincipal } from "../principal"
import type { FirstEventState } from "@/modules/types"
import { firstEventSchema, FAILURE_KEYS, sendCommand, invalid } from "./command.mapper"

/** The wizard poll: has the first event arrived for this connection (owner or manager). */
export const writeFirstEvent = async (input: unknown): Promise<DbOutcome<FirstEventState>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", FAILURE_KEYS.refused)
    const parsed = firstEventSchema.safeParse(input)
    if (!parsed.success) return invalid(FAILURE_KEYS.invalid)
    return sendCommand<FirstEventState>(parsed.data)
}
