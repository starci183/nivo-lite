"use server"
import "server-only"

import type { Outcome } from "../outcome"
import type { GoogleConsent } from "@/modules/types"
import { authorizeSchema, FAILURE_KEYS, sendCommand, invalid } from "./connections.mapper"

/** Starts the Google sign-in for a reconnect (owner): the server signs the state and answers the consent URL. */
export const writeGoogleAuthorize = async (input: unknown): Promise<Outcome<GoogleConsent>> => {
    const parsed = authorizeSchema.safeParse(input)
    if (!parsed.success) return invalid(FAILURE_KEYS.invalid)
    return sendCommand<GoogleConsent>(parsed.data)
}
