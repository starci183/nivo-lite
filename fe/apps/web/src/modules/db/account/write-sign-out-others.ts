"use server"
import "server-only"

import { dbFailure, dbOk } from "../outcome"
import type { DbOutcome } from "../outcome"
import { getPrincipal } from "../principal"
import { createServerDbClient } from "../server"

/** Signs the account out of every other device and keeps this one. */
export const writeSignOutOthers = async (): Promise<DbOutcome<true>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", "principal")
    const client = await createServerDbClient()
    const result = await client.auth.signOut({ scope: "others" })
    if (result.error === null) return dbOk(true)
    return dbFailure(result.error.status === 401 ? "refused" : "unavailable", result.error.code ?? "sign-out-others")
}
