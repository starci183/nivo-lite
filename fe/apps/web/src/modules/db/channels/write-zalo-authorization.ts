"use server"
import "server-only"

import { dbFailure, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { getPrincipal } from "../principal"
import { createServerDbClient } from "../server"
import { zaloReturnSchema } from "./zalo-wizard.mapper"

/**
 * Hands the authorization Zalo returned the browser with to the database. The database function proves the caller is an owner or manager of the
 * connection workspace and queues the exchange of the code, which the back end carries out; the answer is the connection to watch.
 */
export const writeZaloAuthorizationReturn = async (input: unknown): Promise<DbOutcome<string>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", "principal")
    const parsed = zaloReturnSchema.safeParse(input)
    if (!parsed.success) return dbFailure("invalid", `zalo-authorization-${parsed.field}`)
    const db = await createServerDbClient()
    return toOutcome(
        await db.rpc("zalo_authorization_return", {
            p_state: parsed.data.state,
            p_code: parsed.data.code,
            ...(parsed.data.oaId === undefined ? {} : { p_oa_id: parsed.data.oaId }),
        }),
    )
}
