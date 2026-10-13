"use server"
import "server-only"

import { dbFailure } from "../outcome"
import type { DbOutcome } from "../outcome"
import { getPrincipal } from "../principal"
import { CHANNEL_FAILURE_KEYS, sendDone, invalid } from "../channel-connections/channel-connections.mapper"
import { webhookMessageKeyOf, webhookSchemas } from "./webhook-connections.mapper"

/** Marks the outgoing webhook live (owner): the chosen events start flowing. */
export const writeWebhookFinish = async (input: unknown): Promise<DbOutcome<true>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", CHANNEL_FAILURE_KEYS.refused)
    const parsed = webhookSchemas.finish.safeParse(input)
    if (!parsed.success) return invalid(CHANNEL_FAILURE_KEYS.invalid)
    return sendDone(parsed.data, webhookMessageKeyOf)
}
