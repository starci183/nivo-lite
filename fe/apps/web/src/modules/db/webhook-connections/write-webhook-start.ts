"use server"
import "server-only"

import { apiRequest } from "@/modules/api"
import { dbFailure } from "@/modules/db/outcome"
import type { DbOutcome } from "@/modules/db/outcome"
import { getPrincipal } from "@/modules/db/principal"
import type { WebhookView } from "@/modules/types"
import { CHANNEL_FAILURE_KEYS, sendRequest } from "@/modules/db/channel-connections/channel-connections.mapper"
import { webhookMessageKeyOf, webhookSchemas } from "./webhook-connections.mapper"

/** Creates the outgoing webhook as pending (owner) and returns the signing key to copy. */
export const writeWebhookStart = async (input: unknown): Promise<DbOutcome<WebhookView>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", CHANNEL_FAILURE_KEYS.refused)
    const parsed = webhookSchemas.start.safeParse(input)
    if (!parsed.success) return dbFailure("invalid", CHANNEL_FAILURE_KEYS.invalid)
    return sendRequest<WebhookView>(apiRequest, parsed.data, webhookMessageKeyOf)
}
