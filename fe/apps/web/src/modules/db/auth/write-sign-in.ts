"use server"
import "server-only"

import { getPrincipal } from "../principal"
import { createServerDbClient } from "../server"
import { dbFailure, dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { signInInputSchema } from "../validation/validation.mapper"
import { readPostAuthPath } from "./read-post-auth-path"
import { readRequestOrigin } from "./read-request-origin"

/** Result exposed to the client boundary after sign-in. */
export interface SignInResult {
    readonly userId: string
    /** The page to open next (a safe `next` field of the form wins, else dashboard or workspaces). */
    readonly path: string
}

const destinationOf = async (input: FormData): Promise<string> => {
    const origin = await readRequestOrigin()
    if (origin === undefined) return "/dashboard"
    const next = input.get("next")
    return readPostAuthPath(typeof next === "string" ? next : null, origin)
}

/** Schema-checks credentials, signs in through the server client and returns a typed outcome. */
export const writeSignIn = async (input: FormData): Promise<DbOutcome<SignInResult>> => {
    const principal = await getPrincipal()
    if (principal.kind === "ok") return dbOk({ userId: principal.value.id, path: await destinationOf(input) })
    const parsed = signInInputSchema.safeParse(input)
    if (!parsed.success) return dbFailure("invalid", "sign-in-input")
    const client = await createServerDbClient()
    const signedIn = toOutcome(await client.auth.signInWithPassword(parsed.data))
    if (signedIn.kind !== "ok") return signedIn
    if (signedIn.value.user === null) return dbFailure("refused", "user")
    return dbOk({ userId: signedIn.value.user.id, path: await destinationOf(input) })
}
