"use server"
import "server-only"

import { apiRequest } from "@/modules/api"
import { dbFailure } from "@/modules/db/outcome"
import type { DbOutcome } from "@/modules/db/outcome"
import { getPrincipal } from "@/modules/db/principal"
import { CHANNEL_FAILURE_KEYS, sendDone } from "@/modules/db/channel-connections/channel-connections.mapper"
import { webhookMessageKeyOf, webhookSchemas } from "./webhook-connections.mapper"

/** Marks the outgoing webhook live (owner): the chosen events start flowing. */
export const writeWebhookFinish = async (input: unknown): Promise<DbOutcome<true>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", CHANNEL_FAILURE_KEYS.refused)
    const parsed = webhookSchemas.finish.safeParse(input)
    if (!parsed.success) return dbFailure("invalid", CHANNEL_FAILURE_KEYS.invalid)
    return sendDone(apiRequest, parsed.data, webhookMessageKeyOf)
}
