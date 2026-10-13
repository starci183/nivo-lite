"use server"
import "server-only"

import type { Outcome } from "../outcome"
import { deleteSchema, FAILURE_KEYS, sendDone, invalid } from "./connections.mapper"

/** Removes a disconnected connection and its saved keys (owner). */
export const writeDelete = async (input: unknown): Promise<Outcome<true>> => {
    const parsed = deleteSchema.safeParse(input)
    if (!parsed.success) return invalid(FAILURE_KEYS.invalid)
    return sendDone(parsed.data)
}
