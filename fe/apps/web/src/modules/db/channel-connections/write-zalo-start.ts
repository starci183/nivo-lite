"use server"
import "server-only"

import { dbFailure } from "../outcome"
import type { DbOutcome } from "../outcome"
import { getPrincipal } from "../principal"
import type { ZaloWizardConnection } from "@/modules/types"
import { CHANNEL_FAILURE_KEYS, channelSchemas, sendChannel, invalid } from "./channel-connections.mapper"

/** Keeps the Zalo app's keys as a pending connection (owner), so the callback and webhook addresses exist for the Zalo screens. */
export const writeZaloStart = async (input: unknown): Promise<DbOutcome<ZaloWizardConnection>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", CHANNEL_FAILURE_KEYS.refused)
    const parsed = channelSchemas.zaloStart.safeParse(input)
    if (!parsed.success) return invalid(CHANNEL_FAILURE_KEYS.invalid)
    return sendChannel<ZaloWizardConnection>(parsed.data)
}
