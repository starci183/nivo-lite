"use server"
import "server-only"

import type { Outcome } from "../outcome"
import type { ConnectionCheck } from "@/modules/types"
import { checkSchema, FAILURE_KEYS, sendCommand, invalid } from "./connections.mapper"

/** Asks the provider what it knows about a connection (owner or manager); the server also refreshes the stored status. */
export const writeCheck = async (input: unknown): Promise<Outcome<ConnectionCheck>> => {
    const parsed = checkSchema.safeParse(input)
    if (!parsed.success) return invalid(FAILURE_KEYS.invalid)
    return sendCommand<ConnectionCheck>(parsed.data)
}
