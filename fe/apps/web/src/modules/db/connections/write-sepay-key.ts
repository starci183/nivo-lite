"use server"
import "server-only"

import { dbFailure } from "@/modules/db/outcome"
import type { DbOutcome } from "@/modules/db/outcome"
import { getPrincipal } from "@/modules/db/principal"
import type { SepayKeys } from "@/modules/types"
import { sepayKeySchema, FAILURE_KEYS, sendCommand } from "./connections.mapper"

/** Shows the SePay webhook URL and API key again (owner): the one secret the owner must paste into SePay. */
export const writeSepayKey = async (input: unknown): Promise<DbOutcome<SepayKeys>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", FAILURE_KEYS.refused)
    const parsed = sepayKeySchema.safeParse(input)
    if (!parsed.success) return dbFailure("invalid", FAILURE_KEYS.invalid)
    return sendCommand<SepayKeys>(parsed.data)
}
