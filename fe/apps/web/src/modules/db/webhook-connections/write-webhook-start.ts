"use server"
import "server-only"

import { dbFailure } from "../outcome"
import type { DbOutcome } from "../outcome"
import { getPrincipal } from "../principal"
import type { WebhookView } from "@/modules/types"
import { CHANNEL_FAILURE_KEYS, sendRequest, invalid } from "../channel-connections/channel-connections.mapper"
import { webhookMessageKeyOf, webhookSchemas } from "./webhook-connections.mapper"

/** Creates the outgoing webhook as pending (owner) and returns the signing key to copy. */
export const writeWebhookStart = async (input: unknown): Promise<DbOutcome<WebhookView>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", CHANNEL_FAILURE_KEYS.refused)
    const parsed = webhookSchemas.start.safeParse(input)
    if (!parsed.success) return invalid(CHANNEL_FAILURE_KEYS.invalid)
    return sendRequest<WebhookView>(parsed.data, webhookMessageKeyOf)
}
