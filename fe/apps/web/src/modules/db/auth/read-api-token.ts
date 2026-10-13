import "server-only"

import { dbFailure, dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { getPrincipal } from "../principal"
import { createServerDbClient } from "../server"

/** The signed-in person's access token for a server read of the back end api; the caller is verified first. */
export const readApiToken = async (): Promise<DbOutcome<string>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return principal
    const client = await createServerDbClient()
    const session = toOutcome(await client.auth.getSession())
    if (session.kind !== "ok") return session
    const token = session.value.session?.access_token
    return token === undefined ? dbFailure("refused", "session") : dbOk(token)
}
