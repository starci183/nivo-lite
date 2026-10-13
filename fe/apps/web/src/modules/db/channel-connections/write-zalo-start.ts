"use server"
import "server-only"

import { apiRequest } from "@/modules/api"
import { dbFailure } from "@/modules/db/outcome"
import type { DbOutcome } from "@/modules/db/outcome"
import { getPrincipal } from "@/modules/db/principal"
import type { ZaloWizardConnection } from "@/modules/types"
import { CHANNEL_FAILURE_KEYS, channelSchemas, sendChannel } from "./channel-connections.mapper"

/** Keeps the Zalo app's keys as a pending connection (owner), so the callback and webhook addresses exist for the Zalo screens. */
export const writeZaloStart = async (input: unknown): Promise<DbOutcome<ZaloWizardConnection>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", CHANNEL_FAILURE_KEYS.refused)
    const parsed = channelSchemas.zaloStart.safeParse(input)
    if (!parsed.success) return dbFailure("invalid", CHANNEL_FAILURE_KEYS.invalid)
    return sendChannel<ZaloWizardConnection>(apiRequest, parsed.data)
}
