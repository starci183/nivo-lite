"use server"
import "server-only"

import type { Outcome } from "../outcome"
import { CHANNEL_FAILURE_KEYS, sendDone, invalid } from "../channel-connections/channel-connections.mapper"
import { webhookMessageKeyOf, webhookSchemas } from "./webhook-connections.mapper"

/** Marks the outgoing webhook live (owner): the chosen events start flowing. */
export const writeWebhookFinish = async (input: unknown): Promise<Outcome<true>> => {
    const parsed = webhookSchemas.finish.safeParse(input)
    if (!parsed.success) return invalid(CHANNEL_FAILURE_KEYS.invalid)
    return sendDone(parsed.data, webhookMessageKeyOf)
}
