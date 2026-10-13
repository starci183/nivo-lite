"use server"
import "server-only"

import type { Outcome } from "../outcome"
import type { MetaCheck } from "@/modules/types"
import { metaCheckSchema, FAILURE_KEYS, sendCommand, invalid } from "./connections.mapper"

/** Asks Meta what it has for a connection (owner or manager); `repair` makes the subscriptions again first. */
export const writeMetaCheck = async (input: unknown): Promise<Outcome<MetaCheck>> => {
    const parsed = metaCheckSchema.safeParse(input)
    if (!parsed.success) return invalid(FAILURE_KEYS.invalid)
    return sendCommand<MetaCheck>(parsed.data)
}
