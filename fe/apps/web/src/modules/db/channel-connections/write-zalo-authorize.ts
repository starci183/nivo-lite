"use server"
import "server-only"

import { apiRequest } from "@/modules/api"
import { dbFailure } from "@/modules/db/outcome"
import type { DbOutcome } from "@/modules/db/outcome"
import { getPrincipal } from "@/modules/db/principal"
import type { ZaloAuthorizeUrl } from "@/modules/types"
import { CHANNEL_FAILURE_KEYS, channelSchemas, sendChannel } from "./channel-connections.mapper"

/** The Zalo permission address of this connection (owner); the api stores a fresh one-time state with it. */
export const writeZaloAuthorize = async (input: unknown): Promise<DbOutcome<ZaloAuthorizeUrl>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", CHANNEL_FAILURE_KEYS.refused)
    const parsed = channelSchemas.zaloAuthorize.safeParse(input)
    if (!parsed.success) return dbFailure("invalid", CHANNEL_FAILURE_KEYS.invalid)
    return sendChannel<ZaloAuthorizeUrl>(apiRequest, parsed.data)
}
