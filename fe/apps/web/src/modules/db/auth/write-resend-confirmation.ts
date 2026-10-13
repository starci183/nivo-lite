"use server"
import "server-only"

import { createServerDbClient } from "../server"
import { dbFailure, dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { emailInputSchema } from "./auth.mapper"
import { readConfirmTarget } from "./read-confirm-target"

/** Sends the sign-up confirmation e-mail again. */
export const writeResendConfirmation = async (input: unknown): Promise<DbOutcome<true>> => {
    const parsed = emailInputSchema.safeParse(input)
    if (!parsed.success) return dbFailure("invalid", "email")
    const target = await readConfirmTarget(parsed.data.next)
    if (target === undefined) return dbFailure("unavailable", "origin")
    const client = await createServerDbClient()
    const sent = toOutcome(
        await client.auth.resend({
            type: "signup",
            email: parsed.data.email,
            options: { emailRedirectTo: target.url },
        }),
    )
    return sent.kind === "ok" ? dbOk(true) : sent
}
