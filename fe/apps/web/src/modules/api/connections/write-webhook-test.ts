"use server"
import "server-only"

import type { Outcome } from "../outcome"
import type { WebhookTestVerdict } from "@/modules/types"
import { webhookTestSchema, FAILURE_KEYS, sendCommand, invalid } from "./connections.mapper"

/** Sends a signed sample event to an outgoing webhook (owner or manager) and reports what the receiver answered. */
export const writeWebhookTest = async (input: unknown): Promise<Outcome<WebhookTestVerdict>> => {
    const parsed = webhookTestSchema.safeParse(input)
    if (!parsed.success) return invalid(FAILURE_KEYS.invalid)
    return sendCommand<WebhookTestVerdict>(parsed.data)
}
