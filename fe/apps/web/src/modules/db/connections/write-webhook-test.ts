"use server"
import "server-only"

import { dbFailure } from "../outcome"
import type { DbOutcome } from "../outcome"
import { getPrincipal } from "../principal"
import type { WebhookTestVerdict } from "@/modules/types"
import { webhookTestSchema, FAILURE_KEYS, sendCommand, invalid } from "./command.mapper"

/** Sends a signed sample event to an outgoing webhook (owner or manager) and reports what the receiver answered. */
export const writeWebhookTest = async (input: unknown): Promise<DbOutcome<WebhookTestVerdict>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", FAILURE_KEYS.refused)
    const parsed = webhookTestSchema.safeParse(input)
    if (!parsed.success) return invalid(FAILURE_KEYS.invalid)
    return sendCommand<WebhookTestVerdict>(parsed.data)
}
