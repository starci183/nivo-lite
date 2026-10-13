"use server"
import "server-only"

import type { Outcome } from "../outcome"
import type { ZaloAuthorizeUrl } from "@/modules/types"
import { CHANNEL_FAILURE_KEYS, channelSchemas, sendChannel, invalid } from "./channel-connections.mapper"

/** The Zalo permission address of this connection (owner); the api stores a fresh one-time state with it. */
export const writeZaloAuthorize = async (input: unknown): Promise<Outcome<ZaloAuthorizeUrl>> => {
    const parsed = channelSchemas.zaloAuthorize.safeParse(input)
    if (!parsed.success) return invalid(CHANNEL_FAILURE_KEYS.invalid)
    return sendChannel<ZaloAuthorizeUrl>(parsed.data)
}
