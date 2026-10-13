"use server"
import "server-only"

import { dbFailure } from "@/modules/db/outcome"
import type { DbOutcome } from "@/modules/db/outcome"
import { getPrincipal } from "@/modules/db/principal"
import type { GoogleConsent } from "@/modules/types"
import { authorizeSchema, FAILURE_KEYS, sendCommand } from "./connections.mapper"

/** Starts the Google sign-in for a reconnect (owner): the server signs the state and answers the consent URL. */
export const writeGoogleAuthorize = async (input: unknown): Promise<DbOutcome<GoogleConsent>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", FAILURE_KEYS.refused)
    const parsed = authorizeSchema.safeParse(input)
    if (!parsed.success) return dbFailure("invalid", FAILURE_KEYS.invalid)
    return sendCommand<GoogleConsent>(parsed.data)
}
