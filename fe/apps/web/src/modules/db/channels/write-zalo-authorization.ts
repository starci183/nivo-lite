"use server"
import "server-only"

import { dbFailure, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { getPrincipal } from "../principal"
import { createServerDbClient } from "../server"

/** What Zalo sends the browser back with after the owner granted the OA permissions. */
interface ZaloReturnInput {
    readonly state: string
    readonly code: string
    readonly oaId?: string
}

/** The longest state, code or OA id taken from the address bar. */
const FIELD_MAX = 600

const isField = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= FIELD_MAX

/**
 * Hands the authorization Zalo returned the browser with to the database. The database function proves the caller is an owner or manager of the
 * connection workspace and queues the exchange of the code, which the back end carries out; the answer is the connection to watch.
 */
export const writeZaloAuthorizationReturn = async (input: ZaloReturnInput): Promise<DbOutcome<string>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", "principal")
    if (!isField(input.state) || !isField(input.code) || (input.oaId !== undefined && !isField(input.oaId))) {
        return dbFailure("invalid", "zalo-authorization-input")
    }
    const db = await createServerDbClient()
    return toOutcome(
        await db.rpc("zalo_authorization_return", {
            p_state: input.state,
            p_code: input.code,
            ...(input.oaId === undefined ? {} : { p_oa_id: input.oaId }),
        }),
    )
}
