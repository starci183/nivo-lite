import "server-only"

import { cache } from "react"
import { createServerDbClient } from "../server"
import { dbFailure, dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { toOfficePayload } from "./pagedata.mapper"
import type { OfficePayload } from "./pagedata.mapper"

/** The window the Office page asks about. */
export interface OfficeQuery {
    readonly workspaceId: string
    readonly since7: string
}

/** Everything the Office page reads, in one request (the `office_data` function), under the caller's RLS. */
export const readOfficePayload = cache(async (query: OfficeQuery): Promise<DbOutcome<OfficePayload>> => {
    const client = await createServerDbClient()
    const result = toOutcome(await client.rpc("office_data", { ws: query.workspaceId, since7: query.since7 }))
    if (result.kind !== "ok") return result
    const payload = toOfficePayload(result.value)
    return payload === null ? dbFailure("invalid", "office-payload") : dbOk(payload)
})
