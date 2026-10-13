"use server"
import "server-only"

import type { Outcome } from "../outcome"
import { disconnectSchema, FAILURE_KEYS, sendDone, invalid } from "./connections.mapper"

/** Stops using a connection (owner): the server removes the webhook and wipes the credential, and keeps the row as disconnected. */
export const writeDisconnect = async (input: unknown): Promise<Outcome<true>> => {
    const parsed = disconnectSchema.safeParse(input)
    if (!parsed.success) return invalid(FAILURE_KEYS.invalid)
    return sendDone(parsed.data)
}
