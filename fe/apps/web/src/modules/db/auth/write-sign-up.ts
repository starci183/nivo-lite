"use server"
import "server-only"

import { createServerDbClient } from "../server"
import { dbFailure, dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { signUpInputSchema } from "./auth.mapper"
import { readConfirmTarget } from "./read-confirm-target"
import { readPostAuthPath } from "./read-post-auth-path"

/** What a sign-up produced: a session at once (confirmation off) with the page to open, or a mail to confirm first. */
export interface SignUpResult {
    readonly sessionCreated: boolean
    readonly path: string
}

/** Creates a password account. E-mail links come back through /auth/confirm, which turns the token into a session. */
export const writeSignUp = async (input: unknown): Promise<DbOutcome<SignUpResult>> => {
    const parsed = signUpInputSchema.safeParse(input)
    if (!parsed.success) return dbFailure("invalid", "sign-up-input")
    const target = await readConfirmTarget(parsed.data.next)
    if (target === undefined) return dbFailure("unavailable", "origin")
    const client = await createServerDbClient()
    const created = toOutcome(
        await client.auth.signUp({
            email: parsed.data.email,
            password: parsed.data.password,
            options: { data: { full_name: parsed.data.name }, emailRedirectTo: target.url },
        }),
    )
    if (created.kind !== "ok") return created
    if (created.value.session === null) return dbOk({ sessionCreated: false, path: target.next })
    return dbOk({ sessionCreated: true, path: await readPostAuthPath(target.next, target.origin) })
}
