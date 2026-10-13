"use server"
import "server-only"

import { headers } from "next/headers"
import { dbFailure, dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { getPrincipal } from "../principal"
import { createServerDbClient } from "../server"
import { emailInputSchema } from "./account.mapper"

/** Sends the confirmation link for a new address; the address changes only after the link is opened (/auth/confirm). */
export const writeEmail = async (input: unknown): Promise<DbOutcome<true>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", "principal")
    const parsed = emailInputSchema.safeParse(input)
    if (!parsed.success) return dbFailure("invalid", "email-input")
    if (parsed.data.email === principal.value.email?.toLowerCase()) return dbFailure("invalid", "email-same")
    const sent = await headers()
    const origin = sent.get("origin") ?? `${sent.get("x-forwarded-proto") ?? "http"}://${sent.get("host") ?? ""}`
    const client = await createServerDbClient()
    const updated = toOutcome(
        await client.auth.updateUser(
            { email: parsed.data.email },
            { emailRedirectTo: `${origin}/auth/confirm?next=/account` },
        ),
    )
    return updated.kind === "ok" ? dbOk(true) : updated
}
