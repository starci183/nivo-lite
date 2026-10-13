"use server"
import "server-only"

import { dbFailure } from "../outcome"
import type { DbOutcome } from "../outcome"
import { getPrincipal } from "../principal"
import type { GoogleConsent } from "@/modules/types"
import { authorizeSchema, FAILURE_KEYS, sendCommand, invalid } from "./command.mapper"

/** Starts the Google sign-in for a reconnect (owner): the server signs the state and answers the consent URL. */
export const writeGoogleAuthorize = async (input: unknown): Promise<DbOutcome<GoogleConsent>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", FAILURE_KEYS.refused)
    const parsed = authorizeSchema.safeParse(input)
    if (!parsed.success) return invalid(FAILURE_KEYS.invalid)
    return sendCommand<GoogleConsent>(parsed.data)
}
