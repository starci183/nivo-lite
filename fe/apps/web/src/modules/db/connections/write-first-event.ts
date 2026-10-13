"use server"
import "server-only"

import { dbFailure } from "@/modules/db/outcome"
import type { DbOutcome } from "@/modules/db/outcome"
import { getPrincipal } from "@/modules/db/principal"
import type { FirstEventState } from "@/modules/types"
import { firstEventSchema, FAILURE_KEYS, sendCommand } from "./connections.mapper"

/** The wizard poll: has the first event arrived for this connection (owner or manager). */
export const writeFirstEvent = async (input: unknown): Promise<DbOutcome<FirstEventState>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", FAILURE_KEYS.refused)
    const parsed = firstEventSchema.safeParse(input)
    if (!parsed.success) return dbFailure("invalid", FAILURE_KEYS.invalid)
    return sendCommand<FirstEventState>(parsed.data)
}
