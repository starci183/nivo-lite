"use server"
import "server-only"

import { dbFailure } from "@/modules/db/outcome"
import type { DbOutcome } from "@/modules/db/outcome"
import { getPrincipal } from "@/modules/db/principal"
import type { MetaCheckSummary } from "@/modules/types"
import { metaCheckSchema, FAILURE_KEYS, sendCommand } from "./connections.mapper"

/** Checks a Facebook and Instagram connection (owner): the token, the Page and the subscribed fields. */
export const writeMetaCheck = async (input: unknown): Promise<DbOutcome<MetaCheckSummary>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", FAILURE_KEYS.refused)
    const parsed = metaCheckSchema.safeParse(input)
    if (!parsed.success) return dbFailure("invalid", FAILURE_KEYS.invalid)
    return sendCommand<MetaCheckSummary>(parsed.data)
}
