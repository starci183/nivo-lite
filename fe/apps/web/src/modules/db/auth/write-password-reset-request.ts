"use server"
import "server-only"

import { AUTH_ROUTES } from "@/modules/routes"
import { createServerDbClient } from "../server"
import { dbFailure, dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { emailInputSchema, isRateLimited } from "./auth.mapper"
import { readConfirmTarget } from "./read-confirm-target"

/**
 * Sends a password-reset link. A well-formed e-mail always answers ok, whatever Auth says, so accounts cannot be enumerated;
 * only a rate limit is reported.
 */
export const writePasswordResetRequest = async (input: unknown): Promise<DbOutcome<true>> => {
    const parsed = emailInputSchema.safeParse(input)
    if (!parsed.success) return dbFailure("invalid", "email")
    const target = await readConfirmTarget(AUTH_ROUTES.resetPassword)
    if (target === undefined) return dbFailure("unavailable", "origin")
    const client = await createServerDbClient()
    const sent = toOutcome(await client.auth.resetPasswordForEmail(parsed.data.email, { redirectTo: target.url }))
    if (sent.kind !== "ok" && isRateLimited(sent.code)) return sent
    return dbOk(true)
}
