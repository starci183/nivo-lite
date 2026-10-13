"use server"
import "server-only"

import type { Outcome } from "../outcome"
import type { ProviderKeysResult } from "@/modules/types"
import { CHANNEL_FAILURE_KEYS, channelSchemas, sendChannel, invalid } from "./channel-connections.mapper"

/** Stores the keys copied from payOS or Casso (owner); payOS is then asked to confirm the webhook address. */
export const writeProviderKeys = async (input: unknown): Promise<Outcome<ProviderKeysResult>> => {
    const parsed = channelSchemas.providerKeys.safeParse(input)
    if (!parsed.success) return invalid(CHANNEL_FAILURE_KEYS.invalid)
    return sendChannel<ProviderKeysResult>(parsed.data)
}
