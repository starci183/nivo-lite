"use server"
import "server-only"

import { dbFailure } from "../outcome"
import type { DbOutcome } from "../outcome"
import { getPrincipal } from "../principal"
import type { ZaloAuthorizeUrl } from "@/modules/types"
import { CHANNEL_FAILURE_KEYS, channelSchemas, sendChannel, invalid } from "./channel-connections.mapper"

/** The Zalo permission address of this connection (owner); the api stores a fresh one-time state with it. */
export const writeZaloAuthorize = async (input: unknown): Promise<DbOutcome<ZaloAuthorizeUrl>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", CHANNEL_FAILURE_KEYS.refused)
    const parsed = channelSchemas.zaloAuthorize.safeParse(input)
    if (!parsed.success) return invalid(CHANNEL_FAILURE_KEYS.invalid)
    return sendChannel<ZaloAuthorizeUrl>(parsed.data)
}
