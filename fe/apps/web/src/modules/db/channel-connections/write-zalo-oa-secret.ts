"use server"
import "server-only"

import { dbFailure } from "../outcome"
import type { DbOutcome } from "../outcome"
import { getPrincipal } from "../principal"
import { CHANNEL_FAILURE_KEYS, channelSchemas, sendChannelDone, invalid } from "./channel-connections.mapper"

/** Stores the OA Secret Key of the Zalo app's Webhook screen (owner): it signs every webhook, so it lets NIVO trust the events. */
export const writeZaloOaSecret = async (input: unknown): Promise<DbOutcome<true>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", CHANNEL_FAILURE_KEYS.refused)
    const parsed = channelSchemas.zaloOaSecret.safeParse(input)
    if (!parsed.success) return invalid(CHANNEL_FAILURE_KEYS.invalid)
    return sendChannelDone(parsed.data)
}
