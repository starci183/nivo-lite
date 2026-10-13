"use server"
import "server-only"

import { getPrincipal } from "../principal"
import { createServerDbClient } from "../server"
import { dbFailure, dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { passwordInputSchema } from "./auth.mapper"

/** Sets a new password for the person who arrived through the recovery link, then ends every session so they sign in again. */
export const writePasswordUpdate = async (input: unknown): Promise<DbOutcome<true>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", "otp_expired")
    const parsed = passwordInputSchema.safeParse(input)
    if (!parsed.success) return dbFailure("invalid", "weak_password")
    const client = await createServerDbClient()
    const updated = toOutcome(await client.auth.updateUser({ password: parsed.data }))
    if (updated.kind !== "ok") return updated
    await client.auth.signOut({ scope: "global" })
    return dbOk(true)
}
