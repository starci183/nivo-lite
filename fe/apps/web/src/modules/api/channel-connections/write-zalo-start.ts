"use server"
import "server-only"

import type { Outcome } from "../outcome"
import type { ZaloWizardConnection } from "@/modules/types"
import { CHANNEL_FAILURE_KEYS, channelSchemas, sendChannel, invalid } from "./channel-connections.mapper"

/** Keeps the Zalo app's keys as a pending connection (owner), so the callback and webhook addresses exist for the Zalo screens. */
export const writeZaloStart = async (input: unknown): Promise<Outcome<ZaloWizardConnection>> => {
    const parsed = channelSchemas.zaloStart.safeParse(input)
    if (!parsed.success) return invalid(CHANNEL_FAILURE_KEYS.invalid)
    return sendChannel<ZaloWizardConnection>(parsed.data)
}
