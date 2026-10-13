"use server"
import "server-only"

import type { Outcome } from "../outcome"
import { grantSchema, FAILURE_KEYS, sendDone, invalid } from "./connections.mapper"

/** Gives, changes or removes one agent access to one connection (owner); saved at once from either picker. */
export const writeGrant = async (input: unknown): Promise<Outcome<true>> => {
    const parsed = grantSchema.safeParse(input)
    if (!parsed.success) return invalid(FAILURE_KEYS.invalid)
    return sendDone(parsed.data)
}
