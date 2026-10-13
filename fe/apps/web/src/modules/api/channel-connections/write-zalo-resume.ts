"use server"
import "server-only"

import type { Outcome } from "../outcome"
import type { ZaloWizardConnection } from "@/modules/types"
import { CHANNEL_FAILURE_KEYS, channelSchemas, sendChannel, invalid } from "./channel-connections.mapper"

/** Continues an unfinished or broken Zalo connection (owner); keys are never returned. */
export const writeZaloResume = async (input: unknown): Promise<Outcome<ZaloWizardConnection>> => {
    const parsed = channelSchemas.zaloResume.safeParse(input)
    if (!parsed.success) return invalid(CHANNEL_FAILURE_KEYS.invalid)
    return sendChannel<ZaloWizardConnection>(parsed.data)
}
