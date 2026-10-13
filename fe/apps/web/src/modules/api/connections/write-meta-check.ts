"use server"
import "server-only"

import type { Outcome } from "../outcome"
import type { MetaCheckSummary } from "@/modules/types"
import { metaCheckSchema, FAILURE_KEYS, sendCommand, invalid } from "./connections.mapper"

/** Checks a Facebook and Instagram connection (owner): the token, the Page and the subscribed fields. */
export const writeMetaCheck = async (input: unknown): Promise<Outcome<MetaCheckSummary>> => {
    const parsed = metaCheckSchema.safeParse(input)
    if (!parsed.success) return invalid(FAILURE_KEYS.invalid)
    return sendCommand<MetaCheckSummary>(parsed.data)
}
