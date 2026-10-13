import "server-only"

import { cache } from "react"
import { createServerDbClient } from "../server"
import { dbFailure, dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { toDashboardPayload, toOfficePayload } from "./pagedata.mapper"
import type { DashboardPayload, OfficePayload } from "./pagedata.mapper"

/** The window of the campaign the dashboard asks about. */
export interface DashboardQuery {
    readonly workspaceId: string
    readonly since7: string
    readonly foundingFrom: string
    readonly foundingTo: string
}

/** The window the Office page asks about. */
export interface OfficeQuery {
    readonly workspaceId: string
    readonly since7: string
}

/** Everything the executive dashboard reads, in one request (the `dashboard_data` function), under the caller's RLS. */
export const readDashboardPayload = cache(async (query: DashboardQuery): Promise<DbOutcome<DashboardPayload>> => {
    const client = await createServerDbClient()
    const result = toOutcome(
        await client.rpc("dashboard_data", {
            ws: query.workspaceId,
            since7: query.since7,
            founding_from: query.foundingFrom,
            founding_to: query.foundingTo,
        }),
    )
    if (result.kind !== "ok") return result
    const payload = toDashboardPayload(result.value)
    return payload === null ? dbFailure("invalid", "dashboard-payload") : dbOk(payload)
})

/** Everything the Office page reads, in one request (the `office_data` function), under the caller's RLS. */
export const readOfficePayload = cache(async (query: OfficeQuery): Promise<DbOutcome<OfficePayload>> => {
    const client = await createServerDbClient()
    const result = toOutcome(await client.rpc("office_data", { ws: query.workspaceId, since7: query.since7 }))
    if (result.kind !== "ok") return result
    const payload = toOfficePayload(result.value)
    return payload === null ? dbFailure("invalid", "office-payload") : dbOk(payload)
})
