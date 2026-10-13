"use server"
import "server-only"

import { dbFailure } from "../outcome"
import type { DbOutcome } from "../outcome"
import { getPrincipal } from "../principal"
import type { MetaCheck } from "@/modules/types"
import { metaCheckSchema, FAILURE_KEYS, sendCommand, invalid } from "./command.mapper"

/** Asks Meta what it has for a connection (owner or manager); `repair` makes the subscriptions again first. */
export const writeMetaCheck = async (input: unknown): Promise<DbOutcome<MetaCheck>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", FAILURE_KEYS.refused)
    const parsed = metaCheckSchema.safeParse(input)
    if (!parsed.success) return invalid(FAILURE_KEYS.invalid)
    return sendCommand<MetaCheck>(parsed.data)
}
