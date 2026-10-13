"use server"
import "server-only"

import { dbFailure, dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { getPrincipal } from "../principal"
import { createServerDbClient } from "../server"
import { sessionIdOf, sessionIdSchema } from "./account.mapper"

/** Signs out another device of the account; the session this request runs on is refused (use the sign-out action instead). */
export const writeRevokeSession = async (input: unknown): Promise<DbOutcome<true>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", "principal")
    const parsed = sessionIdSchema.safeParse(input)
    if (!parsed.success) return dbFailure("invalid", "session-input")
    const client = await createServerDbClient()
    const claims = toOutcome(await client.auth.getClaims())
    if (claims.kind !== "ok") return dbFailure(claims.kind, claims.code)
    if (sessionIdOf(claims.value.claims) === parsed.data.id) return dbFailure("invalid", "current-session")
    const revoked = toOutcome(await client.rpc("revoke_my_session", { session_id: parsed.data.id }))
    return revoked.kind === "ok" ? dbOk(true) : revoked
}
