"use server"
import "server-only"

import { apiRequest } from "@/modules/api"
import { dbFailure } from "@/modules/db/outcome"
import type { DbOutcome } from "@/modules/db/outcome"
import { getPrincipal } from "@/modules/db/principal"
import { CHANNEL_FAILURE_KEYS, channelSchemas, sendChannelDone } from "./channel-connections.mapper"

/** Stores the OA Secret Key of the Zalo app's Webhook screen (owner): it signs every webhook, so it lets NIVO trust the events. */
export const writeZaloOaSecret = async (input: unknown): Promise<DbOutcome<true>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", CHANNEL_FAILURE_KEYS.refused)
    const parsed = channelSchemas.zaloOaSecret.safeParse(input)
    if (!parsed.success) return dbFailure("invalid", CHANNEL_FAILURE_KEYS.invalid)
    return sendChannelDone(apiRequest, parsed.data)
}
